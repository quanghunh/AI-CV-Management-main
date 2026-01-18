import type { User } from '@supabase/supabase-js';

export interface ExtendedUser extends User {
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
}

// Sử dụng trong các file khác
// import { ExtendedUser } from '@/types/supabase';

// Khi dùng user
// const user = userData as ExtendedUser;
// const fullName = user.user_metadata?.full_name;