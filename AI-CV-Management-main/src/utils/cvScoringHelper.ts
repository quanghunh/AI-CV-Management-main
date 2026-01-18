// Tạo file mới: utils/cvScoringHelper.ts

export interface ScoreBreakdown {
  skills: number;
  experience: number;
  education: number;
  level: number;
  position: number;
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  rating: 'Xuất sắc' | 'Tốt' | 'Trung bình' | 'Yếu';
  color: string;
}

/**
 * Tính điểm CV dựa trên nhiều tiêu chí
 * @param candidate - Thông tin ứng viên
 * @param jobRequirement - Yêu cầu công việc (nếu có)
 * @returns ScoreResult với tổng điểm và phân tích chi tiết
 */
export const calculateCVScore = (
  candidate: {
    skills?: { cv_skills: { name: string } }[];
    experience?: string;
    university?: string;
    cv_jobs?: { title: string; level: string } | null;
  },
  jobRequirement?: { title: string; level: string }
): ScoreResult => {
  const breakdown: ScoreBreakdown = {
    skills: 0,
    experience: 0,
    education: 0,
    level: 0,
    position: 0
  };

  // 1. Điểm kỹ năng (40 điểm tối đa)
  const skillsCount = candidate.skills?.length || 0;
  if (skillsCount > 0) {
    // Công thức: mỗi skill = 8 điểm, tối đa 40
    breakdown.skills = Math.min(skillsCount * 8, 40);
  }

  // 2. Điểm kinh nghiệm (25 điểm tối đa)
  if (candidate.experience) {
    const expMatch = candidate.experience.match(/(\d+)/);
    if (expMatch) {
      const years = parseInt(expMatch[1]);
      const level = candidate.cv_jobs?.level || jobRequirement?.level;
      
      // Điều chỉnh điểm theo level
      if (level === 'Junior') {
        // Junior: mỗi năm = 12 điểm (0-2 năm lý tưởng)
        breakdown.experience = Math.min(years * 12, 25);
      } else if (level === 'Mid-level') {
        // Mid: mỗi năm = 8 điểm (2-5 năm lý tưởng)
        breakdown.experience = Math.min(years * 8, 25);
      } else if (level === 'Senior') {
        // Senior: mỗi năm = 5 điểm (5+ năm lý tưởng)
        breakdown.experience = Math.min(years * 5, 25);
      } else {
        // Mặc định
        breakdown.experience = Math.min(years * 7, 25);
      }
    }
  }

  // 3. Điểm học vấn (15 điểm tối đa)
  if (candidate.university) {
    const topUniversities = [
      'Bách khoa', 'Bách Khoa', 'Bach Khoa', 'HCMUT',
      'Khoa học Tự nhiên', 'KHTN',
      'Công nghệ', 'University of Technology',
      'Kinh tế', 'UEH',
      'FPT', 'RMIT', 'VNU'
    ];
    
    const isTopUni = topUniversities.some(uni => 
      candidate.university?.toLowerCase().includes(uni.toLowerCase())
    );
    
    breakdown.education = isTopUni ? 15 : 10;
  }

  // 4. Điểm khớp cấp độ (10 điểm tối đa)
  if (jobRequirement?.level && candidate.cv_jobs?.level) {
    if (candidate.cv_jobs.level === jobRequirement.level) {
      breakdown.level = 10;
    } else {
      // Khớp một phần (ví dụ: Mid apply Senior)
      breakdown.level = 5;
    }
  } else if (candidate.cv_jobs?.level) {
    // Có level nhưng không có requirement để so sánh
    breakdown.level = 7;
  }

  // 5. Điểm khớp vị trí (10 điểm tối đa)
  if (jobRequirement?.title && candidate.cv_jobs?.title) {
    if (candidate.cv_jobs.title === jobRequirement.title) {
      breakdown.position = 10;
    } else {
      // Check similar positions (Frontend vs Fullstack, Backend vs Fullstack)
      const candidatePos = candidate.cv_jobs.title.toLowerCase();
      const requirementPos = jobRequirement.title.toLowerCase();
      
      if (
        (candidatePos.includes('fullstack') && 
         (requirementPos.includes('frontend') || requirementPos.includes('backend'))) ||
        (requirementPos.includes('fullstack') && 
         (candidatePos.includes('frontend') || candidatePos.includes('backend')))
      ) {
        breakdown.position = 7;
      } else {
        breakdown.position = 3;
      }
    }
  } else if (candidate.cv_jobs?.title) {
    breakdown.position = 5;
  }

  let total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  const randomFactor = Math.floor(Math.random() * 11) - 5;
  total = Math.max(0, Math.min(100, total + randomFactor));

  let rating: ScoreResult['rating'];
  let color: string;
  
  if (total >= 85) {
    rating = 'Xuất sắc';
    color = 'green';
  } else if (total >= 70) {
    rating = 'Tốt';
    color = 'blue';
  } else if (total >= 50) {
    rating = 'Trung bình';
    color = 'yellow';
  } else {
    rating = 'Yếu';
    color = 'red';
  }

  return {
    total: Math.round(total),
    breakdown,
    rating,
    color
  };
};

export const calculateBulkScores = (
  candidates: any[],
  jobRequirements?: Map<string, { title: string; level: string }>
): Map<string, ScoreResult> => {
  const scores = new Map<string, ScoreResult>();
  
  candidates.forEach(candidate => {
    const jobReq = jobRequirements?.get(candidate.job_id);
    const score = calculateCVScore(candidate, jobReq);
    scores.set(candidate.id, score);
  });
  
  return scores;
};


export const getScoreBadgeClass = (score: number): string => {
  if (score >= 85) return 'bg-green-100 text-green-700 border-green-300';
  if (score >= 70) return 'bg-blue-100 text-blue-700 border-blue-300';
  if (score >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  return 'bg-red-100 text-red-700 border-red-300';
};

export const getScoreIcon = (score: number): string => {
  if (score >= 85) return '🏆'; // Trophy
  if (score >= 70) return '⭐'; // Star
  if (score >= 50) return '📊'; // Chart
  return '📉'; // Declining chart
};