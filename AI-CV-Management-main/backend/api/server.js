// backend/api/server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { OAuth2Client } = require("google-auth-library");
const Bottleneck = require("bottleneck");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const KEY = process.env.GEMINI_API_KEY;

// --- Middleware ---
app.use(cors());
app.use(express.json());

if (!KEY) {
  console.warn("⚠️ GEMINI_API_KEY not set. Add it to backend/api/.env");
}

// --- Google OAuth2 Client ---
const GOOGLE_CLIENT_ID = "392471570421-4lb57egpqahi7v2ifvvdkptica5cmqo7.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Google Auth Route ---
app.post("/api/auth/google", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: "Token required" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    console.log("Google payload:", payload);

    return res.json({
      success: true,
      user: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    });
  } catch (err) {
    console.error("Google token verify error:", err);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
});

// --- Bottleneck Limiter (1 req/sec, max 1 concurrent) ---
const geminiLimiter = new Bottleneck({
  reservoir: 1,
  reservoirRefreshAmount: 1,
  reservoirRefreshInterval: 1000, // refill every 1s
  maxConcurrent: 1,
  minTime: 300,
});

// --- Gemini API Logic ---
let preferredModel = null;

async function fetchWithRetry(url, options, maxRetries = 6) {
  let attempt = 0;
  while (attempt < maxRetries) {
    const resp = await fetch(url, options);
    if (resp.status !== 429) return resp;

    attempt++;
    let delay = 2000 * attempt; // 2s, 4s, 6s ...
    const retryAfter = resp.headers.get("Retry-After");
    if (retryAfter) {
      const retrySeconds = parseInt(retryAfter, 10);
      if (!isNaN(retrySeconds)) delay = retrySeconds * 1000;
    }
    console.log(
      `Rate limit (429) from ${url}. Attempt ${attempt}/${maxRetries}. Retrying after ${delay / 1000}s.`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error("Max retries exceeded for rate limit");
}

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`;
  const resp = await fetchWithRetry(url, { method: "GET" });
  const data = await resp.json();
  if (!resp.ok) throw data;
  return data;
}

function chooseModelFromList(modelsList) {
  if (!modelsList || !Array.isArray(modelsList.models)) return null;
  for (const m of modelsList.models) {
    const id = m.name || m.model || m.id || "";
    const lower = String(id).toLowerCase();
    if (
      lower.includes("gemini") &&
      (lower.includes("flash") ||
        lower.includes("2.5") ||
        lower.includes("pro") ||
        lower.includes("spark"))
    ) {
      return id.replace(/^models\//, "");
    }
  }
  for (const m of modelsList.models) {
    const id = m.name || m.model || m.id || "";
    if (
      m.supportedGenerationMethods &&
      m.supportedGenerationMethods.includes("generateContent")
    )
      return id.replace(/^models\//, "");
  }
  return (
    (modelsList.models[0] &&
      (modelsList.models[0].name ||
        modelsList.models[0].id ||
        modelsList.models[0].model ||
        "")) ||
    null
  ).replace(/^models\//, "");
}

// Cache preferred model at startup
(async () => {
  if (KEY) {
    try {
      const modelsList = await listModels();
      preferredModel = chooseModelFromList(modelsList);
      if (preferredModel) {
        console.log(`✅ Cached preferred model: ${preferredModel}`);
      } else {
        console.warn("⚠️ No usable Gemini model found during startup cache.");
      }
    } catch (err) {
      console.error("Startup model cache error:", err);
    }
  }
})();

// --- Health Check ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", port: PORT, keyConfigured: !!KEY });
});

// --- List Models ---
app.get("/api/ai/models", async (req, res) => {
  if (!KEY) return res.status(500).json({ error: "GEMINI_API_KEY not set on server" });
  try {
    const models = await listModels();
    return res.json(models);
  } catch (err) {
    console.error("ListModels error:", err);
    return res.status(500).json({ error: err });
  }
});

// --- Chat Endpoint ---
app.post("/api/ai/chat", async (req, res) => {
  if (!KEY) return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });

  const { messages, model: requestedModel } = req.body;
  if (!messages || !Array.isArray(messages))
    return res.status(400).json({ error: "messages array required" });

  try {
    let modelId = requestedModel || preferredModel || process.env.GEMINI_MODEL_ID || null;

    if (!modelId) {
      const modelsList = await listModels();
      modelId = chooseModelFromList(modelsList);
      if (!modelId)
        return res.status(500).json({
          error:
            "No usable Gemini model found. Call /api/ai/models to inspect available models.",
        });
      preferredModel = modelId;
    }

    let systemInstruction = "";
    const contents = [];
    for (const m of messages) {
      if (m.role === "system") {
        systemInstruction += m.content + "\n";
      } else {
        contents.push({
          role: m.role === "bot" || m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }
    }
    systemInstruction = systemInstruction.trim();

    const body = {
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
    };
    if (systemInstruction) {
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${KEY}`;

    // 👉 Thêm limiter tại đây
    const resp = await geminiLimiter.schedule(() =>
      fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

    const data = await resp.json();
    if (!resp.ok) {
      console.error("generateContent error:", data);
      if (resp.status === 404)
        return res.status(404).json({
          error: data,
          note: "Model not found or not supported for generateContent. Call /api/ai/models to inspect available models.",
        });
      return res.status(resp.status).json({ error: data });
    }

    let reply = "";
    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      reply = data.candidates[0].content.parts[0].text || "";
    }
    if (!reply) reply = JSON.stringify(data).slice(0, 2000);

    return res.json({ model: modelId, raw: data, reply });
  } catch (err) {
    console.error("Server -> Gemini call error:", err);
    return res.status(503).json({ error: "Upstream rate limited. Try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
});
