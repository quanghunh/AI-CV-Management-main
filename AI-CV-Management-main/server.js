// server.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test OpenAI endpoint
app.post('/api/test-openai', async (req, res) => {
  try {
    // Import dynamically to avoid issues
    const { default: testOpenAI } = await import('./api/test-openai.js');
    return testOpenAI(req, res);
  } catch (error) {
    console.error('OpenAI test error:', error);
    res.status(500).json({ error: 'OpenAI test failed', message: error.message });
  }
});

// Test Gemini endpoint
app.post('/api/test-gemini', async (req, res) => {
  try {
    const { default: testGemini } = await import('./api/test-gemini.js');
    return testGemini(req, res);
  } catch (error) {
    console.error('Gemini test error:', error);
    res.status(500).json({ error: 'Gemini test failed', message: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});