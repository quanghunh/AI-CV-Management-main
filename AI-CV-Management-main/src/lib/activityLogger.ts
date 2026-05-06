/**
 * activityLogger.ts
 * 
 * Ghi nhận hoạt động của người dùng vào bảng activity_logs.
 * - Tự động lấy tên và ID của user đang đăng nhập từ localStorage/session
 * - Hỗ trợ metadata tùy chỉnh
 * - Logs được tự động xóa sau 30 ngày (qua DB trigger)
 */

import { supabase } from '@/lib/supabaseClient';

export interface ActivityLogEntry {
  user_name: string;
  user_id?: string;
  action: string;
  details?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Lấy thông tin user đang đăng nhập từ Supabase Auth session.
 * Fallback về localStorage nếu không có session.
 */
async function getCurrentUserInfo(): Promise<{ name: string; id?: string }> {
  try {

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {

      const { data: profile } = await supabase
        .from('cv_profiles')
        .select('id, full_name, email')
        .eq('auth_user_id', user.id)
        .single();

      if (profile) {
        return {
          name: profile.full_name || profile.email || user.email || 'Unknown',
          id: profile.id,
        };
      }

      return { name: user.email || 'Unknown', id: user.id };
    }
  } catch {

  }

  try {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        name: parsed.name || parsed.full_name || parsed.email || 'System',
        id: parsed.id,
      };
    }
  } catch {

  }

  return { name: 'System' };
}

/**
 * Ghi một activity log vào database.
 * Tự động lấy user hiện tại nếu không truyền vào.
 * Không throw error — luôn fail silently để không ảnh hưởng UX.
 */
async function log(entry: ActivityLogEntry): Promise<void> {
  try {

    let userName = entry.user_name;
    let userId = entry.user_id;

    if (!userName || userName === 'System') {
      const currentUser = await getCurrentUserInfo();
      userName = entry.user_name && entry.user_name !== 'System'
        ? entry.user_name
        : currentUser.name;
      userId = entry.user_id || currentUser.id;
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_name:   userName,
      user_id:     userId || null,
      action:      entry.action,
      details:     entry.details || null,
      entity_type: entry.entity_type || null,
      entity_id:   entry.entity_id || null,
      metadata:    entry.metadata || {},
    });

    if (error) {
      console.warn('[ActivityLogger] Insert error:', error.message);
    }
  } catch (err) {

    console.warn('[ActivityLogger] Failed to log activity:', err);
  }
}

export const ActivityLogger = {

  /** Ứng viên nộp CV */
  async logCVSubmitted(
    candidateName: string,
    candidateId: string,
    jobTitle?: string
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Nộp CV',
      details:     jobTitle
        ? `${candidateName} ứng tuyển vị trí: ${jobTitle}`
        : `${candidateName} nộp CV`,
      entity_type: 'cv',
      entity_id:   candidateId,
      metadata:    { candidate_name: candidateName, job_title: jobTitle },
    });
  },

  /** Xem thông tin CV */
  async logCVViewed(
    candidateName: string,
    candidateId: string
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Xem CV',
      details:     `Xem hồ sơ: ${candidateName}`,
      entity_type: 'cv',
      entity_id:   candidateId,
      metadata:    { candidate_name: candidateName },
    });
  },

  /** Xóa CV */
  async logCVDeleted(candidateName: string): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Xóa ứng viên',
      details:     `Đã xóa hồ sơ: ${candidateName}`,
      entity_type: 'cv',
      metadata:    { candidate_name: candidateName },
    });
  },

  /** Tạo JD mới */
  async logJobCreated(jobTitle: string, jobId: string): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Tạo công việc',
      details:     `Tạo JD mới: ${jobTitle}`,
      entity_type: 'job',
      entity_id:   jobId,
      metadata:    { job_title: jobTitle },
    });
  },

  /** Cập nhật JD */
  async logJobUpdated(jobTitle: string, jobId: string): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Cập nhật công việc',
      details:     `Cập nhật JD: ${jobTitle}`,
      entity_type: 'job',
      entity_id:   jobId,
      metadata:    { job_title: jobTitle },
    });
  },

  /** Xóa JD */
  async logJobDeleted(jobTitle: string): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Xóa công việc',
      details:     `Đã xóa JD: ${jobTitle}`,
      entity_type: 'job',
      metadata:    { job_title: jobTitle },
    });
  },

  /** Tạo lịch phỏng vấn */
  async logInterviewCreated(
    candidateName: string,
    interviewId: string,
    interviewDate: string
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Tạo phỏng vấn',
      details:     `Lịch phỏng vấn: ${candidateName} - ${new Date(interviewDate).toLocaleString('vi-VN')}`,
      entity_type: 'interview',
      entity_id:   interviewId,
      metadata:    { candidate_name: candidateName, interview_date: interviewDate },
    });
  },

  /** Đánh giá phỏng vấn */
  async logInterviewReviewed(
    candidateName: string,
    interviewId: string,
    outcome: string,
    rating: number
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Đánh giá phỏng vấn',
      details:     `Đánh giá ${candidateName}: ${outcome} (${rating}⭐)`,
      entity_type: 'interview',
      entity_id:   interviewId,
      metadata:    { candidate_name: candidateName, outcome, rating },
    });
  },

  /** Tạo người dùng mới */
  async logUserCreated(
    newUserName: string,
    newUserEmail: string,
    newUserId: string
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Tạo người dùng',
      details:     `Tạo tài khoản: ${newUserName} (${newUserEmail})`,
      entity_type: 'user',
      entity_id:   newUserId,
      metadata:    { new_user_name: newUserName, new_user_email: newUserEmail },
    });
  },

  /** Cập nhật người dùng */
  async logUserUpdated(
    targetUserName: string,
    targetUserId: string
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Cập nhật người dùng',
      details:     `Cập nhật tài khoản: ${targetUserName}`,
      entity_type: 'user',
      entity_id:   targetUserId,
      metadata:    { target_user_name: targetUserName },
    });
  },

  /** Xóa người dùng */
  async logUserDeleted(
    targetUserName: string,
    targetUserEmail: string
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Xóa người dùng',
      details:     `Xóa tài khoản: ${targetUserName} (${targetUserEmail})`,
      entity_type: 'user',
      metadata:    { target_user_name: targetUserName, target_user_email: targetUserEmail },
    });
  },

  /** Đăng nhập */
  async logLogin(userName: string, userId?: string): Promise<void> {
    return log({
      user_name:   userName,
      user_id:     userId,
      action:      'Đăng nhập',
      details:     `${userName} đăng nhập vào hệ thống`,
      entity_type: 'auth',
      metadata:    { timestamp: new Date().toISOString() },
    });
  },

  /** Gửi email */
  async logEmailSent(
    recipientName: string,
    recipientEmail: string,
    subject: string
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Gửi email',
      details:     `Gửi email đến ${recipientName} (${recipientEmail}): ${subject}`,
      entity_type: 'email',
      metadata:    { recipient_name: recipientName, recipient_email: recipientEmail, subject },
    });
  },

  /** Thêm vai trò mới */
  async logRoleCreated(roleName: string): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Tạo vai trò',
      details:     `Tạo vai trò mới: ${roleName}`,
      entity_type: 'role',
      metadata:    { role_name: roleName },
    });
  },

  /** Cập nhật phân quyền */
  async logPermissionsUpdated(roleName: string): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action:      'Cập nhật phân quyền',
      details:     `Cập nhật quyền cho vai trò: ${roleName}`,
      entity_type: 'permission',
      metadata:    { role_name: roleName },
    });
  },

  /** Ghi log tùy chỉnh */
  async logCustomActivity(
    action: string,
    details?: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const user = await getCurrentUserInfo();
    return log({
      user_name:   user.name,
      user_id:     user.id,
      action,
      details,
      entity_type: entityType,
      entity_id:   entityId,
      metadata,
    });
  },
};

/**
 * Lấy logs gần đây (trong 30 ngày, tối đa maxRows records).
 * Dùng trong DashboardPage để hiển thị.
 */
export async function fetchRecentActivities(
  maxRows = 20,
  filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
  }
): Promise<{
  id: string;
  user_name: string;
  user_id?: string;
  action: string;
  details: string | null;
  entity_type: string | null;
  created_at: string;
  metadata?: Record<string, any>;
}[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabase
    .from('activity_logs')
    .select('id, user_name, user_id, action, details, entity_type, created_at, metadata')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(maxRows);

  if (filters?.userId) query = query.eq('user_id', filters.userId);
  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.entityType) query = query.eq('entity_type', filters.entityType);

  const { data, error } = await query;
  if (error) {
    console.warn('[ActivityLogger] fetchRecentActivities error:', error.message);
    return [];
  }
  return (data || []) as any[];
}

/**
 * Xóa thủ công các logs cũ hơn 30 ngày.
 * Gọi từ admin panel nếu cần.
 */
export async function cleanupOldLogs(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('activity_logs')
    .delete()
    .lt('created_at', thirtyDaysAgo.toISOString())
    .select('*');

  if (error) {
    console.warn('[ActivityLogger] cleanupOldLogs error:', error.message);
    return 0;
  }
  return data ? data.length : 0;
}

export default ActivityLogger;