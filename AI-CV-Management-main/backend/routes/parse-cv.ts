// backend/routes/parse-cv.ts
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();

router.post('/parse-cv', async (req, res) => {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY // API key ở server
    });

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: req.body.messages
    });

    res.json(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

export default router;