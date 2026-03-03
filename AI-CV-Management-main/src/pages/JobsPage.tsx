"use client"

import { useState, useEffect } from "react"
import { Search, Plus, MoreHorizontal, FileText, CheckCircle, Users, Eye, Edit, Trash2, Share2, Copy, Sparkles, PenTool, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"

// ==================== HELPER FUNCTIONS ====================

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Đã đăng":
      return <Badge className="bg-blue-600 text-white hover:bg-blue-700 border-0">{status}</Badge>
    case "Bản nháp":
      return <Badge className="bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300">{status}</Badge>
    case "Đã đóng":
      return <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-200">{status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ==================== INTERFACES ====================

interface Job {
  id: string;
  created_at: string;
  title: string;
  department: string;
  status: string;
  level: string;
  job_type?: string;
  location?: string;
  work_location?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  mandatory_requirements?: string;
  cv_candidates: { count: number }[];
}

// ==================== AI SERVICE FUNCTIONS ====================

/**
 * Generate job description using AI
 */
async function generateJobDescriptionAI(data: {
  title: string;
  level: string;
  department: string;
  work_location?: string;
  job_type?: string;
  language: string;
  keywords?: string;
}) {
  try {
    console.log('🎯 Calling backend to generate job description...');
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    
    const response = await fetch(`${API_URL}/api/generate-job-description`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    console.log('📥 Backend response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Backend error:', errorData);
      throw new Error(errorData.detail || `Backend error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Job description generated successfully');

    if (result.success && result.data) {
      return result.data;
    }

    throw new Error('Backend không trả về dữ liệu hợp lệ');

  } catch (error) {
    console.error('❌ Lỗi khi gọi backend:', error);
    throw error;
  }
}

/**
 * ✅ NEW FUNCTION - Generate interview questions using AI
 */
async function generateInterviewQuestionsAI(data: {
  job_id: string;
  job_title: string;
  department: string;
  level: string;
  job_type?: string;
  work_location?: string;
  description?: string;
  requirements?: string;
  mandatory_requirements?: string;
  language: string;
}) {
  try {
    console.log('💬 Calling backend to generate interview questions...');
    console.log('📋 Job details:', {
      title: data.job_title,
      department: data.department,
      level: data.level
    });
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    
    const response = await fetch(`${API_URL}/api/generate-interview-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    console.log('📥 Backend response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Backend error:', errorData);
      throw new Error(errorData.detail || `Backend error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Interview questions generated successfully');
    console.log(`📊 Metadata:`, result.metadata);

    if (result.success && result.data) {
      return result.data;
    }

    throw new Error('Backend không trả về dữ liệu hợp lệ');

  } catch (error) {
    console.error('❌ Lỗi khi gọi backend:', error);
    throw error;
  }
}

// ==================== MAIN COMPONENT ====================

export function JobsPage() {
  const { t, i18n } = useTranslation();
  
  // ==================== STATE MANAGEMENT ====================
  
  // Job list states
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCandidatesCount, setTotalCandidatesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAIQuestionsDialogOpen, setIsAIQuestionsDialogOpen] = useState(false);
  const [isCandidatesDialogOpen, setIsCandidatesDialogOpen] = useState(false);
  // Create/Edit form states
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('manual');
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    work_location: '',
    level: 'Mid-level',
    job_type: 'Full-time',
    status: 'Bản nháp',
    description: '',
    requirements: '',
    benefits: '',
    mandatory_requirements: '',
    posted_date: new Date().toISOString().split('T')[0]
  });
  const [editFormData, setEditFormData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiLanguage, setAiLanguage] = useState('vietnamese');
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  
  // Selected job and actions
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // ✅ THÊM STATE CHO DANH SÁCH ỨNG VIÊN
  const [jobCandidates, setJobCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  // ✅ NEW STATES - AI Interview Questions
  const [aiQuestions, setAiQuestions] = useState('');
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [aiQuestionLanguage, setAiQuestionLanguage] = useState<'vietnamese' | 'english'>('vietnamese');

  // ==================== LIFECYCLE HOOKS ====================

  useEffect(() => {
    fetchJobs();
  }, []);

  // ==================== DATA FETCHING ====================

  async function fetchJobs() {
    setLoading(true);
    const { data: jobsData, error: jobsError } = await supabase
      .from('cv_jobs')
      .select('*, cv_candidates(count)')
      .order('created_at', { ascending: false });
    
    if (jobsData) {
      setJobs(jobsData as Job[]);
    }
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
    }

    const { count, error: countError } = await supabase
      .from('cv_candidates')
      .select('*', { count: 'exact', head: true });

    if (count !== null) {
      setTotalCandidatesCount(count);
    }
    if (countError) {
      console.error('Error fetching total candidates count:', countError);
    }

    setLoading(false);
  }
   // ✅ THÊM HÀM MỚI - Fetch candidates cho một job cụ thể
  async function fetchJobCandidates(jobId: string) {
    setLoadingCandidates(true);
  
    try {
    const { data, error } = await supabase
      .from('cv_candidates')
      .select(`
        id,
        full_name,
        email,
        phone_number,
        status,
        created_at,
        address,
        experience,
        education,
        university,
        cv_url,
        cv_file_name,
        cv_candidate_skills (
          cv_skills (
            id,
            name,
            category
          )
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (data) {
      console.log(`✅ Tìm thấy ${data.length} ứng viên cho job này`);
      setJobCandidates(data);
    }
    
    if (error) {
      console.error('Error fetching job candidates:', error);
      alert('❌ Không thể tải danh sách ứng viên');
    }
  } catch (err) {
    console.error('Error:', err);
    alert('❌ Có lỗi xảy ra khi tải danh sách ứng viên');
  } finally {
    setLoadingCandidates(false);
  }
}
  // ==================== FORM HANDLERS ====================

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditInputChange = (field: string, value: string) => {
    setEditFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  // ==================== AI GENERATION HANDLERS ====================

  /**
   * Handle AI Job Description Generation
   */
  const handleAIGenerate = async () => {
    if (!formData.title || !formData.department) {
      alert('❌ Vui lòng điền đầy đủ: Tiêu đề vị trí và Phòng ban');
      return;
    }

    setGeneratingAI(true);

    try {
      const generatedContent = await generateJobDescriptionAI({
        title: formData.title,
        level: formData.level,
        department: formData.department,
        work_location: formData.work_location || 'Remote',
        job_type: formData.job_type || 'Full-time',
        language: aiLanguage,
        keywords: formData.requirements
      });

      setFormData(prev => ({
        ...prev,
        description: generatedContent.description,
        requirements: generatedContent.requirements,
        benefits: generatedContent.benefits,
        mandatory_requirements: generatedContent.mandatory_requirements || ''
      }));

      setActiveTab('manual');
      
      alert('✅ Đã tạo gợi ý JD với AI thành công! Vui lòng kiểm tra và chỉnh sửa nếu cần.');
    } catch (error: any) {
      console.error('AI Generation error:', error);
      alert(`❌ Lỗi khi tạo JD với AI: ${error.message}`);
    } finally {
      setGeneratingAI(false);
    }
  };

  /**
   * ✅ NEW HANDLER - Generate Interview Questions with AI
   */
  const handleGenerateAIQuestions = async (job: Job) => {
    console.log('🎯 Starting interview questions generation for:', job.title);
    
    setSelectedJob(job);
    setIsAIQuestionsDialogOpen(true);
    setGeneratingQuestions(true);
    setAiQuestions('');

    try {
      console.log('📤 Calling AI service with job data...');
      
      // Call AI service with comprehensive job information
      const result = await generateInterviewQuestionsAI({
        job_id: job.id,
        job_title: job.title,
        department: job.department,
        level: job.level,
        job_type: job.job_type || 'Full-time',
        work_location: job.work_location || job.location || 'Remote',
        description: job.description || undefined,
        requirements: job.requirements || undefined,
        mandatory_requirements: job.mandatory_requirements || undefined,
        language: aiQuestionLanguage
      });

      console.log('✅ Questions received from AI');
      setAiQuestions(result.questions);
      
    } catch (error: any) {
      console.error('❌ Error generating AI questions:', error);
      
      // User-friendly error message
      const errorMessage = `Không thể tạo câu hỏi: ${error.message || 'Vui lòng thử lại sau'}`;
      alert(`❌ ${errorMessage}`);
      
      // Set fallback message in dialog
      setAiQuestions(`# ❌ Lỗi tạo câu hỏi\n\n${errorMessage}\n\nVui lòng thử lại hoặc liên hệ quản trị viên nếu lỗi tiếp tục xảy ra.`);
      
    } finally {
      setGeneratingQuestions(false);
      console.log('🏁 Interview questions generation process completed');
    }
  };

  /**
   * Copy AI generated questions to clipboard
   */
  const handleCopyAIQuestions = () => {
    if (!aiQuestions) {
      alert('⚠️ Không có câu hỏi để sao chép');
      return;
    }
    
    navigator.clipboard.writeText(aiQuestions)
      .then(() => {
        alert('✅ Đã sao chép câu hỏi vào clipboard!');
      })
      .catch((err) => {
        console.error('Failed to copy:', err);
        alert('❌ Không thể sao chép. Vui lòng thử lại.');
      });
  };

  // ==================== FORM SUBMISSION ====================

  const handleSubmit = async () => {
    if (!formData.title || !formData.department) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc: Tiêu đề vị trí và Phòng ban');
      return;
    }

    if (activeTab === 'manual') {
      if (!formData.description || !formData.requirements || !formData.benefits) {
        alert('Vui lòng điền đầy đủ: Mô tả công việc, Yêu cầu công việc và Quyền lợi');
        return;
      }
    }

    setIsSubmitting(true);

    // ✅ CHỈ GỬI CÁC FIELD CÓ TRONG DATABASE
    const dataToInsert = {
      title: formData.title,
      department: formData.department,
      location: formData.location || null,
      work_location: formData.work_location || null,
      level: formData.level,
      job_type: formData.job_type,
      status: formData.status,
      description: formData.description || null,
      requirements: formData.requirements || null,
      benefits: formData.benefits || null,
      mandatory_requirements: formData.mandatory_requirements || null,
      posted_date: formData.posted_date
    };

    const { data, error } = await supabase
      .from('cv_jobs')
      .insert([dataToInsert])
      .select();

    if (error) {
      console.error('Error creating job:', error);
      alert(`Có lỗi xảy ra khi tạo JD: ${error.message}`);
    } else {
      alert('✅ Tạo JD thành công!');
      setIsDialogOpen(false);
      setFormData({
        title: '',
        department: '',
        location: '',
        work_location: '',
        level: 'Mid-level',
        job_type: 'Full-time',
        status: 'Bản nháp',
        description: '',
        requirements: '',
        benefits: '',
        mandatory_requirements: '',
        posted_date: new Date().toISOString().split('T')[0]
      });
      fetchJobs();
    }

    setIsSubmitting(false);
  };

  const handleReset = () => {
    setFormData({
      title: '',
      department: '',
      location: '',
      work_location: '',
      level: 'Mid-level',
      job_type: 'Full-time',
      status: 'Bản nháp',
      description: '',
      requirements: '',
      benefits: '',
      mandatory_requirements: '',
      posted_date: new Date().toISOString().split('T')[0]
    });
  };
  // ==================== CRUD OPERATIONS ====================

  const handleViewDetails = (job: Job) => {
    setSelectedJob(job);
    setIsViewDialogOpen(true);
  };
// ✅ THÊM HANDLER MỚI
  const handleViewCandidates = async (job: Job) => {
    console.log('📋 Xem danh sách ứng viên cho:', job.title);
    setSelectedJob(job);
    setIsCandidatesDialogOpen(true);
    await fetchJobCandidates(job.id);
  };
  const handleEdit = (job: Job) => {
    setSelectedJob(job);
    setEditFormData({
      id: job.id,
      title: job.title,
      department: job.department,
      location: job.location || '',
      work_location: job.work_location || '',
      level: job.level,
      job_type: job.job_type || 'Full-time',
      status: job.status,
      description: job.description || '',
      requirements: job.requirements || '',
      benefits: job.benefits || '',
      mandatory_requirements: job.mandatory_requirements || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateJob = async () => {
    if (!editFormData.title || !editFormData.department) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from('cv_jobs')
      .update({
        title: editFormData.title,
        department: editFormData.department,
        location: editFormData.location || null,
        work_location: editFormData.work_location || null,
        level: editFormData.level,
        job_type: editFormData.job_type,
        status: editFormData.status,
        description: editFormData.description || null,
        requirements: editFormData.requirements || null,
        benefits: editFormData.benefits || null,
        mandatory_requirements: editFormData.mandatory_requirements || null
      })
      .eq('id', editFormData.id);

    if (error) {
      console.error('Error updating job:', error);
      alert(`❌ Lỗi: ${error.message}`);
    } else {
      alert('✅ Đã cập nhật Job Description thành công!');
      setIsEditDialogOpen(false);
      setEditFormData(null);
      fetchJobs();
    }

    setIsSubmitting(false);
  };

  const handleCopy = async (job: Job) => {
    const dataToInsert = {
      title: `${job.title} (Copy)`,
      department: job.department,
      location: job.location || null,
      work_location: job.work_location || null,
      level: job.level,
      job_type: job.job_type || 'Full-time',
      status: 'Bản nháp',
      description: job.description || null,
      requirements: job.requirements || null,
      benefits: job.benefits || null,
      mandatory_requirements: job.mandatory_requirements || null,
      posted_date: new Date().toISOString().split('T')[0]
    };

    const { error } = await supabase
      .from('cv_jobs')
      .insert([dataToInsert]);

    if (error) {
      console.error('Error copying job:', error);
      alert(`❌ Lỗi khi sao chép: ${error.message}`);
    } else {
      alert('✅ Đã sao chép Job Description thành công!');
      fetchJobs();
    }
  };

  const handleShare = (job: Job) => {
    const jobUrl = `${window.location.origin}/jobs/${job.id}`;
    navigator.clipboard.writeText(jobUrl);
    alert('✅ Đã sao chép link chia sẻ vào clipboard!');
  };

  const handleDelete = (job: Job) => {
    setSelectedJob(job);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedJob) return;

    setIsDeleting(true);

    const { error } = await supabase
      .from('cv_jobs')
      .delete()
      .eq('id', selectedJob.id);

    if (error) {
      console.error('Error deleting job:', error);
      alert(`❌ Lỗi khi xóa: ${error.message}`);
    } else {
      alert('✅ Đã xóa Job Description thành công!');
      setIsDeleteDialogOpen(false);
      setSelectedJob(null);
      fetchJobs();
    }

    setIsDeleting(false);
  };

  // ==================== FILTERING ====================

  const filteredJobs = jobs.filter((job) => {
    const lowerQuery = searchQuery.toLowerCase();
    const matchesSearch =
      job.title.toLowerCase().includes(lowerQuery) ||
      job.department.toLowerCase().includes(lowerQuery) ||
      (job.level || '').toLowerCase().includes(lowerQuery) ||
      (job.job_type || '').toLowerCase().includes(lowerQuery) ||
      (job.work_location || '').toLowerCase().includes(lowerQuery) ||
      (job.location || '').toLowerCase().includes(lowerQuery);

    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || job.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // ==================== STATISTICS ====================

  const totalJobs = jobs.length;
  const openJobs = jobs.filter(job => job.status === 'Đã đăng' || job.status === 'Published').length;

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gray-50/50 p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Mô tả công việc</h1>
          <p className="text-xs sm:text-sm text-gray-500 truncate">Quản lý và tạo mô tả công việc</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('jobs.createNew')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          <Card className="border-blue-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Tổng JDs</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600"/>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{totalJobs}</div>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span>+2</span>
                <span className="text-gray-500">so với tháng trước</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">JDs đang mở</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600"/>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{openJobs}</div>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span>+50%</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Tổng ứng viên</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600"/>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{totalCandidatesCount}</div>
              <p className="text-xs text-gray-500">+0</p>
            </CardContent>
          </Card>

        </div>

      {/* Jobs Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900">Danh sách JD ({filteredJobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Tìm kiếm theo tiêu đề, phòng ban, vị trí..."
                className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] sm:w-[180px] border-gray-300 text-sm">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent className="min-w-[140px] sm:min-w-[180px] bg-white z-50 shadow-lg border border-gray-200" align="start" sideOffset={4}>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="Đã đăng">Đã xuất bản</SelectItem>
                  <SelectItem value="Bản nháp">Bản nháp</SelectItem>
                  <SelectItem value="Đã đóng">Đã đóng</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[140px] sm:w-[180px] border-gray-300 text-sm">
                  <SelectValue placeholder="Phòng ban" />
                </SelectTrigger>
                <SelectContent className="min-w-[140px] sm:min-w-[180px] bg-white z-50 shadow-lg border border-gray-200" align="start" sideOffset={4}>
                  <SelectItem value="all">Tất cả phòng ban</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="Product">Product</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Desktop Table View - shows only on desktop (sm and up) */}
          <div className="hidden sm:block border rounded-lg border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-gray-700 font-medium">Vị trí</TableHead>
                  <TableHead className="text-gray-700 font-medium">Phòng ban</TableHead>
                  <TableHead className="text-gray-700 font-medium">Địa điểm</TableHead>
                  <TableHead className="text-gray-700 font-medium">Trạng thái</TableHead>
                  <TableHead className="text-gray-700 font-medium">Ứng viên</TableHead>
                  <TableHead className="text-gray-700 font-medium">Ngày tạo</TableHead>
                  <TableHead className="text-right text-gray-700 font-medium">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-gray-500">
                      Đang tải dữ liệu...
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-gray-500">
                      Chưa có JD nào. Hãy tạo JD đầu tiên!
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow key={job.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium text-gray-900">{job.title}</div>
                        <div className="text-sm text-gray-500">{job.level} • {job.job_type || 'Full-time'}</div>
                      </TableCell>
                      <TableCell className="text-gray-700">{job.department}</TableCell>
                      <TableCell className="text-gray-700">{job.work_location || job.location || '-'}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="text-gray-700">{job.cv_candidates[0]?.count || 0}</TableCell>
                      <TableCell className="text-gray-700">
                        {new Date(job.created_at).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                              <MoreHorizontal className="h-4 w-4 text-gray-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="top" className="w-48 bg-white z-50 shadow-lg border border-gray-200">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleViewDetails(job)}>
                              <Eye className="mr-2 h-4 w-4 text-gray-600" />
                              <span>Xem chi tiết</span>
                            </DropdownMenuItem>
                            {/* ✅ THÊM MENU ITEM MỚI */}
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleViewCandidates(job)}>
                              <Users className="mr-2 h-4 w-4 text-blue-600" />
                              <span>Xem ứng viên ({job.cv_candidates[0]?.count || 0})</span>
                            </DropdownMenuItem>
  
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleEdit(job)}>
                              <Edit className="mr-2 h-4 w-4 text-gray-600" />
                              <span>Chỉnh sửa</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleEdit(job)}>
                              <Edit className="mr-2 h-4 w-4 text-gray-600" />
                              <span>Chỉnh sửa</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleCopy(job)}>
                              <Copy className="mr-2 h-4 w-4 text-gray-600" />
                              <span>Sao chép</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleShare(job)}>
                              <Share2 className="mr-2 h-4 w-4 text-gray-600" />
                              <span>Chia sẻ</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleGenerateAIQuestions(job)}>
                              <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
                              <span>Tạo câu hỏi AI</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer" onClick={() => handleDelete(job)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Xóa</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout - shows only on mobile */}
          <div className="sm:hidden space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                Đang tải dữ liệu...
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Chưa có JD nào. Hãy tạo JD đầu tiên!
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div key={job.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base truncate">{job.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{job.level} • {job.job_type || 'Full-time'}</p>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Phòng ban:</span>
                      <span className="text-gray-900">{job.department}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Địa điểm:</span>
                      <span className="text-gray-900">{job.work_location || job.location || '-'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Ứng viên:</span>
                      <span className="text-gray-900 font-medium">{job.cv_candidates[0]?.count || 0}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Ngày tạo:</span>
                      <span className="text-gray-900">{new Date(job.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(job)}
                      className="text-gray-700 hover:text-blue-600"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Xem
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewCandidates(job)}
                      className="text-blue-700 hover:text-blue-800 border-blue-200"
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Ứng viên
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4 text-gray-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom" className="w-48 bg-white z-50 shadow-lg border border-gray-200">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => handleEdit(job)}>
                          <Edit className="mr-2 h-4 w-4 text-gray-600" />
                          <span>Chỉnh sửa</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => handleCopy(job)}>
                          <Copy className="mr-2 h-4 w-4 text-gray-600" />
                          <span>Sao chép</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => handleShare(job)}>
                          <Share2 className="mr-2 h-4 w-4 text-gray-600" />
                          <span>Chia sẻ</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => handleGenerateAIQuestions(job)}>
                          <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
                          <span>Tạo câu hỏi AI</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer" onClick={() => handleDelete(job)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Xóa</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ==================== DIALOG TẠO JD MỚI ==================== */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl font-bold truncate">Tạo mô tả công việc mới</DialogTitle>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">Sử dụng AI để tạo JD hoặc tạo thủ công</p>
              </div>
            </div>
          </DialogHeader>

          {/* Tab Selector */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                activeTab === 'ai'
                  ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              AI Generate
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                activeTab === 'manual'
                  ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Manual
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4 mt-4">
            {activeTab === 'ai' ? (
              <>
                {/* AI Tab Content */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-blue-900">Tạo JD tự động với AI</p>
                      <p className="text-xs text-blue-700 mt-1">
                        AI sẽ giúp bạn tạo mô tả công việc chuyên nghiệp dựa trên các thông tin cơ bản
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Tiêu đề vị trí <span className="text-red-500">*</span>
                    </label>
                    <Select value={formData.title} onValueChange={(value) => handleInputChange('title', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn vị trí" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Software Engineer">Software Engineer</SelectItem>
                        <SelectItem value="Frontend Developer">Frontend Developer</SelectItem>
                        <SelectItem value="Backend Developer">Backend Developer</SelectItem>
                        <SelectItem value="UI/UX Designer">UI/UX Designer</SelectItem>
                        <SelectItem value="Product Manager">Product Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Phòng ban <span className="text-red-500">*</span>
                    </label>
                    <Select value={formData.department} onValueChange={(value) => handleInputChange('department', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn phòng ban" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cấp độ</label>
                    <Select value={formData.level} onValueChange={(value) => handleInputChange('level', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Mid-level" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Intern">Intern</SelectItem>
                        <SelectItem value="Junior">Junior</SelectItem>
                        <SelectItem value="Mid-level">Mid-level</SelectItem>
                        <SelectItem value="Senior">Senior</SelectItem>
                        <SelectItem value="Lead">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngôn ngữ JD</label>
                    <Select value={aiLanguage} onValueChange={setAiLanguage}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="vietnamese">Tiếng Việt</SelectItem>
                        <SelectItem value="english">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Kỹ năng cần thiết (tùy chọn)
                  </label>
                  <Textarea
                    placeholder="Ví dụ: React, Node.js, TypeScript, Git..."
                    className="min-h-[80px] resize-none"
                    value={formData.requirements}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Nhập các kỹ năng cần thiết để AI tạo JD phù hợp hơn
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Yêu cầu bắt buộc (tùy chọn)
                  </label>
                  <Textarea
                    placeholder="Ví dụ: Bằng đại học chuyên ngành CNTT, Tiếng Anh giao tiếp tốt, Có kinh nghiệm tối thiểu 2 năm..."
                    className="min-h-[80px] resize-none"
                    value={formData.mandatory_requirements}
                    onChange={(e) => handleInputChange('mandatory_requirements', e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    🎯 Các yêu cầu bắt buộc mà ứng viên phải đáp ứng khi ứng tuyển
                  </p>
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleAIGenerate}
                    disabled={generatingAI}
                  >
                    {generatingAI ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Đang tạo với AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Tạo gợi ý với AI
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Manual Tab Content */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Tiêu đề vị trí <span className="text-red-500">*</span>
                    </label>
                    <Select value={formData.title} onValueChange={(value) => handleInputChange('title', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn vị trí" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Software Engineer">Software Engineer</SelectItem>
                        <SelectItem value="Frontend Developer">Frontend Developer</SelectItem>
                        <SelectItem value="Backend Developer">Backend Developer</SelectItem>
                        <SelectItem value="UI/UX Designer">UI/UX Designer</SelectItem>
                        <SelectItem value="Product Manager">Product Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Phòng ban <span className="text-red-500">*</span>
                    </label>
                    <Select value={formData.department} onValueChange={(value) => handleInputChange('department', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn phòng ban" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Địa điểm</label>
                    <Select value={formData.work_location} onValueChange={(value) => handleInputChange('work_location', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn địa điểm" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Remote">Remote</SelectItem>
                        <SelectItem value="Ho Chi Minh City">Ho Chi Minh City</SelectItem>
                        <SelectItem value="Ha Noi">Hà Nội</SelectItem>
                        <SelectItem value="Da Nang">Đà Nẵng</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Loại hình</label>
                    <Select value={formData.job_type} onValueChange={(value) => handleInputChange('job_type', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Full-time" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Full-time">Full-time</SelectItem>
                        <SelectItem value="Part-time">Part-time</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cấp độ</label>
                    <Select value={formData.level} onValueChange={(value) => handleInputChange('level', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Mid-level" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Intern">Intern</SelectItem>
                        <SelectItem value="Junior">Junior</SelectItem>
                        <SelectItem value="Mid-level">Mid-level</SelectItem>
                        <SelectItem value="Senior">Senior</SelectItem>
                        <SelectItem value="Lead">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Trạng thái</label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Bản nháp" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="Bản nháp">Bản nháp</SelectItem>
                        <SelectItem value="Đã đăng">Đã đăng</SelectItem>
                        <SelectItem value="Đã đóng">Đã đóng</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mô tả công việc <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Mô tả chi tiết về công việc, trách nhiệm..."
                    className="min-h-[100px] resize-none"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Yêu cầu công việc <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Yêu cầu về kỹ năng, kinh nghiệm..."
                    className="min-h-[100px] resize-none"
                    value={formData.requirements}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Quyền lợi <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Mô tả về lương thưởng, quyền lợi..."
                    className="min-h-[100px] resize-none"
                    value={formData.benefits}
                    onChange={(e) => handleInputChange('benefits', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Yêu cầu bắt buộc
                  </label>
                  <Textarea
                    placeholder="Ví dụ: Bằng đại học chuyên ngành CNTT, Tiếng Anh giao tiếp tốt, Có kinh nghiệm tối thiểu 2 năm..."
                    className="min-h-[100px] resize-none"
                    value={formData.mandatory_requirements}
                    onChange={(e) => handleInputChange('mandatory_requirements', e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    🎯 Các điều kiện bắt buộc mà ứng viên phải đáp ứng khi ứng tuyển
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto px-4 sm:px-6"
                    onClick={handleReset}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto px-4 sm:px-6"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Đang tạo...' : 'Tạo JD'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Xem chi tiết */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold truncate">{selectedJob?.title}</DialogTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedJob && getStatusBadge(selectedJob.status)}
              <Badge variant="outline" className="text-xs sm:text-sm">{selectedJob?.department}</Badge>
              <Badge variant="outline" className="text-xs sm:text-sm">{selectedJob?.level}</Badge>
            </div>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Loại hình</p>
                <p className="font-medium">{selectedJob?.job_type || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Địa điểm</p>
                <p className="font-medium">{selectedJob?.work_location || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ngày tạo</p>
                <p className="font-medium">
                  {selectedJob && new Date(selectedJob.created_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ứng viên</p>
                <p className="font-medium">
                  {selectedJob?.cv_candidates && selectedJob.cv_candidates[0] 
                    ? selectedJob.cv_candidates[0].count 
                    : 0}
                </p>
              </div>
            </div>

            {selectedJob?.description && (
              <div>
                <h3 className="font-semibold text-base mb-2">Mô tả công việc</h3>
                <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">
                  {selectedJob.description}
                </div>
              </div>
            )}

            {selectedJob?.requirements && (
              <div>
                <h3 className="font-semibold text-base mb-2">Yêu cầu công việc</h3>
                <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">
                  {selectedJob.requirements}
                </div>
              </div>
            )}

            {selectedJob?.benefits && (
              <div>
                <h3 className="font-semibold text-base mb-2">Quyền lợi</h3>
                <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">
                  {selectedJob.benefits}
                </div>
              </div>
            )}

            {selectedJob?.mandatory_requirements && (
              <div>
                <h3 className="font-semibold text-base mb-2">Yêu cầu bắt buộc</h3>
                <div className="p-3 bg-amber-50 rounded-lg text-sm whitespace-pre-wrap border border-amber-200">
                  {selectedJob.mandatory_requirements}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
{/* ==================== ✅ NEW DIALOG - DANH SÁCH ỨNG VIÊN ==================== */}
<Dialog open={isCandidatesDialogOpen} onOpenChange={setIsCandidatesDialogOpen}>
  <DialogContent className="max-w-5xl w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto sm:max-h-[90vh] p-4 sm:p-6">
    <DialogHeader>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Danh sách ứng viên
          </DialogTitle>
          {selectedJob && (
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {selectedJob.title} • {selectedJob.department} • {selectedJob.level}
            </p>
          )}
        </div>
        <Badge className="bg-blue-100 text-blue-700 text-base sm:text-lg px-2 sm:px-3 py-1">
          {jobCandidates.length} ứng viên
        </Badge>
      </div>
    </DialogHeader>

    <div className="space-y-4 mt-4">
      {loadingCandidates ? (
        // Loading State - more compact for mobile
        <div className="flex flex-col items-center justify-center py-12 sm:py-16">
          <div className="relative w-12 h-12 sm:w-16 sm:h-16">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-200 rounded-full" />
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
          </div>
          <p className="text-gray-600 mt-4 sm:mt-6 font-medium text-sm sm:text-base">Đang tải danh sách ứng viên...</p>
        </div>
      ) : jobCandidates.length === 0 ? (
        // Empty State
        <div className="text-center py-12 sm:py-16">
          <Users className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
            Chưa có ứng viên nào
          </h3>
          <p className="text-xs sm:text-sm text-gray-500">
            Vị trí này chưa nhận được hồ sơ ứng tuyển nào
          </p>
        </div>
      ) : (
        // Candidates List - Card Layout (mobile-first)
        <div className="space-y-3 sm:space-y-4">
          {jobCandidates.map((candidate) => (
            <div key={candidate.id} className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 hover:border-blue-300 transition-colors shadow-sm">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border-2 border-blue-200 shrink-0">
                  <AvatarFallback className="text-xs sm:text-sm bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                    {candidate.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{candidate.full_name}</h3>
                    <Badge className={
                      candidate.status === 'Chấp nhận' ? 'bg-green-100 text-green-700' :
                      candidate.status === 'Từ chối' ? 'bg-red-100 text-red-700' :
                      candidate.status === 'Phỏng vấn' ? 'bg-purple-100 text-purple-700' :
                      candidate.status === 'Sàng lọc' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {candidate.status}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">{candidate.email}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{candidate.phone_number || 'N/A'}</p>
                </div>
              </div>

              {candidate.university && (
                <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-600">
                  {candidate.university}
                </div>
              )}

              {candidate.cv_candidate_skills && candidate.cv_candidate_skills.length > 0 && (
                <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-1.5">
                  {candidate.cv_candidate_skills.slice(0, 4).map((item: any, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {item.cv_skills.name}
                    </Badge>
                  ))}
                  {candidate.cv_candidate_skills.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{candidate.cv_candidate_skills.length - 4}
                    </Badge>
                  )}
                </div>
              )}

              <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                <div className="text-xs text-gray-500">
                  Ngày ứng tuyển: {new Date(candidate.created_at).toLocaleDateString('vi-VN')}
                </div>
                {candidate.cv_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(candidate.cv_url, '_blank')}
                    className="text-gray-700 hover:text-blue-600"
                  >
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                    <span className="text-xs sm:text-sm">Xem CV</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t">
        <div className="text-xs sm:text-sm text-gray-600">
          Tổng cộng: <span className="font-semibold">{jobCandidates.length}</span> ứng viên
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Export to CSV
              const csvContent = [
                ['Họ tên', 'Email', 'SĐT', 'Trạng thái', 'Ngày ứng tuyển'].join(','),
                ...jobCandidates.map(c =>
                  [
                    c.full_name,
                    c.email,
                    c.phone_number || '',
                    c.status,
                    new Date(c.created_at).toLocaleDateString('vi-VN')
                  ].join(',')
                )
              ].join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `candidates_${selectedJob?.title}_${Date.now()}.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileText className="w-4 h-4 mr-2" />
            Xuất CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCandidatesDialogOpen(false);
              setJobCandidates([]);
            }}
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
      {/* Dialog Chỉnh sửa */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold">Chỉnh sửa Job Description</DialogTitle>
          </DialogHeader>

          {editFormData && (
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tiêu đề vị trí <span className="text-red-500">*</span>
                  </label>
                  <Select value={editFormData.title} onValueChange={(value) => handleEditInputChange('title', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      <SelectItem value="Software Engineer">Software Engineer</SelectItem>
                      <SelectItem value="Frontend Developer">Frontend Developer</SelectItem>
                      <SelectItem value="Backend Developer">Backend Developer</SelectItem>
                      <SelectItem value="UI/UX Designer">UI/UX Designer</SelectItem>
                      <SelectItem value="Product Manager">Product Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phòng ban <span className="text-red-500">*</span>
                  </label>
                  <Select value={editFormData.department} onValueChange={(value) => handleEditInputChange('department', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Design">Design</SelectItem>
                      <SelectItem value="Product">Product</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Địa điểm</label>
                  <Select value={editFormData.work_location} onValueChange={(value) => handleEditInputChange('work_location', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      <SelectItem value="Remote">Remote</SelectItem>
                      <SelectItem value="Ho Chi Minh City">Ho Chi Minh City</SelectItem>
                      <SelectItem value="Ha Noi">Hà Nội</SelectItem>
                      <SelectItem value="Da Nang">Đà Nẵng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Loại hình</label>
                  <Select value={editFormData.job_type} onValueChange={(value) => handleEditInputChange('job_type', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cấp độ</label>
                  <Select value={editFormData.level} onValueChange={(value) => handleEditInputChange('level', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      <SelectItem value="Intern">Intern</SelectItem>
                      <SelectItem value="Junior">Junior</SelectItem>
                      <SelectItem value="Mid-level">Mid-level</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Trạng thái</label>
                  <Select value={editFormData.status} onValueChange={(value) => handleEditInputChange('status', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      <SelectItem value="Bản nháp">Bản nháp</SelectItem>
                      <SelectItem value="Đã đăng">Đã đăng</SelectItem>
                      <SelectItem value="Đã đóng">Đã đóng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả công việc</label>
                <Textarea
                  placeholder="Mô tả chi tiết về công việc, trách nhiệm..."
                  className="min-h-[100px] resize-none"
                  value={editFormData.description}
                  onChange={(e) => handleEditInputChange('description', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Yêu cầu công việc</label>
                <Textarea
                  placeholder="Yêu cầu về kỹ năng, kinh nghiệm..."
                  className="min-h-[100px] resize-none"
                  value={editFormData.requirements}
                  onChange={(e) => handleEditInputChange('requirements', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quyền lợi</label>
                <Textarea
                  placeholder="Mô tả về lương thưởng, quyền lợi..."
                  className="min-h-[100px] resize-none"
                  value={editFormData.benefits}
                  onChange={(e) => handleEditInputChange('benefits', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Yêu cầu bắt buộc</label>
                <Textarea
                  placeholder="Ví dụ: Bằng đại học chuyên ngành CNTT, Tiếng Anh giao tiếp tốt..."
                  className="min-h-[100px] resize-none"
                  value={editFormData.mandatory_requirements}
                  onChange={(e) => handleEditInputChange('mandatory_requirements', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  🎯 Các điều kiện bắt buộc mà ứng viên phải đáp ứng khi ứng tuyển
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto px-4 sm:px-6"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleUpdateJob}
                  disabled={isSubmitting}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== ✅ NEW DIALOG - AI INTERVIEW QUESTIONS ==================== */}
      <Dialog open={isAIQuestionsDialogOpen} onOpenChange={setIsAIQuestionsDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  <span className="truncate">Câu hỏi phỏng vấn AI</span>
                </DialogTitle>
                {selectedJob && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                    {selectedJob.title} • {selectedJob.department} • {selectedJob.level}
                  </p>
                )}
              </div>

              {/* Language selector - only show before generating */}
              {!generatingQuestions && !aiQuestions && (
                <Select
                  value={aiQuestionLanguage}
                  onValueChange={(val) => setAiQuestionLanguage(val as 'vietnamese' | 'english')}
                >
                  <SelectTrigger className="w-[100px] sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="vietnamese">Tiếng Việt</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedJob && !generatingQuestions && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
                <Badge variant="outline" className="text-xs">
                  {selectedJob.department}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {selectedJob.level}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {selectedJob.job_type || 'Full-time'}
                </Badge>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 mt-4">
            {generatingQuestions ? (
              // Loading State
              <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                <div className="relative w-12 h-12 sm:w-16 sm:h-16">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-purple-200 rounded-full" />
                  <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                </div>
                <p className="text-gray-600 mt-4 sm:mt-6 font-medium text-sm sm:text-base">Đang tạo câu hỏi với AI...</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                  AI đang phân tích JD và tạo câu hỏi phù hợp
                </p>
                <div className="flex gap-2 mt-4">
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : aiQuestions ? (
              // Questions Display State
              <>
                {/* Info banner */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-purple-900">
                        Câu hỏi được tạo tự động bởi AI
                      </p>
                      <p className="text-xs text-purple-700 mt-1">
                        Vui lòng xem xét và điều chỉnh cho phù hợp với nhu cầu thực tế của công ty.
                        Các câu hỏi này chỉ mang tính tham khảo.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Questions display with markdown formatting */}
                <div className="border rounded-lg bg-white overflow-hidden">
                  <div className="p-3 sm:p-6 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                    <div className="prose prose-xs sm:prose-sm max-w-none">
                      {aiQuestions.split('\n').map((line, index) => {
                        // Heading 1
                        if (line.startsWith('# ')) {
                          return (
                            <h1 key={index} className="text-lg sm:text-2xl font-bold mt-4 sm:mt-6 mb-3 sm:mb-4 text-gray-900 first:mt-0">
                              {line.replace('# ', '')}
                            </h1>
                          );
                        }
                        // Heading 2
                        if (line.startsWith('## ')) {
                          return (
                            <h2 key={index} className="text-base sm:text-lg font-bold mt-4 sm:mt-6 mb-2 sm:mb-3 text-gray-900 flex items-center gap-2">
                              {line.replace('## ', '')}
                            </h2>
                          );
                        }
                        // Heading 3
                        if (line.startsWith('### ')) {
                          return (
                            <h3 key={index} className="text-sm sm:text-base font-semibold mt-3 sm:mt-4 mb-1.5 sm:mb-2 text-gray-800">
                              {line.replace('### ', '')}
                            </h3>
                          );
                        }
                        // List items
                        if (line.trim().startsWith('- ')) {
                          return (
                            <li key={index} className="ml-4 sm:ml-6 mb-1.5 sm:mb-2 text-xs sm:text-sm text-gray-700">
                              {line.trim().replace('- ', '')}
                            </li>
                          );
                        }
                        // Numbered list
                        if (/^\d+\.\s/.test(line.trim())) {
                          return (
                            <li key={index} className="ml-4 sm:ml-6 mb-1.5 sm:mb-2 text-xs sm:text-sm text-gray-700 list-decimal">
                              {line.trim().replace(/^\d+\.\s/, '')}
                            </li>
                          );
                        }
                        // Empty line
                        if (line.trim() === '') {
                          return <div key={index} className="h-1.5 sm:h-2" />;
                        }
                        // Regular paragraph
                        return (
                          <p key={index} className="mb-1.5 sm:mb-2 text-xs sm:text-sm text-gray-700">
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full sm:flex-1"
                    onClick={handleCopyAIQuestions}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Sao chép câu hỏi
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setAiQuestions('');
                      if (selectedJob) {
                        handleGenerateAIQuestions(selectedJob);
                      }
                    }}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Tạo lại
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setIsAIQuestionsDialogOpen(false);
                      setAiQuestions('');
                    }}
                  >
                    Đóng
                  </Button>
                </div>
              </>
            ) : (
              // No questions state
              <div className="text-center py-10 sm:py-12 text-gray-500">
                <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                <p className="text-xs sm:text-sm">Không có câu hỏi nào được tạo</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác nhận xóa */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md w-[90vw] sm:max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Xác nhận xóa Job Description</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Bạn có chắc chắn muốn xóa JD <strong>{selectedJob?.title}</strong> không?
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default JobsPage