// lib/activityLogger.ts
import { supabase } from '@/lib/supabaseClient';

/**
 * Activity Logger Utility
 * Centralized logging for all user activities in the CV management system
 */

export type EntityType = 'cv' | 'job' | 'interview' | 'email' | 'evaluation' | 'general';

interface LogActivityParams {
  action: string;
  details?: string;
  entity_type?: EntityType;
  entity_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Main logging function - calls Supabase RPC
 */
export const logActivity = async ({
  action,
  details = '',
  entity_type = 'general',
  entity_id,
  metadata = {}
}: LogActivityParams): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('log_activity', {
      p_action: action,
      p_details: details,
      p_entity_type: entity_type,
      p_entity_id: entity_id,
      p_metadata: metadata
    });

    if (error) {
      console.error('Failed to log activity:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error logging activity:', error);
    return null;
  }
};

/**
 * Get recent activities for dashboard
 */
export const getRecentActivities = async (limit = 10, offset = 0) => {
  try {
    const { data, error } = await supabase.rpc('get_recent_activities', {
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error('Failed to get activities:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting activities:', error);
    return [];
  }
};

/**
 * Predefined logging functions for common activities
 */
export const ActivityLogger = {
  // ==================== CV ACTIVITIES ====================
  
  /**
   * Log when a candidate submits a CV
   */
  logCVSubmitted: async (
    candidateName: string,
    candidateId: string,
    jobTitle?: string
  ) => {
    return logActivity({
      action: 'Nộp CV mới',
      details: jobTitle 
        ? `Ứng viên ${candidateName} đã nộp CV cho vị trí ${jobTitle}`
        : `Ứng viên ${candidateName} đã nộp CV`,
      entity_type: 'cv',
      entity_id: candidateId
    });
  },

  /**
   * Log when a CV is viewed
   */
  logCVViewed: async (candidateName: string, candidateId: string) => {
    return logActivity({
      action: 'Xem CV',
      details: `Xem CV của ứng viên ${candidateName}`,
      entity_type: 'cv',
      entity_id: candidateId
    });
  },

  /**
   * Log when a CV is deleted
   */
  logCVDeleted: async (candidateName: string) => {
    return logActivity({
      action: 'Xóa CV',
      details: `Xóa CV của ứng viên ${candidateName}`,
      entity_type: 'cv'
    });
  },

  /**
   * Log when a CV is analyzed
   */
  logCVAnalyzed: async (
    candidateName: string,
    candidateId: string,
    score?: number
  ) => {
    return logActivity({
      action: 'Phân tích CV',
      details: score
        ? `Phân tích CV của ${candidateName} - Điểm: ${score}/100`
        : `Phân tích CV của ${candidateName}`,
      entity_type: 'cv',
      entity_id: candidateId,
      metadata: { score }
    });
  },

  // ==================== JOB ACTIVITIES ====================
  
  /**
   * Log when a new job position is created
   */
  logJobCreated: async (jobTitle: string, jobId: string) => {
    return logActivity({
      action: 'Tạo vị trí tuyển dụng mới',
      details: `Vị trí: ${jobTitle}`,
      entity_type: 'job',
      entity_id: jobId
    });
  },

  /**
   * Log when a job is updated
   */
  logJobUpdated: async (jobTitle: string, jobId: string) => {
    return logActivity({
      action: 'Cập nhật vị trí tuyển dụng',
      details: `Cập nhật vị trí: ${jobTitle}`,
      entity_type: 'job',
      entity_id: jobId
    });
  },

  /**
   * Log when a job is deleted
   */
  logJobDeleted: async (jobTitle: string) => {
    return logActivity({
      action: 'Xóa vị trí tuyển dụng',
      details: `Xóa vị trí: ${jobTitle}`,
      entity_type: 'job'
    });
  },

  // ==================== INTERVIEW ACTIVITIES ====================
  
  /**
   * Log when an interview is scheduled
   */
  logInterviewScheduled: async (
    candidateName: string,
    interviewId: string,
    interviewDate: string
  ) => {
    return logActivity({
      action: 'Tạo lịch phỏng vấn',
      details: `Phỏng vấn ứng viên ${candidateName} vào ${interviewDate}`,
      entity_type: 'interview',
      entity_id: interviewId
    });
  },

  /**
   * Log when an interview is cancelled
   */
  logInterviewCancelled: async (
    candidateName: string,
    interviewId: string
  ) => {
    return logActivity({
      action: 'Hủy lịch phỏng vấn',
      details: `Hủy lịch phỏng vấn với ${candidateName}`,
      entity_type: 'interview',
      entity_id: interviewId
    });
  },

  /**
   * Log when an interview is completed
   */
  logInterviewCompleted: async (
    candidateName: string,
    interviewId: string
  ) => {
    return logActivity({
      action: 'Hoàn thành phỏng vấn',
      details: `Hoàn thành buổi phỏng vấn với ${candidateName}`,
      entity_type: 'interview',
      entity_id: interviewId
    });
  },

  // ==================== EVALUATION ACTIVITIES ====================
  
  /**
   * Log when a candidate is evaluated
   */
  logCandidateEvaluated: async (
    candidateName: string,
    candidateId: string,
    rating: number
  ) => {
    return logActivity({
      action: 'Đánh giá ứng viên',
      details: `Đánh giá ${candidateName} - ${rating}/5 sao`,
      entity_type: 'evaluation',
      entity_id: candidateId,
      metadata: { rating }
    });
  },

  // ==================== EMAIL ACTIVITIES ====================
  
  /**
   * Log when an email is sent
   */
  logEmailSent: async (
    recipientName: string,
    subject: string,
    entityId?: string
  ) => {
    return logActivity({
      action: 'Gửi email',
      details: `Gửi email "${subject}" đến ${recipientName}`,
      entity_type: 'email',
      entity_id: entityId
    });
  },

  // ==================== CUSTOM ACTIVITY ====================
  
  /**
   * Log a custom activity
   */
  logCustomActivity: async (
    action: string,
    details: string,
    entityType: EntityType = 'general',
    entityId?: string,
    metadata?: Record<string, any>
  ) => {
    return logActivity({
      action,
      details,
      entity_type: entityType,
      entity_id: entityId,
      metadata
    });
  }
};

// Export default
export default ActivityLogger;