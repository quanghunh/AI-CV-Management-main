import { supabase } from "@/lib/supabaseClient";

export interface CVData {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  position: string;
  experience: string;
  education: string;
  university: string;
  skills: string[];
  score: number;
  status: string;
  match_percentage: number;
  file_name: string;
  file_type: string;
  file_url?: string;
  full_text?: string;
  ai_analysis?: {
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
  };
  created_at?: string;
  updated_at?: string;
}

export type SortOption = "score-desc" | "score-asc" | "match-desc" | "match-asc";

export const cvService = {
  // Lấy tất cả CVs với sorting
  async getAllCVs(sortBy: SortOption = "score-desc"): Promise<CVData[]> {
    let query = supabase.from("cvs").select("*");

    // Apply sorting
    switch (sortBy) {
      case "score-desc":
        query = query.order("score", { ascending: false });
        break;
      case "score-asc":
        query = query.order("score", { ascending: true });
        break;
      case "match-desc":
        query = query.order("match_percentage", { ascending: false });
        break;
      case "match-asc":
        query = query.order("match_percentage", { ascending: true });
        break;
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching CVs:", error);
      throw error;
    }

    return data || [];
  },

  // Lấy CV theo ID
  async getCVById(id: string): Promise<CVData | null> {
    const { data, error } = await supabase
      .from("cvs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching CV:", error);
      throw error;
    }

    return data;
  },

  // Lấy CVs theo status
  async getCVsByStatus(status: string): Promise<CVData[]> {
    const { data, error } = await supabase
      .from("cvs")
      .select("*")
      .eq("status", status)
      .order("score", { ascending: false });

    if (error) {
      console.error("Error fetching CVs by status:", error);
      throw error;
    }

    return data || [];
  },

  // Lọc CVs theo điểm số
  async getCVsByScoreRange(minScore: number, maxScore: number): Promise<CVData[]> {
    const { data, error } = await supabase
      .from("cvs")
      .select("*")
      .gte("score", minScore)
      .lte("score", maxScore)
      .order("score", { ascending: false });

    if (error) {
      console.error("Error filtering CVs by score:", error);
      throw error;
    }

    return data || [];
  },

  // Thêm CV mới (sau khi parse)
  async createCV(cvData: Omit<CVData, "id" | "created_at" | "updated_at">): Promise<CVData> {
    const { data, error } = await supabase
      .from("cvs")
      .insert([cvData])
      .select()
      .single();

    if (error) {
      console.error("Error creating CV:", error);
      throw error;
    }

    return data;
  },

  // Cập nhật CV
  async updateCV(id: string, cvData: Partial<CVData>): Promise<CVData> {
    const { data, error } = await supabase
      .from("cvs")
      .update({ ...cvData, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating CV:", error);
      throw error;
    }

    return data;
  },

  // Xóa CV
  async deleteCV(id: string): Promise<void> {
    const { error } = await supabase.from("cvs").delete().eq("id", id);

    if (error) {
      console.error("Error deleting CV:", error);
      throw error;
    }
  },

  // Lấy thống kê
  async getStatistics() {
    const { data: allCVs, error } = await supabase.from("cvs").select("score, match_percentage, status");

    if (error) {
      console.error("Error fetching statistics:", error);
      throw error;
    }

    const totalCVs = allCVs?.length || 0;
    const avgScore = allCVs?.reduce((sum, cv) => sum + cv.score, 0) / totalCVs || 0;
    const qualifiedCVs = allCVs?.filter((cv) => cv.score >= 80).length || 0;

    return {
      totalCVs,
      avgScore: Math.round(avgScore * 10) / 10,
      qualifiedCVs,
      avgProcessTime: 2.3,
    };
  },
};