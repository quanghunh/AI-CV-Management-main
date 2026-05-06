import type { User } from '@supabase/supabase-js';

export interface ExtendedUser extends User {
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
}
