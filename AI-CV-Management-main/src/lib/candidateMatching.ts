// src/utils/candidateMatching.ts
import { supabase } from '@/lib/supabaseClient';

export interface MatchResult {
  candidateId: string;
  candidateName: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  totalCandidateSkills: number;
  totalRequiredSkills: number;
}

// Tính matching score giữa candidate và job
export async function calculateJobMatch(
  candidateId: string, 
  jobId: string
): Promise<MatchResult | null> {
  try {
    // Lấy skills của candidate
    const { data: candidateSkills, error: candidateError } = await supabase
      .from('cv_candidate_skills')
      .select('cv_skills(id, name)')
      .eq('candidate_id', candidateId);

    if (candidateError) throw candidateError;

    // Lấy skills yêu cầu của job
    const { data: jobSkills, error: jobError } = await supabase
      .from('cv_job_skills')
      .select('cv_skills(id, name), is_required, priority')
      .eq('job_id', jobId);

    if (jobError) throw jobError;

    // Lấy thông tin candidate
    const { data: candidate } = await supabase
      .from('cv_candidates')
      .select('full_name')
      .eq('id', candidateId)
      .single();

    if (!candidateSkills || !jobSkills || !candidate) {
      return null;
    }

    const candidateSkillIds = new Set(
      candidateSkills.map((cs: any) => cs.cv_skills.id)
    );
    const candidateSkillNames = candidateSkills.map((cs: any) => cs.cv_skills.name);

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    let totalScore = 0;
    let maxScore = 0;

    // Tính điểm matching
    jobSkills.forEach((js: any) => {
      const skillId = js.cv_skills.id;
      const skillName = js.cv_skills.name;
      const priority = js.priority || 1;
      const isRequired = js.is_required;

      // Điểm tối đa cho skill này
      const skillMaxScore = isRequired ? priority * 2 : priority;
      maxScore += skillMaxScore;

      if (candidateSkillIds.has(skillId)) {
        matchedSkills.push(skillName);
        totalScore += skillMaxScore;
      } else {
        missingSkills.push(skillName);
      }
    });

    const matchScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    return {
      candidateId,
      candidateName: candidate.full_name,
      matchScore,
      matchedSkills,
      missingSkills,
      totalCandidateSkills: candidateSkillNames.length,
      totalRequiredSkills: jobSkills.length
    };
  } catch (error) {
    console.error('Error calculating job match:', error);
    return null;
  }
}

// Tìm top candidates phù hợp với job
export async function findTopCandidatesForJob(
  jobId: string,
  limit: number = 10
): Promise<MatchResult[]> {
  try {
    // Lấy tất cả candidates
    const { data: candidates, error } = await supabase
      .from('cv_candidates')
      .select('id')
      .eq('status', 'Mới'); // Chỉ lấy candidates có status Mới

    if (error) throw error;
    if (!candidates) return [];

    // Tính match score cho từng candidate
    const matchResults: MatchResult[] = [];
    
    for (const candidate of candidates) {
      const result = await calculateJobMatch(candidate.id, jobId);
      if (result && result.matchScore > 0) {
        matchResults.push(result);
      }
    }

    // Sắp xếp theo match score giảm dần
    matchResults.sort((a, b) => b.matchScore - a.matchScore);

    return matchResults.slice(0, limit);
  } catch (error) {
    console.error('Error finding top candidates:', error);
    return [];
  }
}

// Tìm top jobs phù hợp với candidate
export async function findTopJobsForCandidate(
  candidateId: string,
  limit: number = 10
): Promise<MatchResult[]> {
  try {
    // Lấy tất cả jobs
    const { data: jobs, error } = await supabase
      .from('cv_jobs')
      .select('id, title')
      .eq('status', 'Open'); // Chỉ lấy jobs đang mở

    if (error) throw error;
    if (!jobs) return [];

    // Tính match score cho từng job
    const matchResults: MatchResult[] = [];
    
    for (const job of jobs) {
      const result = await calculateJobMatch(candidateId, job.id);
      if (result && result.matchScore > 0) {
        matchResults.push(result);
      }
    }

    // Sắp xếp theo match score giảm dần
    matchResults.sort((a, b) => b.matchScore - a.matchScore);

    return matchResults.slice(0, limit);
  } catch (error) {
    console.error('Error finding top jobs:', error);
    return [];
  }
}