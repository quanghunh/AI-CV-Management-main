// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Test Gemini AI connection
 * FIX: Use gemini-pro model (stable, always available)
 */
export const testGeminiConnection = async (apiKey: string) => {
  try {

    console.log('🔍 Testing Gemini API...');
    console.log('API Key (first 10 chars):', apiKey.substring(0, 10) + '...');
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log('📡 Calling:', url.replace(apiKey, 'HIDDEN'));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);

    const contentType = response.headers.get('content-type');
    console.log('📄 Content-Type:', contentType);

    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Non-JSON response:', text);
      return { 
        success: false, 
        error: 'API returned non-JSON response' 
      };
    }

    const data = await response.json();
    console.log('✅ Response data:', data);
    
    if (response.ok && data.models && data.models.length > 0) {
      console.log('✅ Gemini test successful!');
      return { success: true, message: 'Kết nối thành công' };
    } else if (data.error) {
      console.error('❌ Gemini API error:', data.error);
      return { success: false, error: data.error.message };
    } else {
      console.error('❌ Invalid response structure');
      return { success: false, error: 'Invalid response from Gemini' };
    }
  } catch (error: any) {
    console.error('❌ Gemini test failed:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error'
    };
  }
};
