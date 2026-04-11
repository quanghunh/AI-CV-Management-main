// src/utils/cvMatchingService.ts

export interface JobMatchResult {
  job_id: string
  job_title: string
  match_score: number
  strengths: string[]
  weaknesses: string[]
  recommendation: string
}

export interface CVAnalysisResult {
  overall_score: number
  best_match: JobMatchResult | null
  all_matches: JobMatchResult[]
}

export async function analyzeWithGPT4o(
  cvText: string,
  cvData: any,
  jobs: any[],
  primaryJobId?: string
): Promise<CVAnalysisResult> {
  try {
    console.log('🎯 Calling AI backend to match CV with jobs...');
    console.log('📊 CV Data:', cvData.full_name);
    console.log('📋 Jobs count:', jobs.length);
    console.log('⭐ Primary job:', primaryJobId);
    
    // Lấy API URL từ .env
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
    console.log('📡 API URL:', API_URL);
    
    // Chuẩn bị payload
    const payload = {
      cv_text: cvText,
      cv_data: {
        full_name: cvData.full_name,
        email: cvData.email,
        phone_number: cvData.phone_number,
        address: cvData.address,
        university: cvData.university,
        education: cvData.education,
        experience: cvData.experience,
      },
      jobs: jobs.map(job => ({
        id: job.id,
        title: job.title,
        department: job.department,
        level: job.level,
        job_type: job.job_type,
        work_location: job.work_location,
        location: job.location,
        description: job.description,
        requirements: job.requirements,
        benefits: job.benefits,
      })),
      primary_job_id: primaryJobId,
    };

    console.log('📤 Sending request to backend...');

    // Gọi backend API với timeout 60s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${API_URL}/api/match-cv-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('📥 Backend response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Backend error:', errorData);
      throw new Error(errorData.detail || `Backend error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ AI matching analysis thành công');
    console.log('📊 Overall score:', result.data?.overall_score);
    console.log('🎯 Best match:', result.data?.best_match?.job_title);
    console.log('💰 Tokens used:', result.metadata?.tokens_count);

    if (result.success && result.data) {
      return result.data as CVAnalysisResult;
    }

    throw new Error('Backend không trả về dữ liệu hợp lệ');

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ AI request timeout sau 60s');
      throw new Error('Yêu cầu phân tích quá lâu. Vui lòng thử lại.');
    }
    console.error('❌ Lỗi khi gọi AI backend:', error);
    throw error;
  }
}