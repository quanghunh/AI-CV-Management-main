// src/hooks/useCandidates.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { saveCandidateSkills } from '@/utils/skillsHelper';
import type { ParsedCV } from '@/utils/cvParser';

export interface Candidate {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone_number?: string;
  status: string;
  source: string;
  address?: string;
  university?: string;
  experience?: string;
  education?: string;
  cv_url?: string;
  cv_file_name?: string;
  cv_parsed_data?: ParsedCV;
  cv_jobs: {
    title: string;
    level: string;
  } | null;
  cv_candidate_skills?: {
    cv_skills: {
      id: string;
      name: string;
      category?: string;
    }
  }[];
}

export interface CandidateFormData {
  full_name: string;
  email: string;
  phone_number: string;
  job_id: string;
  address: string;
  experience: string;
  education: string;
  university: string;
  status: string;
  source: string;
  skills: string[];
}

export function useCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cv_candidates')
        .select(`
          *,
          cv_jobs ( title, level ),
          cv_candidate_skills ( 
            cv_skills ( id, name, category )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setCandidates(data as Candidate[]);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCandidate = async (
    formData: CandidateFormData,
    cvFile?: File,
    parsedData?: ParsedCV
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      let cvUrl = null;
      let cvFileName = null;

      // Upload CV if provided
      if (cvFile) {
        const fileExt = cvFile.name.split('.').pop();
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const fileName = `${timestamp}_${randomStr}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('cv-files')
          .upload(fileName, cvFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error('Lỗi upload CV: ' + uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from('cv-files')
          .getPublicUrl(fileName);

        cvUrl = urlData.publicUrl;
        cvFileName = cvFile.name;
      }

      // Insert candidate
      const { data, error } = await supabase
        .from('cv_candidates')
        .insert([
          {
            full_name: formData.full_name,
            email: formData.email,
            phone_number: formData.phone_number || null,
            job_id: formData.job_id,
            address: formData.address || null,
            experience: formData.experience || null,
            education: formData.education || null,
            university: formData.university || null,
            status: formData.status,
            source: formData.source || null,
            cv_url: cvUrl,
            cv_file_name: cvFileName,
            cv_parsed_data: parsedData
          }
        ])
        .select(`
          *,
          cv_jobs ( title, level )
        `);

      if (error) throw error;

      if (data && data[0]) {
        const candidateId = data[0].id;

        // Save skills
        if (formData.skills.length > 0) {
          await saveCandidateSkills(candidateId, formData.skills);
        }

        // Fetch complete candidate data
        const { data: completeData } = await supabase
          .from('cv_candidates')
          .select(`
            *,
            cv_jobs ( title, level ),
            cv_candidate_skills ( 
              cv_skills ( id, name, category )
            )
          `)
          .eq('id', candidateId)
          .single();

        if (completeData) {
          setCandidates(prev => [completeData as Candidate, ...prev]);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error adding candidate:', error);
      return { success: false, error: error.message };
    }
  };

  const updateCandidate = async (
    candidateId: string,
    formData: CandidateFormData
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('cv_candidates')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone_number: formData.phone_number || null,
          address: formData.address || null,
          experience: formData.experience || null,
          education: formData.education || null,
          university: formData.university || null,
          status: formData.status,
          source: formData.source || null,
        })
        .eq('id', candidateId);

      if (error) throw error;

      // Update skills
      await saveCandidateSkills(candidateId, formData.skills);

      // Fetch complete data
      const { data: completeData } = await supabase
        .from('cv_candidates')
        .select(`
          *,
          cv_jobs ( title, level ),
          cv_candidate_skills ( 
            cv_skills ( id, name, category )
          )
        `)
        .eq('id', candidateId)
        .single();

      if (completeData) {
        setCandidates(prev =>
          prev.map(c => (c.id === candidateId ? completeData as Candidate : c))
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error updating candidate:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteCandidate = async (
    candidateId: string,
    cvUrl?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Delete CV file from storage
      if (cvUrl) {
        const fileName = cvUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('cv-files').remove([fileName]);
        }
      }

      // Delete candidate (cascade will handle skills)
      const { error } = await supabase
        .from('cv_candidates')
        .delete()
        .eq('id', candidateId);

      if (error) throw error;

      setCandidates(prev => prev.filter(c => c.id !== candidateId));

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting candidate:', error);
      return { success: false, error: error.message };
    }
  };

  const getCandidateById = async (
    candidateId: string
  ): Promise<Candidate | null> => {
    try {
      const { data, error } = await supabase
        .from('cv_candidates')
        .select(`
          *,
          cv_jobs ( title, level ),
          cv_candidate_skills ( 
            cv_skills ( id, name, category )
          )
        `)
        .eq('id', candidateId)
        .single();

      if (error) throw error;
      return data as Candidate;
    } catch (error) {
      console.error('Error fetching candidate:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  return {
    candidates,
    loading,
    fetchCandidates,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    getCandidateById,
  };
}