// src/lib/aiService.ts
import { supabase } from './supabaseClient';

interface JobGenerationParams {
  title: string;
  level: string;
  department: string;
  work_location: string;
  job_type: string;
  language: string;
  keywords?: string;
}

interface GeneratedJobDescription {
  description: string;
  requirements: string;
  benefits: string;
}

/**
 * Lấy cấu hình AI từ database
 */
export async function getAIConfig() {
  const { data, error } = await supabase
    .from('cv_ai_settings')
    .select('*')
    .single();
  
  if (error) {
    console.error('Error fetching AI config:', error);
    return null;
  }
  
  return data;
}

/**
 * Generate Job Description với OpenAI
 */
async function generateWithOpenAI(
  params: JobGenerationParams,
  apiKey: string,
  endpoint: string
): Promise<GeneratedJobDescription> {
  const prompt = `Tạo mô tả công việc chi tiết cho vị trí ${params.title} với các thông tin sau:
- Cấp độ: ${params.level}
- Phòng ban: ${params.department}
- Địa điểm: ${params.work_location}
- Loại công ty: ${params.job_type}
${params.keywords ? `- Kỹ năng cần thiết: ${params.keywords}` : ''}

Hãy tạo nội dung bằng ${params.language === 'vietnamese' ? 'Tiếng Việt' : 'English'} với 3 phần:
1. MÔ TẢ CÔNG VIỆC: Mô tả chi tiết về công việc, trách nhiệm chính (5-7 điểm)
2. YÊU CẦU CÔNG VIỆC: Yêu cầu về kỹ năng, kinh nghiệm, trình độ (6-8 điểm)
3. QUYỀN LỢI: Các quyền lợi, phúc lợi hấp dẫn (5-7 điểm)

Định dạng mỗi phần với các bullet points rõ ràng, cụ thể và hấp dẫn.`;

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Bạn là chuyên gia tuyển dụng và viết Job Description chuyên nghiệp.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  return parseGeneratedContent(content);
}

/**
 * Generate Job Description với Gemini AI
 * FIX: Sử dụng gemini-pro (stable model, always available)
 */
async function generateWithGemini(
  params: JobGenerationParams,
  apiKey: string
): Promise<GeneratedJobDescription> {
  const prompt = `Tạo mô tả công việc chi tiết cho vị trí ${params.title} với các thông tin sau:
- Cấp độ: ${params.level}
- Phòng ban: ${params.department}
- Địa điểm: ${params.work_location}
- Loại công ty: ${params.job_type}
${params.keywords ? `- Kỹ năng cần thiết: ${params.keywords}` : ''}

Hãy tạo nội dung bằng ${params.language === 'vietnamese' ? 'Tiếng Việt' : 'English'} với 3 phần:
1. MÔ TẢ CÔNG VIỆC: Mô tả chi tiết về công việc, trách nhiệm chính (5-7 điểm)
2. YÊU CẦU CÔNG VIỆC: Yêu cầu về kỹ năng, kinh nghiệm, trình độ (6-8 điểm)
3. QUYỀN LỢI: Các quyền lợi, phúc lợi hấp dẫn (5-7 điểm)

Định dạng mỗi phần với các bullet points rõ ràng, cụ thể và hấp dẫn.`;

  // ✅ FIX: Sử dụng gemini-pro (stable, always available)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        }
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  if (!content) {
    throw new Error('Gemini không trả về nội dung. Vui lòng thử lại.');
  }
  
  return parseGeneratedContent(content);
}

/**
 * Parse nội dung được generate thành 3 phần
 */
function parseGeneratedContent(content: string): GeneratedJobDescription {
  // Tách nội dung thành 3 phần dựa trên các header
  const sections = {
    description: '',
    requirements: '',
    benefits: ''
  };

  // Patterns để tìm các phần
  const descPattern = /(?:MÔ TẢ CÔNG VIỆC|JOB DESCRIPTION|TRÁCH NHIỆM)(.*?)(?=YÊU CẦU|REQUIREMENTS|$)/is;
  const reqPattern = /(?:YÊU CẦU|REQUIREMENTS)(.*?)(?=QUYỀN LỢI|BENEFITS|$)/is;
  const benPattern = /(?:QUYỀN LỢI|BENEFITS)(.*?)$/is;

  const descMatch = content.match(descPattern);
  const reqMatch = content.match(reqPattern);
  const benMatch = content.match(benPattern);

  sections.description = descMatch ? descMatch[1].trim() : content.split('\n\n')[0] || '';
  sections.requirements = reqMatch ? reqMatch[1].trim() : content.split('\n\n')[1] || '';
  sections.benefits = benMatch ? benMatch[1].trim() : content.split('\n\n')[2] || '';

  // Nếu không tách được, thử split theo các dấu ngắt tự nhiên
  if (!sections.description && !sections.requirements && !sections.benefits) {
    const parts = content.split(/\n\n+/);
    sections.description = parts[0] || '';
    sections.requirements = parts[1] || '';
    sections.benefits = parts[2] || '';
  }

  return sections;
}

/**
 * Main function để generate job description
 */
export async function generateJobDescription(
  params: JobGenerationParams
): Promise<GeneratedJobDescription> {
  // Lấy cấu hình AI
  const config = await getAIConfig();
  
  if (!config) {
    throw new Error('Không tìm thấy cấu hình AI. Vui lòng cấu hình AI trong phần Settings.');
  }

  // Ưu tiên sử dụng Gemini nếu được bật
  if (config.is_gemini_enabled && config.gemini_api_key) {
    try {
      return await generateWithGemini(params, config.gemini_api_key);
    } catch (error) {
      console.error('Gemini generation failed:', error);
      // Fallback sang OpenAI nếu Gemini fail
      if (config.is_openai_enabled && config.openai_api_key) {
        return await generateWithOpenAI(
          params, 
          config.openai_api_key, 
          config.openai_endpoint || 'https://api.openai.com/v1'
        );
      }
      throw error;
    }
  }

  // Sử dụng OpenAI nếu được bật
  if (config.is_openai_enabled && config.openai_api_key) {
    return await generateWithOpenAI(
      params,
      config.openai_api_key,
      config.openai_endpoint || 'https://api.openai.com/v1'
    );
  }

  throw new Error('Không có AI service nào được kích hoạt. Vui lòng kích hoạt OpenAI hoặc Gemini trong Settings.');
}