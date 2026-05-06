
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const COMPANY_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

export interface CompanyProfile {
  id?: string;
  company_name?: string;
  website?: string;
  company_description?: string;
  company_address?: string;
  contact_email?: string;
  logo_url?: string;
}

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();

    const channel = supabase
      .channel('company_profile_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cv_company_profile',
          filter: `id=eq.${COMPANY_PROFILE_ID}`
        },
        (payload) => {
          if (payload.new) {
            setProfile(payload.new as CompanyProfile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cv_company_profile')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading company profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in loadProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, refetch: loadProfile };
}