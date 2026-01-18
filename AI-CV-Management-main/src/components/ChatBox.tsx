// src/components/ChatBox.tsx
import { useState } from 'react';
import { openRouterService } from '../services/openRouterService';

export function ChatBox() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');

  const handleAnalyzeImage = async () => {
    setLoading(true);
    try {
      const result = await openRouterService.analyzeImage(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg',
        'What is in this image?'
      );
      
      setResponse(result.choices[0].message.content);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleAnalyzeImage} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze Image'}
      </button>
      {response && <p>{response}</p>}
    </div>
  );
}