// src/hooks/useActivityLogger.ts
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export const useActivityLogger = () => {
  const { user } = useAuth();

  const logActivity = async (action: string, details?: string) => {
    try {
      if (!user) {
        console.warn('User is not authenticated');
        return;
      }

      const userName = (user as any).user_metadata?.full_name || user.email;
      
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: userName,
        action,
        details,
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  return { logActivity };
};