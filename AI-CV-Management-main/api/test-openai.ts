// @ts-nocheck
// api/test-openai.js

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { apiKey, endpoint } = req.body;

    if (!apiKey || !endpoint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing apiKey or endpoint' 
      });
    }

    // Clean endpoint
    const cleanEndpoint = endpoint.replace(/\/$/, '');

    // Test OpenAI API
    const response = await fetch(`${cleanEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Test connection'
          }
        ],
        max_tokens: 5
      })
    });

    const data = await response.json();

    if (response.ok && data.choices) {
      return res.status(200).json({ 
        success: true, 
        message: 'OpenAI connection successful',
        model: data.model
      });
    } else if (data.error) {
      return res.status(400).json({ 
        success: false, 
        error: data.error.message || 'OpenAI API error'
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid OpenAI response' 
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('OpenAI test error:', error);
    return res.status(500).json({ 
      success: false, 
      error: errorMessage
    });
  }
}