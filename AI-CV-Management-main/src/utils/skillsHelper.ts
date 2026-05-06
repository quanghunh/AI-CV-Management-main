
import { supabase } from '@/lib/supabaseClient';

export interface Skill {
  id: string;
  name: string;
  category?: string;
}

export interface CandidateSkill {
  skill_id: string;
  proficiency_level?: string;
}

export function parseSkillsString(skillsStr: string): string[] {
  if (!skillsStr) return [];
  return skillsStr
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export async function getOrCreateSkill(skillName: string): Promise<string | null> {
  const trimmedName = skillName.trim();
  if (!trimmedName) return null;

  const { data: existingSkill } = await supabase
    .from('cv_skills')
    .select('id')
    .ilike('name', trimmedName)
    .single();

  if (existingSkill) {
    return existingSkill.id;
  }

  const { data: newSkill, error } = await supabase
    .from('cv_skills')
    .insert({ name: trimmedName })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating skill:', error);
    return null;
  }

  return newSkill?.id || null;
}

export async function saveCandidateSkills(
  candidateId: string, 
  skillNames: string[]
): Promise<boolean> {
  try {

    await supabase
      .from('cv_candidate_skills')
      .delete()
      .eq('candidate_id', candidateId);

    const skillIds: string[] = [];
    for (const skillName of skillNames) {
      const skillId = await getOrCreateSkill(skillName);
      if (skillId) {
        skillIds.push(skillId);
      }
    }

    if (skillIds.length === 0) return true;

    const { error } = await supabase
      .from('cv_candidate_skills')
      .insert(
        skillIds.map(skillId => ({
          candidate_id: candidateId,
          skill_id: skillId
        }))
      );

    if (error) {
      console.error('Error saving candidate skills:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveCandidateSkills:', error);
    return false;
  }
}

export async function getCandidateSkills(candidateId: string): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('cv_candidate_skills')
    .select('cv_skills(id, name, category)')
    .eq('candidate_id', candidateId);

  if (error) {
    console.error('Error fetching candidate skills:', error);
    return [];
  }

  return data?.map((item: any) => item.cv_skills).filter(Boolean) || [];
}

export async function getAllSkills(): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('cv_skills')
    .select('id, name, category')
    .order('name');

  if (error) {
    console.error('Error fetching skills:', error);
    return [];
  }

  return data || [];
}

export async function searchSkills(query: string): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('cv_skills')
    .select('id, name, category')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(10);

  if (error) {
    console.error('Error searching skills:', error);
    return [];
  }

  return data || [];
}