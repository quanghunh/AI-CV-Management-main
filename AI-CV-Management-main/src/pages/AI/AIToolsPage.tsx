import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Key, Eye, EyeOff, Check, AlertCircle, Sparkles, Bot, Database, Send, Trash2, RefreshCw } from "lucide-react";
// Import Supabase client
import { supabase } from "@/lib/supabaseClient";

interface APIKeys {
  openrouter?: string;
}

type MessageRole = "user" | "assistant" | "system" | "tool";

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

const tools = [
  {
    type: "function",
    function: {
      name: "get_candidates_from_db",
      description: `Lấy danh sách ứng viên từ database Supabase table cv_candidates. Sử dụng để tìm ID theo tên, job_title, hoặc filter khác. Khi user hỏi CV theo tên (e.g., "Trần Văn Hùng"), dùng keywords=full_name để tìm. Khi hỏi "3 CV điểm cao nhất", dùng limit=3, order_by="score_desc". Khi lọc theo vị trí (e.g., "Frontend Dev"), dùng job_title_filter để ilike trên cv_jobs.title.`,
      parameters: {
        type: "object",
        properties: {
          job_title_filter: { type: "string", description: "Tên vị trí việc làm để lọc (ilike trên cv_jobs.title, e.g., 'Frontend Developer')" },
          min_score: { type: "number", description: "Điểm tối thiểu (0-100)" },
          max_score: { type: "number", description: "Điểm tối đa (0-100)" },
          keywords: { type: "string", description: "Từ khóa tìm trong full_name, skills, experience (e.g., tên 'Trần Văn Hùng' hoặc 'Python')" },
          limit: { type: "number", description: "Số lượng (default 10, max 50)" },
          order_by: { type: "string", enum: ["score_desc", "score_asc", "date_desc", "date_asc"], description: "Sắp xếp (default score_desc)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_candidate_detail",
      description: "Lấy chi tiết CV của 1 ứng viên theo ID (UUID). Luôn gọi sau khi có ID từ get_candidates_from_db nếu cần chi tiết đầy đủ.",
      parameters: {
        type: "object",
        properties: {
          candidate_id: { type: "string", description: "ID của ứng viên (UUID)" }
        },
        required: ["candidate_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_candidates",
      description: "Phân tích thống kê CV (tổng số, điểm trung bình, top vị trí)",
      parameters: {
        type: "object",
        properties: {
          analysis_type: { type: "string", enum: ["summary", "by_position", "by_score_range"] }
        },
        required: []
      }
    }
  }
];

type ToolCallArgs = {
  job_title_filter?: string;
  min_score?: number;
  max_score?: number;
  keywords?: string;
  limit?: number;
  order_by?: string;
  candidate_id?: string;
  analysis_type?: string;
};

export default function AIAgentChat() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openrouter_api_key") || "");
  const [tempKey, setTempKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [messages, setMessages] = useState<OpenAIMessage[]>([
    {
      role: "system",
      content: `Bạn là AI Agent chuyên quản lý CV tuyển dụng cho admin, kết nối Supabase table cv_candidates và cv_jobs.
BUỘC PHẢI:
- Đối với BẤT KỲ query về CV (e.g., "3 CV điểm cao nhất", "CV apply vào Frontend Dev", "CV của Trần Văn Hùng", "top 5 CV có skills Python"), LUÔN GỌI TOOL get_candidates_from_db trước để filter/query.
- Ví dụ: "3 CV điểm cao nhất" -> limit=3, order_by="score_desc".
- "1 CV apply vào Frontend Dev" -> job_title_filter="Frontend Developer", limit=1.
- "CV của tên X" -> keywords="tên X" để tìm full_name.
- Nếu cần chi tiết đầy đủ, chain với get_candidate_detail dùng ID tìm được.
- Join cv_candidates với cv_jobs để lấy job_title từ cv_jobs.title.
- Trả lời TIẾNG VIỆT, ngắn gọn, format danh sách: 1. **Tên** - Vị trí - Điểm: X 📧 email\n   Kinh nghiệm: Y
- Nếu không tìm thấy: "Không tìm thấy CV phù hợp trong database."
- Hỗ trợ các prompt khác: thống kê, phân tích match, etc. KHÔNG bịa data.`
    },
    {
      role: "assistant",
      content: `👋 Xin chào Admin! Tôi là AI Agent quản lý CV với kết nối Supabase.
Tôi có thể giúp:
📊 Tìm kiếm: "Lấy 3 CV điểm cao nhất", "1 CV apply vào Frontend Dev", "Top 5 CV có kỹ năng Python"
🎯 Lọc: "CV >= 90 điểm cho vị trí Backend"
📈 Thống kê: "Tổng quan CV"
Hãy hỏi tôi! 🚀`
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasApiKey = !!apiKey;

  const handleSaveKey = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      if (tempKey.trim()) {
        localStorage.setItem("openrouter_api_key", tempKey.trim());
        setApiKey(tempKey.trim());
      } else {
        localStorage.removeItem("openrouter_api_key");
        setApiKey("");
      }
      setSaveStatus("saved");
      setTimeout(() => {
        setShowModal(false);
        setSaveStatus("idle");
      }, 1000);
    }, 500);
  };

  const executeToolCall = async (toolCall: ToolCall) => {
    console.log("Executing tool:", toolCall.function.name, "with args:", toolCall.function.arguments);
    const args: ToolCallArgs = JSON.parse(toolCall.function.arguments);
    try {
      if (toolCall.function.name === "get_candidates_from_db") {
        let query = supabase
          .from("cv_candidates")
          .select(`
            id, full_name, email, phone_number, status, source, job_id, university, education, experience, address, score, cv_url, cv_parsed_data,
            job:cv_jobs (title as job_title)
          `);

        // Lọc theo job_title_filter (ilike trên cv_jobs.title)
        if (args.job_title_filter) {
          query = query.ilike("cv_jobs.title", `%${args.job_title_filter}%`);
        }

        if (args.keywords) {
          query = query.or(`full_name.ilike.%${args.keywords}%, cv_parsed_data->>skills.ilike.%${args.keywords}%, cv_parsed_data->>experience.ilike.%${args.keywords}%`);
        }
        if (args.min_score !== undefined) query = query.gte("score", args.min_score);
        if (args.max_score !== undefined) query = query.lte("score", args.max_score);

        const orderBy = args.order_by || "score_desc";
        const orderField = orderBy.includes("score") ? "score" : "created_at";
        const ascending = orderBy.includes("asc");
        query = query.order(orderField, { ascending });

        const limit = Math.min(args.limit || 10, 50);
        query = query.limit(limit);

        const { data, error } = await query;
        if (error) {
          console.error("Supabase error in get_candidates:", error);
          throw error;
        }

        const formattedData = (data || []).map((cv: any) => ({
          id: cv.id,
          full_name: cv.full_name,
          email: cv.email,
          job_title: cv.job?.job_title || "Unknown",
          score: cv.score,
          experience: cv.experience,
          cv_url: cv.cv_url
        }));

        return JSON.stringify({
          success: true,
          count: formattedData.length,
          data: formattedData,
          note: formattedData.length === 0 ? "Không tìm thấy CV." : "Data OK."
        });
      }

      if (toolCall.function.name === "get_candidate_detail") {
        const { data, error } = await supabase
          .from("cv_candidates")
          .select("*")
          .eq("id", args.candidate_id)
          .single();
        if (error) {
          console.error("Supabase error in get_detail:", error);
          throw error;
        }
        return JSON.stringify({ success: true, data: data || "Không tìm thấy." });
      }

      if (toolCall.function.name === "analyze_candidates") {
        const { data: allCandidates, error } = await supabase
          .from("cv_candidates")
          .select("job_id, score");
        if (error) throw error;

        const total = allCandidates?.length || 0;
        const avgScore = allCandidates?.reduce((sum, c) => sum + (c.score || 0), 0) / total || 0;

        const positionCount: { [key: string]: number } = {};
        allCandidates?.forEach((c) => {
          const pos = c.job_id || "Unknown";
          positionCount[pos] = (positionCount[pos] || 0) + 1;
        });
        const topPositions = Object.entries(positionCount)
          .map(([position, count]) => ({ position, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const scoreRanges = { "90-100": 0, "80-89": 0, "70-79": 0, "below_70": 0 };
        allCandidates?.forEach((c) => {
          const score = c.score || 0;
          if (score >= 90) scoreRanges["90-100"]++;
          else if (score >= 80) scoreRanges["80-89"]++;
          else if (score >= 70) scoreRanges["70-79"]++;
          else scoreRanges["below_70"]++;
        });

        return JSON.stringify({
          success: true,
          data: {
            total_candidates: total,
            average_score: Math.round(avgScore * 10) / 10,
            top_positions: topPositions,
            score_distribution: scoreRanges
          }
        });
      }

      return JSON.stringify({ error: "Tool không hỗ trợ" });
    } catch (error: any) {
      console.error("Tool execution error:", error.message);
      return JSON.stringify({ error: "Lỗi database: " + error.message });
    }
  };

  const callOpenRouterAPI = async (msgs: OpenAIMessage[]): Promise<OpenAIMessage> => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "CV Recruitment AI Agent"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: msgs,
        tools: tools,
        tool_choice: "required",  // Buộc gọi tool nếu phù hợp
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message;
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;
    const userMsg: OpenAIMessage = { role: "user", content: input };
    let currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setInput("");
    setLoading(true);

    try {
      let botResponse = await callOpenRouterAPI(currentMessages);
      let maxChains = 5;  // Tăng để hỗ trợ chain phức tạp hơn
      while (botResponse.tool_calls && botResponse.tool_calls.length > 0 && maxChains > 0) {
        const thinkingMsg: OpenAIMessage = { role: "assistant", content: null, tool_calls: botResponse.tool_calls };
        currentMessages = [...currentMessages, thinkingMsg];
        setMessages(currentMessages);

        for (const toolCall of botResponse.tool_calls) {
          setMessages(prev => [...prev, { role: "assistant", content: `🔍 Đang truy vấn database: ${toolCall.function.name}...\n⏳ Vui lòng chờ...` }]);
          const toolResult = await executeToolCall(toolCall);
          const toolResultMsg: OpenAIMessage = { role: "tool", tool_call_id: toolCall.id, content: toolResult };
          currentMessages = [...currentMessages, toolResultMsg];
        }

        botResponse = await callOpenRouterAPI(currentMessages);
        maxChains--;
      }

      setMessages(prev => {
        const filtered = prev.filter(m => !m.content?.includes("🔍 Đang truy vấn"));
        return [...filtered, botResponse];
      });
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `❌ **Lỗi**: ${error.message}\n\nVui lòng kiểm tra API key, kết nối Supabase hoặc thử lại.` }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      { role: "system", content: `Bạn là AI Agent chuyên hỗ trợ Admin quản lý CV...` },
      { role: "assistant", content: `👋 Xin chào Admin! Tôi là AI Agent quản lý CV.\n\nHãy cho tôi biết bạn cần gì! 🚀` }
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">AI Agent - Quản Lý CV</h1>
                <p className="text-sm text-gray-600">Trợ lý thông minh kết nối database</p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${ hasApiKey ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200" }`} >
              <Key className="w-4 h-4" />
              <span className="text-sm font-medium"> {hasApiKey ? "✓ API Connected" : "⚠ Config API"} </span>
            </button>
          </div>
          {hasApiKey && (
            <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-800"> Database: <span className="text-green-600">● Connected</span> </span>
                <span className="mx-2">•</span>
                <span className="text-sm text-gray-600">Model: GPT-4o-mini</span>
              </div>
            </div>
          )}
        </div>
        {/* Chat Interface */}
        {hasApiKey ? (
          <div className="bg-white rounded-lg shadow-lg">
            {/* Quick Actions */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">🚀 Gợi ý nhanh:</span>
                <button onClick={clearChat} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1" >
                  <Trash2 className="w-3 h-3" /> Xóa chat
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setInput("Lấy 3 CV có điểm cao nhất, liệt kê đầy đủ tên, email, vị trí, kinh nghiệm")} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition" >
                  🏆 Top 3 CV cao điểm
                </button>
                <button onClick={() => setInput("Cho tôi 1 CV đang apply vào Frontend Developer")} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition" >
                  🔍 1 CV Frontend Dev
                </button>
                <button onClick={() => setInput("Thống kê tổng quan: tổng số CV, điểm trung bình, top vị trí")} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition" >
                  📊 Thống kê tổng quan
                </button>
                <button onClick={() => setInput("Lấy CV có điểm >= 90")} className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition" >
                  ⭐ CV xuất sắc (&gt;=90)
                </button>
              </div>
            </div>
            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => {
                if (msg.role === "system" || msg.role === "tool") return null;
                const isUser = msg.role === "user";
                const isThinking = msg.role === "assistant" && !msg.content && msg.tool_calls;
                return (
                  <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${ isUser ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" : isThinking ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-gray-100 text-gray-800" }`}>
                      {isThinking ? (
                        <div className="flex items-center gap-2 text-sm">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang phân tích yêu cầu...</span>
                        </div>
                      ) : (
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                      <span className="text-xs text-gray-600">AI đang xử lý...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {/* Input */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
                  className="flex-1 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="Hỏi AI: 'Lấy 3 CV điểm cao nhất', '1 CV apply vào Frontend Dev'..."
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2"> Chưa cấu hình API Key </h3>
            <p className="text-gray-600 mb-6"> Vui lòng nhập OpenRouter API Key để sử dụng AI Agent </p>
            <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition" >
              Cấu hình ngay
            </button>
          </div>
        )}
        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5" /> Cấu hình OpenRouter API Key
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"> API Key </label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full border rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Lấy từ{" "}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline" >
                      OpenRouter Dashboard
                    </a>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveKey}
                    disabled={saveStatus === "saving"}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${ saveStatus === "saved" ? "bg-green-600 text-white" : "bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-300" }`}
                  >
                    {saveStatus === "saving" ? (
                      "Đang lưu..."
                    ) : saveStatus === "saved" ? (
                      <span className="flex items-center justify-center gap-1">
                        <Check className="w-4 h-4" /> Đã lưu
                      </span>
                    ) : (
                      "Lưu API Key"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setTempKey(apiKey);
                      setSaveStatus("idle");
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                  >
                    Hủy
                  </button>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>💡 Lưu ý:</strong> API key được lưu cục bộ trên trình duyệt. AI Agent sẽ tự động kết nối database khi bạn hỏi về CV.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}