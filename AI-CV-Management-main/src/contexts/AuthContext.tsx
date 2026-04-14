"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type SignUpOptions = {
  data?: {
    full_name?: string;
  }
};

type CustomUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  authenticated_at?: string;
  isCustomAuth: true;
};

type AuthContextType = {
  user: User | CustomUser | null;
  profile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  setProfile: (p: any) => void;
  signUp: (email: string, password: string, options?: SignUpOptions) => Promise<any>;
  updateProfile: (data: any) => Promise<any>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTO_LOGOUT_DELAY_MS = 5 * 60 * 1000;
const LAST_ACTIVE_KEY = 'last_active_at';

const getLastActiveAt = () => {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
};

const updateLastActiveAt = () => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
};

const clearLastActiveAt = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LAST_ACTIVE_KEY);
};

const isBrowserSessionExpired = () => {
  const lastActiveAt = getLastActiveAt();
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt > AUTO_LOGOUT_DELAY_MS;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | CustomUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  const initialized = useRef(false);
  const userRef = useRef<User | CustomUser | null>(null);
  const authTypeRef = useRef<'custom' | 'supabase' | null>(null);
  const isSigningInRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => updateLastActiveAt();
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    events.forEach(eventName => window.addEventListener(eventName, update));
    window.addEventListener('beforeunload', update);

    return () => {
      events.forEach(eventName => window.removeEventListener(eventName, update));
      window.removeEventListener('beforeunload', update);
    };
  }, []);

  const fetchProfileByAuthId = async (authUserId: string) => {
    try {
      console.log("📋 Fetching profile by auth_user_id:", authUserId);
      
      const { data: prof, error } = await supabase
        .from("cv_profiles")
        .select(`
          *,
          cv_user_roles (
            role_id,
            cv_roles (
              name
            )
          )
        `)
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      
      if (error) {
        console.error("❌ Profile fetch error:", error);
        return null;
      }
      
      console.log("✅ Profile found:", prof ? "Yes" : "No");
      return prof || null;
    } catch (err) {
      console.error("❌ Profile fetch exception:", err);
      return null;
    }
  };

  const fetchProfileById = async (userId: string) => {
    try {
      console.log("📋 Fetching profile by id:", userId);
      
      const { data: prof, error } = await supabase
        .from("cv_profiles")
        .select(`
          *,
          cv_user_roles (
            role_id,
            cv_roles (
              name
            )
          )
        `)
        .eq("id", userId)
        .maybeSingle();
      
      if (error) {
        console.error("❌ Profile fetch error:", error);
        return null;
      }
      
      console.log("✅ Profile found:", prof ? "Yes" : "No", prof);
      return prof || null;
    } catch (err) {
      console.error("❌ Profile fetch exception:", err);
      return null;
    }
  };

  const createProfile = async (authUserId: string, email: string, fullName?: string) => {
    try {
      console.log("📝 Creating new profile for:", email);
      
      const { data: newProfile, error } = await supabase
        .from("cv_profiles")
        .insert([
          {
            auth_user_id: authUserId,
            email: email,
            full_name: fullName || '',
            role: 'candidate',
            status: 'active'
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error("❌ Profile creation error:", error);
        throw error;
      }
      
      console.log("✅ Profile created successfully");
      return newProfile;
    } catch (err) {
      console.error("❌ Profile creation exception:", err);
      throw err;
    }
  };

  const clearAuthState = () => {
    console.log("🧹 Clearing all auth state...");
    
    setUser(null);
    setProfile(null);
    userRef.current = null;
    authTypeRef.current = null;
    isSigningInRef.current = false;
    
    localStorage.removeItem('user_session');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem(LAST_ACTIVE_KEY);
    sessionStorage.removeItem('tab_initialized');
    
    console.log("✅ Auth state cleared");
  };

  const clearAuthSessionWithTimeout = async () => {
    console.log("⏰ Checking browser auto-logout timeout...");
    if (!isBrowserSessionExpired()) return false;
    console.log("🛑 Browser session expired after browser closed for more than 5 minutes");
    clearAuthState();
    try {
      await supabase.auth.signOut();
      console.log("✅ Supabase session cleared due to timeout");
    } catch (err) {
      console.warn("⚠️ Error clearing Supabase session after timeout:", err);
    }
    return true;
  };

  // 🔧 CRITICAL FIX: Improved auth initialization
  useEffect(() => {
    if (initialized.current) {
      console.log("⏭️ Auth already initialized, skipping");
      return;
    }
    initialized.current = true;

    let mounted = true;

    const initAuth = async () => {
      try {
        console.log("🔐 Initializing auth...");
        
        // Skip if signing in
        if (isSigningInRef.current) {
          console.log("⏭️ Sign-in in progress, skipping init");
          if (mounted) setLoading(false);
          return;
        }
        
        // STEP 1: Check custom session FIRST
        const customSession = localStorage.getItem('user_session');
        const isAuthenticated = localStorage.getItem('is_authenticated');

        if (customSession && isAuthenticated === 'true') {
          if (isBrowserSessionExpired()) {
            console.log('🛑 Browser auto-logout triggered before custom session restore');
            clearAuthState();
            setLoading(false);
            return;
          }

          try {
            const userData = JSON.parse(customSession);
            console.log('🔍 Found custom session for:', userData.email);
            
            // Verify session validity
            const prof = await fetchProfileById(userData.id);
            
            if (prof && prof.status === 'active') {
              if (!mounted) return;
              
              const customUser: CustomUser = {
                ...userData,
                isCustomAuth: true
              };
              
              setUser(customUser);
              setProfile(prof);
              userRef.current = customUser;
              authTypeRef.current = 'custom';
              updateLastActiveAt();
              
              console.log("✅ Custom auth session restored");
              
              // 🔧 KEY FIX: Set loading false immediately for custom auth
              setLoading(false);
              return;
            } else {
              console.warn('⚠️ Custom session invalid, clearing...');
              clearAuthState();
            }
          } catch (err) {
            console.error('❌ Custom session parse error:', err);
            clearAuthState();
          }
        }

        await clearAuthSessionWithTimeout();
        
        // STEP 2: Check Supabase Auth session
        console.log('🔍 Checking Supabase Auth session...');
        
        // 🔧 KEY FIX: Use getSession() with proper timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 3000)
        );
        
        try {
          const { data: { session }, error } = await Promise.race([
            sessionPromise,
            timeoutPromise
          ]) as any;
          
          if (error) {
            console.error("❌ Session error:", error);
          }
          
          if (!mounted) return;

          if (session?.user) {
            console.log("✅ Supabase session found:", session.user.email);
            setUser(session.user);
            userRef.current = session.user;
            authTypeRef.current = 'supabase';
            updateLastActiveAt();
            
            // 🔧 KEY FIX: Set loading false BEFORE fetching profile
            setLoading(false);
            
            // Fetch profile in background (non-blocking)
            fetchProfileByAuthId(session.user.id)
              .then(prof => {
                if (mounted) {
                  setProfile(prof);
                  console.log("✅ Profile loaded");
                }
              })
              .catch(err => {
                console.error("❌ Profile fetch error:", err);
              });
          } else {
            console.log("ℹ️ No session found");
            setUser(null);
            setProfile(null);
            userRef.current = null;
            authTypeRef.current = null;
            
            // 🔧 KEY FIX: Always set loading false
            setLoading(false);
          }
        } catch (timeoutError) {
          console.warn("⚠️ Session check timed out, proceeding without session");
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        }
        
      } catch (err) {
        console.error("❌ Auth init error:", err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // 🔧 KEY FIX: Remove timeout, rely on internal promise timeout
    initAuth();

    // Listen to Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔄 Supabase Auth event:", event);

        if (!mounted) return;

        // Ignore events during sign-in
        if (isSigningInRef.current) {
          console.log("⏭️ Ignoring event during sign-in");
          return;
        }

        // Ignore Supabase events if using custom auth
        if (authTypeRef.current === 'custom') {
          console.log("⏭️ Ignoring Supabase event - using custom auth");
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          if (userRef.current && userRef.current.id === session.user.id) {
            console.log("⏭️ User already signed in, skipping");
            return;
          }
          
          console.log("✅ User signed in via event");
          setUser(session.user);
          userRef.current = session.user;
          authTypeRef.current = 'supabase';
          
          // Fetch profile in background
          fetchProfileByAuthId(session.user.id)
            .then(prof => {
              if (mounted) setProfile(prof);
            })
            .catch(err => {
              console.error("❌ Profile fetch error:", err);
            });
          
          // Ensure loading is false
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          if (authTypeRef.current === 'supabase') {
            console.log("👋 User signed out");
            clearAuthState();
            setLoading(false);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log("🔄 Token refreshed");
        } else if (event === 'USER_UPDATED') {
          console.log("👤 User updated");
          if (session?.user && authTypeRef.current === 'supabase') {
            setUser(session.user);
            userRef.current = session.user;
          }
        }
      }
    );

    return () => {
      console.log("🧹 Cleaning up AuthProvider");
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log("🔑 Attempting sign in:", email);
    
    isSigningInRef.current = true;
    
    try {
      // STEP 1: Try custom authentication
      console.log("🔍 Trying custom authentication...");
      
      const { data: authData, error: customAuthError } = await supabase.rpc('authenticate_user', {
        p_email: email.trim(),
        p_password: password
      });

      if (!customAuthError && authData && authData.length > 0) {
        const authenticatedUser = authData[0];
        console.log("✅ Custom auth successful:", authenticatedUser.email);
        
        if (authenticatedUser.status !== 'active') {
          return { 
            data: null, 
            error: { message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ Admin.' }
          };
        }

        // Sign out from Supabase Auth
        try {
          await supabase.auth.signOut({ scope: 'local' });
          console.log("✅ Cleared Supabase session");
        } catch (signOutError) {
          console.warn("⚠️ Error clearing Supabase session:", signOutError);
        }

        // Fetch profile
        const prof = await fetchProfileById(authenticatedUser.user_id);

        const userData: CustomUser = {
          id: authenticatedUser.user_id,
          email: authenticatedUser.email,
          full_name: authenticatedUser.full_name,
          role: authenticatedUser.role_name?.toUpperCase() || 'USER',
          status: authenticatedUser.status,
          authenticated_at: new Date().toISOString(),
          isCustomAuth: true
        };

        // Set state
        setUser(userData);
        setProfile(prof);
        userRef.current = userData;
        authTypeRef.current = 'custom';
        updateLastActiveAt();

        // Save to localStorage
        localStorage.setItem('user_session', JSON.stringify(userData));
        localStorage.setItem('is_authenticated', 'true');

        console.log("✅ Custom auth complete");
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return { data: { user: userData, session: null }, error: null };
      }

      // STEP 2: Fallback to Supabase Auth
      console.log("🔍 Trying Supabase Auth...");
      
      const result = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      if (result.error) {
        console.error("❌ All sign in methods failed");
        return { data: null, error: { message: 'Email hoặc mật khẩu không chính xác' } };
      }
      
      console.log("✅ Supabase Auth successful");
      
      authTypeRef.current = 'supabase';
      setUser(result.data.user);
      userRef.current = result.data.user;
      updateLastActiveAt();
      
      // Fetch profile
      fetchProfileByAuthId(result.data.user.id)
        .then(prof => setProfile(prof))
        .catch(err => console.error("❌ Profile fetch error:", err));
      
      return { data: result.data, error: null };
      
    } catch (err) {
      console.error("❌ Sign in exception:", err);
      return { 
        data: null, 
        error: { message: err instanceof Error ? err.message : "Có lỗi xảy ra" }
      };
    } finally {
      isSigningInRef.current = false;
    }
  };

  const signOut = async () => {
    console.log("👋 Signing out");
    
    try {
      const currentAuthType = authTypeRef.current;
      
      if (currentAuthType === 'supabase') {
        console.log("📤 Signing out from Supabase");
        
        try {
          await supabase.auth.signOut();
          console.log("✅ Supabase signed out");
        } catch (supabaseError) {
          console.error("❌ Supabase sign out error:", supabaseError);
        }
      }
      
      clearAuthState();
      
      console.log("✅ Signed out successfully");
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      console.error("❌ Sign out exception:", err);
      clearAuthState();
    }
  };

  const signUp = async (email: string, password: string, options?: SignUpOptions) => {
    try {
      console.log("📝 Signing up:", email);
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: options?.data?.full_name || ''
          }
        }
      });

      if (authError) {
        console.error("❌ Auth sign up error:", authError);
        return { data: null, error: authError };
      }

      if (!authData.user) {
        console.error("❌ No user returned");
        return { data: null, error: new Error("No user returned") };
      }

      console.log("✅ Auth user created:", authData.user.id);

      let existingProfile = await fetchProfileByAuthId(authData.user.id);
      
      if (!existingProfile) {
        try {
          const newProfile = await createProfile(
            authData.user.id,
            email,
            options?.data?.full_name
          );
          existingProfile = newProfile;
        } catch (profileError) {
          console.error("❌ Profile creation failed:", profileError);
        }
      }

      setUser(authData.user);
      setProfile(existingProfile);
      userRef.current = authData.user;
      authTypeRef.current = 'supabase';

      console.log("✅ Sign up complete");
      return { data: authData, error: null };
      
    } catch (err) {
      console.error("❌ Sign up exception:", err);
      return { 
        data: null, 
        error: err instanceof Error ? err : new Error("Unknown error") 
      };
    }
  };

  const updateProfile = async (data: any) => {
    if (!user) {
      console.error("❌ No authenticated user");
      return { error: new Error("No authenticated user") };
    }
    
    console.log("💾 Updating profile for user:", user.id);
    
    try {
      const isCustomAuthUser = 'isCustomAuth' in user && user.isCustomAuth;
      
      const mergedData = {
        ...(isCustomAuthUser ? { id: user.id } : { auth_user_id: user.id }),
        email: user.email || '',
        full_name: data.full_name !== undefined 
          ? data.full_name 
          : (profile?.full_name || ''),
        phone: data.phone !== undefined 
          ? data.phone 
          : (profile?.phone || ''),
        avatar_url: data.avatar_url !== undefined 
          ? data.avatar_url 
          : (profile?.avatar_url || ''),
        updated_at: new Date().toISOString()
      };

      console.log("📦 Merged data for upsert:", mergedData);

      const matchColumn = isCustomAuthUser ? 'id' : 'auth_user_id';

      // Perform a direct UPDATE instead of UPSERT to avoid constraint mismatch errors
      const { data: result, error } = await supabase
        .from("cv_profiles")
        .update({
          email: user.email || '',
          full_name: data.full_name !== undefined ? data.full_name : (profile?.full_name || ''),
          phone: data.phone !== undefined ? data.phone : (profile?.phone || ''),
          avatar_url: data.avatar_url !== undefined ? data.avatar_url : (profile?.avatar_url || '')
        })
        .eq(matchColumn, user.id)
        .select()
        .single();

      if (error) {
        console.error("❌ Update error:", error);
        throw error;
      }

      console.log("✅ Profile updated:", result);
      setProfile(result);
      
      if (isCustomAuthUser) {
        const currentSession = localStorage.getItem('user_session');
        if (currentSession) {
          const sessionData = JSON.parse(currentSession);
          const updatedSession = {
            ...sessionData,
            full_name: result.full_name
          };
          localStorage.setItem('user_session', JSON.stringify(updatedSession));
        }
      }
      
      return { data: result, error: null };
      
    } catch (err) {
      console.error("❌ Update failed:", err);
      return { 
        data: null, 
        error: err instanceof Error ? err : new Error("Unknown error") 
      };
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        profile, 
        loading, 
        signIn, 
        signOut, 
        setProfile, 
        signUp, 
        updateProfile 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};