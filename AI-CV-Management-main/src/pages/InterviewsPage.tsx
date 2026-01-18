// src/pages/InterviewsPage.tsx
"use client"

import { useState, useEffect } from "react"
import { Plus, Calendar, Clock, CheckCircle, XCircle, MoreHorizontal, Search, User, Briefcase, MapPin, Video, X, Star, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabaseClient"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CandidateAutoCompleteDual } from "@/components/CandidateAutoCompleteDual"

// --- Interfaces (Giữ nguyên của Version 2) ---

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  job_id?: string;
  cv_jobs?: {
    id: string;
    title: string;
    level: string;
  } | null;
}

interface Interview {
  id: string;
  interview_date: string;
  interviewer: string;
  // round: string; // Đã xóa theo V2
  format: string;
  status: string;
  duration: string;
  location: string;
  // end_time?: string; // Đã xóa theo V2
  job_id?: string;
  cv_candidates: {
    full_name: string;
    cv_jobs: {
      id: string;
      title: string;
    } | null;
  } | null;
  cv_jobs?: {
    id: string;
    title: string;
  } | null;
}

export function InterviewsPage() {
  // --- States ---
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  
  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReviewFormDialogOpen, setIsReviewFormDialogOpen] = useState(false);

  // Data States
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // State từ V2 cho Form Create (Checkbox job)
  const [useDifferentPosition, setUseDifferentPosition] = useState(false);

  const [reviewData, setReviewData] = useState({
    rating: 0,
    notes: '',
    outcome: 'Đạt'
  });
const [interviewToReview, setInterviewToReview] = useState<Interview | null>(null);

  // Form state (Create) - Form V2 (Không Round)
  const [formData, setFormData] = useState({
    candidate_id: "",
    job_id: "",
    interview_date: "",
    interview_time: "",
    duration: "60",
    location: "",
    format: "Trực tiếp",
    interviewer: "",
    notes: ""
  });

  // Form state (Edit) - V2 (Không Round)
  const [editFormData, setEditFormData] = useState({
    id: "",
    job_id: "",
    interview_date: "",
    interview_time: "",
    duration: "",
    location: "",
    format: "",
    interviewer: "",
    candidate_name: "" 
  });

  // Form errors state
  const [formErrors, setFormErrors] = useState({
    interview_date: "",
    interview_time: "",
    duration: ""
  });

  // --- Logic & Helpers ---

  // ✅ LOGIC TRẠNG THÁI: Merge từ V1 (để đảm bảo tính đúng đắn khi hủy/chờ đánh giá)
  const getInterviewStatus = (interview: Interview) => {
    const now = new Date();
    const interviewStart = new Date(interview.interview_date);

    // Nếu trạng thái đã là các trạng thái "kết thúc", giữ nguyên
    if (
      interview.status === 'Hoàn thành' || 
      interview.status === 'Đã hủy' || 
      interview.status === 'Đang đánh giá' ||
      interview.status === 'Đang chờ đánh giá'
    ) {
      return interview.status;
    }

    const isToday = interviewStart.toDateString() === now.toDateString();
    const isPast = interviewStart < now;

    if (isToday && !isPast) {
      return 'Đang phỏng vấn';
    } else if (isPast) {
      const durationMinutes = parseInt(interview.duration) || 60;
      const expectedEndTime = new Date(interviewStart.getTime() + durationMinutes * 60000);

      if (now <= expectedEndTime) {
        return 'Đang phỏng vấn';
      } else {
        // Chỉ tự động chuyển thành "Đang chờ đánh giá" nếu status hiện tại là "Đang chờ"
        return interview.status === 'Đang chờ' ? 'Đang chờ đánh giá' : interview.status;
      }
    } else {
      return 'Đang chờ';
    }
  };

  // Logic URL Params (V2)
  useEffect(() => {
    const initFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      const createMode = params.get('create');
      const candidateId = params.get('candidateId');

      if (createMode === 'true') {
        setIsDialogOpen(true);
        
        if (candidateId) {
          setFormData(prev => ({ ...prev, candidate_id: candidateId }));

          const { data: candidateData } = await supabase
            .from('cv_candidates')
            .select(`id, full_name, email, cv_jobs!job_id ( id, title, level )`)
            .eq('id', candidateId)
            .single();

          if (candidateData) {
            const rawCvJobs = candidateData.cv_jobs as any;
            const jobData = Array.isArray(rawCvJobs) ? rawCvJobs[0] : rawCvJobs;

            const formattedCandidate: Candidate = {
id: candidateData.id,
              full_name: candidateData.full_name,
              email: candidateData.email,
              job_id: jobData?.id,
              cv_jobs: jobData
            };
            setSelectedCandidate(formattedCandidate);
            setFormData(prev => ({ ...prev, job_id: jobData?.id || "" }));
          }
        }
        window.history.replaceState({}, '', '/phong-van');
      }
    };
    initFromUrl();
  }, []);

  // Load danh sách interviews
  useEffect(() => {
    async function getInterviews() {
      setLoading(true);
      const { data, error } = await supabase
        .from('cv_interviews')
        .select(`
          *,
          cv_candidates!candidate_id (
            full_name,
            cv_jobs!job_id ( id, title )
          ),
          cv_jobs!job_id ( id, title )
        `)
        .order('interview_date', { ascending: false });

      if (data) {
        const updatedInterviews = data.map(interview => ({
          ...interview,
          status: getInterviewStatus(interview as Interview)
        }));
        setInterviews(updatedInterviews as Interview[]);
      }
      if (error) console.error('Error fetching interviews:', error);
      setLoading(false);
    }
    getInterviews();
  }, []);

  // Load candidates và jobs
  useEffect(() => {
    async function loadFormData() {
      const { data: candidatesData } = await supabase
        .from('cv_candidates')
        .select('id, full_name, cv_jobs!job_id(title)')
        .order('full_name');
      
      const { data: jobsData } = await supabase
        .from('cv_jobs')
        .select('id, title')
        .order('title');

      if (candidatesData) setCandidates(candidatesData);
      if (jobsData) setJobs(jobsData);
    }
    loadFormData();
  }, []);

  // Handle candidate select
  const handleCandidateSelect = (candidate: Candidate | null) => {
    setSelectedCandidate(candidate);
    if (candidate) {
      setFormData(prev => ({
        ...prev,
        candidate_id: candidate.id,
        job_id: candidate.cv_jobs?.id || ""
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        candidate_id: "",
        job_id: ""
      }));
    }
  };

  // Validate DateTime
  const validateInterviewDateTime = () => {
    const errors = { interview_date: "", interview_time: "", duration: "" };

    if (!formData.interview_date) errors.interview_date = "Vui lòng chọn ngày phỏng vấn";
    if (!formData.interview_time) errors.interview_time = "Vui lòng chọn giờ phỏng vấn";

    const duration = parseInt(formData.duration);
    if (!duration || duration < 5) errors.duration = "Thời lượng phỏng vấn tối thiểu là 5 phút";

    const [year, month, day] = formData.interview_date.split('-');
    const [hours, minutes] = formData.interview_time.split(':');
const interviewDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    const now = new Date();

    if (isNaN(interviewDateTime.getTime())) {
      errors.interview_date = "Ngày và giờ phỏng vấn không hợp lệ";
    } else if (interviewDateTime <= now) {
      errors.interview_date = "Ngày và giờ phỏng vấn phải là thời điểm trong tương lai";
      errors.interview_time = "Ngày và giờ phỏng vấn phải là thời điểm trong tương lai";
    }

    setFormErrors(errors);
    return !errors.interview_date && !errors.interview_time && !errors.duration;
  };

  // --- Actions ---

  // Submit Create (V2 logic)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInterviewDateTime()) return;

    setSubmitting(true);
    try {
      const [year, month, day] = formData.interview_date.split('-');
      const [hours, minutes] = formData.interview_time.split(':');
      const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));

      let interviewData: any = {
        interview_date: localDate.toISOString(),
        interviewer: formData.interviewer,
        format: formData.format,
        status: 'Đang chờ',
        duration: formData.duration,
        location: formData.location,
        notes: formData.notes
      };

      if (formData.candidate_id) interviewData.candidate_id = formData.candidate_id;
      if (formData.job_id) interviewData.job_id = formData.job_id;

      const { error } = await supabase.from('cv_interviews').insert([interviewData]);
      if (error) throw error;
      
      if (formData.candidate_id) {
          await supabase.from('cv_candidates').update({ status: 'Phỏng vấn' }).eq('id', formData.candidate_id);
      }

      // Refresh list
      const { data: updatedInterviews } = await supabase
        .from('cv_interviews')
        .select(`
          *,
          cv_candidates!candidate_id (
            full_name,
            cv_jobs!job_id ( id, title )
          ),
          cv_jobs!job_id ( id, title )
        `)
        .order('interview_date', { ascending: false });

      if (updatedInterviews) {
        setInterviews(updatedInterviews.map(i => ({...i, status: getInterviewStatus(i as Interview)})) as Interview[]);
      }

      setFormData({
        candidate_id: "", job_id: "", interview_date: "", interview_time: "",
        duration: "60", location: "", format: "Trực tiếp", interviewer: "", notes: ""
      });
      setFormErrors({ interview_date: "", interview_time: "", duration: "" });
      setSelectedCandidate(null);
      setUseDifferentPosition(false);
      setIsDialogOpen(false);

      alert('Tạo lịch phỏng vấn thành công!');
    } catch (error) {
      console.error('Error creating interview:', error);
      alert('Có lỗi xảy ra khi tạo lịch phỏng vấn!');
    } finally {
setSubmitting(false);
    }
  };

  const handleViewDetail = (interview: Interview) => {
    setSelectedInterview(interview);
    setIsDetailDialogOpen(true);
  };

  // Logic Kết thúc sớm (Giống V1 - chuyển sang Đang đánh giá)
  const handleEndInterview = async (interview: Interview) => {
  if (!confirm(`Bạn có chắc muốn kết thúc sớm buổi phỏng vấn với ${interview.cv_candidates?.full_name}?`)) {
    return;
  }

  setSubmitting(true);
  try {
    const { error } = await supabase
      .from('cv_interviews')
      .update({
        status: 'Đang đánh giá'
      })
      .eq('id', interview.id);

    if (error) throw error;
    
    setInterviews(prev => prev.map(i => i.id === interview.id ? { ...i, status: 'Đang đánh giá' } : i));

    alert('Buổi phỏng vấn đã được kết thúc và chuyển sang trạng thái chờ đánh giá!');
  } catch (error) {
    console.error('Error ending interview:', error);
    alert('Có lỗi xảy ra khi kết thúc buổi phỏng vấn!');
  } finally {
    setSubmitting(false);
  }
};

// ✅ THÊM HÀM MỚI - Phỏng vấn ngay
const handleStartInterviewNow = async (interview: Interview) => {
  if (!confirm(`Bạn có chắc muốn bắt đầu phỏng vấn ngay với ${interview.cv_candidates?.full_name}?\n\nLịch phỏng vấn sẽ chuyển sang trạng thái "Đang phỏng vấn".`)) {
    return;
  }

  setSubmitting(true);
  try {
    const { error } = await supabase
      .from('cv_interviews')
      .update({
        status: 'Đang phỏng vấn',
        // Có thể cập nhật thời gian bắt đầu thực tế nếu cần
        // actual_start_time: new Date().toISOString()
      })
      .eq('id', interview.id);

    if (error) throw error;
    
    // Update local state
    setInterviews(prev => prev.map(i => 
      i.id === interview.id ? { ...i, status: 'Đang phỏng vấn' } : i
    ));

    alert('✓ Đã bắt đầu phỏng vấn! Trạng thái đã chuyển sang "Đang phỏng vấn".');
  } catch (error) {
    console.error('Error starting interview:', error);
    alert('Có lỗi xảy ra khi bắt đầu phỏng vấn!');
  } finally {
    setSubmitting(false);
  }
};

  // Submit Review (V1 Logic)
  const handleSubmitReview = async () => {
    if (!selectedInterview || reviewData.rating === 0) {
      alert('Vui lòng chọn số sao đánh giá!');
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('cv_interviews')
        .update({ status: 'Hoàn thành' })
        .eq('id', selectedInterview.id);

      if (updateError) throw updateError;

      const { error: reviewError } = await supabase
        .from('cv_interview_reviews')
        .insert([{
          interview_id: selectedInterview.id,
          rating: reviewData.rating,
          notes: reviewData.notes,
          outcome: reviewData.outcome
        }]);

      if (reviewError) throw reviewError;

      setInterviews(prev => prev.map(i => i.id === selectedInterview.id ? { ...i, status: 'Hoàn thành' } : i));
      setReviewData({ rating: 0, notes: '', outcome: 'Đạt' });
      setIsReviewDialogOpen(false);
      setSelectedInterview(null);
      alert('Đánh giá đã được lưu thành công!');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Có lỗi xảy ra khi lưu đánh giá!');
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ MERGED: Logic Hủy Lịch từ Version 1
  // Thay vì delete (xóa hẳn), ta update status thành 'Đã hủy'
  const handleDelete = async (interview: Interview) => {
    if (!confirm(`Bạn có chắc muốn hủy lịch phỏng vấn với ${interview.cv_candidates?.full_name}?`)) {
      return;
    }

    setSubmitting(true);
    try {
      // Version 1 Logic: Update status instead of delete
      const { error } = await supabase
        .from('cv_interviews')
        .update({ status: 'Đã hủy' })
        .eq('id', interview.id);

      if (error) throw error;

      // Update local state (map instead of filter)
setInterviews(prev => prev.map(i => 
        i.id === interview.id ? { ...i, status: 'Đã hủy' } : i
      ));

      alert('Đã hủy lịch phỏng vấn thành công!');
    } catch (error) {
      console.error('Error cancelling interview:', error);
      alert('Có lỗi xảy ra khi hủy lịch phỏng vấn!');
    } finally {
      setSubmitting(false);
    }
  };

  // --- ACTIONS EDIT (V2 Logic UI - Bỏ Round) ---
  const handleEditClick = (interview: Interview) => {
    const dt = new Date(interview.interview_date);
    const dateStr = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    const timeStr = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
    const currentJobId = interview.job_id || interview.cv_candidates?.cv_jobs?.id || "";

    setEditFormData({
      id: interview.id,
      job_id: currentJobId,
      interview_date: dateStr,
      interview_time: timeStr,
      duration: interview.duration,
      location: interview.location,
      format: interview.format,
      interviewer: interview.interviewer,
      candidate_name: interview.cv_candidates?.full_name || "Ứng viên"
    });
    setFormErrors({ interview_date: "", interview_time: "", duration: "" });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = { interview_date: "", interview_time: "", duration: "" };
    if (!editFormData.interview_date) errors.interview_date = "Vui lòng chọn ngày";
    if (!editFormData.interview_time) errors.interview_time = "Vui lòng chọn giờ";
    const duration = parseInt(editFormData.duration);
    if (!duration || duration < 5) errors.duration = "Tối thiểu 5 phút";
    
    const interviewDateTime = new Date(`${editFormData.interview_date}T${editFormData.interview_time}:00`);
    const now = new Date();
    
    if (isNaN(interviewDateTime.getTime())) errors.interview_date = "Ngày giờ không hợp lệ";
    if (interviewDateTime <= now) {
      errors.interview_date = "Thời gian cập nhật phải ở tương lai";
      errors.interview_time = "Thời gian cập nhật phải ở tương lai";
    }

    if (errors.interview_date || errors.interview_time || errors.duration) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    try {
      const isoDateTimeString = interviewDateTime.toISOString();
      const updatePayload: any = {
        interview_date: isoDateTimeString,
        duration: editFormData.duration,
        format: editFormData.format,
        interviewer: editFormData.interviewer,
        location: editFormData.location,
        job_id: editFormData.job_id
      };

      const { error } = await supabase.from('cv_interviews').update(updatePayload).eq('id', editFormData.id);
      if (error) throw error;

      const { data: updatedInterviews } = await supabase
        .from('cv_interviews')
.select(`*, cv_candidates!candidate_id (full_name, cv_jobs!job_id ( id, title )), cv_jobs!job_id ( id, title )`)
        .order('interview_date', { ascending: false });

      if (updatedInterviews) {
        setInterviews(updatedInterviews.map(i => ({...i, status: getInterviewStatus(i as Interview)})) as Interview[]);
      }

      setIsEditDialogOpen(false);
      setFormErrors({ interview_date: "", interview_time: "", duration: "" });
      alert('Cập nhật lịch phỏng vấn thành công!');
    } catch (error: any) {
      console.error('❌ Error updating interview:', error);
      alert(`Có lỗi xảy ra khi cập nhật: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // --- ACTIONS REVIEW FORM (V1) ---
  const handleOpenReviewForm = (interview: Interview) => {
    setInterviewToReview(interview);
    setReviewData({ rating: 0, notes: '', outcome: 'Đạt' });
    setIsReviewFormDialogOpen(true);
  };

  const handleSubmitReviewForm = async () => {
  if (!interviewToReview || reviewData.rating === 0) {
    alert('Vui lòng chọn số sao đánh giá!');
    return;
  }
  setSubmitting(true);
  try {
    // 1. Tạo review
    const { error: reviewError } = await supabase
      .from('cv_interview_reviews')
      .insert([{
        interview_id: interviewToReview.id,
        rating: reviewData.rating,
        notes: reviewData.notes,
        outcome: reviewData.outcome
      }]);
    
    if (reviewError) throw reviewError;

    // 2. Cập nhật trạng thái interview thành "Hoàn thành"
    const { error: updateError } = await supabase
      .from('cv_interviews')
      .update({ status: 'Hoàn thành' })
      .eq('id', interviewToReview.id);
    
    if (updateError) throw updateError;

    // ✅ 3. CẬP NHẬT TRẠNG THÁI ỨNG VIÊN DỰA TRÊN KẾT QUẢ ĐÁNH GIÁ
    if (reviewData.outcome === 'Đạt' || reviewData.outcome === 'Không đạt') {
      // Lấy candidate_id từ interview
      const { data: interviewData } = await supabase
        .from('cv_interviews')
        .select('candidate_id')
        .eq('id', interviewToReview.id)
        .single();

      if (interviewData?.candidate_id) {
        const newCandidateStatus = reviewData.outcome === 'Đạt' ? 'Chấp nhận' : 'Từ chối';
        
        const { error: candidateUpdateError } = await supabase
          .from('cv_candidates')
          .update({ status: newCandidateStatus })
          .eq('id', interviewData.candidate_id);

        if (candidateUpdateError) {
          console.error('⚠️ Không thể cập nhật trạng thái ứng viên:', candidateUpdateError);
          // Không throw để không làm gián đoạn flow chính
        } else {
          console.log(`✓ Đã cập nhật trạng thái ứng viên thành: ${newCandidateStatus}`);
        }
      }
    }

    // 4. Refresh danh sách interviews
    const { data: updatedInterviews } = await supabase
      .from('cv_interviews')
      .select(`
        *,
        cv_candidates!candidate_id (
          full_name,
          cv_jobs!job_id ( id, title )
        ),
        cv_jobs!job_id ( id, title )
      `)
      .order('interview_date', { ascending: false });

    if (updatedInterviews) {
      setInterviews(
        updatedInterviews.map(i => ({
          ...i,
          status: getInterviewStatus(i as Interview)
        })) as Interview[]
      );
    }

    // 5. Reset form và đóng dialog
    setIsReviewFormDialogOpen(false);
    setInterviewToReview(null);
    setReviewData({ rating: 0, notes: '', outcome: 'Đạt' });
    
    alert('✓ Đánh giá đã được lưu thành công và trạng thái ứng viên đã được cập nhật!');
  } catch (error) {
    console.error('Error submitting review:', error);
    alert('Có lỗi xảy ra khi lưu đánh giá!');
  } finally {
    setSubmitting(false);
  }
 };

  // --- Render Helpers ---

  const totalInterviews = interviews.length;
  const pendingInterviews = interviews.filter(i => i.status === 'Đang chờ').length;
  const completedInterviews = interviews.filter(i => i.status === 'Hoàn thành').length;
  const cancelledInterviews = interviews.filter(i => i.status === 'Đã hủy').length;

  const filteredInterviews = interviews.filter(interview => {
    const position = interview.cv_jobs?.title || interview.cv_candidates?.cv_jobs?.title;
const matchesSearch = 
      interview.cv_candidates?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || interview.status === statusFilter;
    const matchesPosition = positionFilter === 'all' || position === positionFilter;

    return matchesSearch && matchesStatus && matchesPosition;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Hoàn thành': return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'Đang chờ': return 'bg-orange-100 text-orange-700 hover:bg-orange-100';
      case 'Đang phỏng vấn': return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'Đang đánh giá': 
      case 'Đang chờ đánh giá': return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
      case 'Đã hủy': return 'bg-red-100 text-red-700 hover:bg-red-100';
      default: return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Lịch phỏng vấn
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý và theo dõi lịch phỏng vấn</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Tạo lịch phỏng vấn
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Tổng số</p>
                <div className="text-3xl font-bold">{totalInterviews}</div>
                <p className="text-xs text-blue-600 font-medium">+8%</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Đang chờ</p>
                <div className="text-3xl font-bold">{pendingInterviews}</div>
                <p className="text-xs text-orange-600 font-medium">+3%</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
<div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Hoàn thành</p>
                <div className="text-3xl font-bold">{completedInterviews}</div>
                <p className="text-xs text-green-600 font-medium">+12%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Đã hủy</p>
                <div className="text-3xl font-bold">{cancelledInterviews}</div>
                <p className="text-xs text-red-600 font-medium">-5%</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm kiếm theo tên ứng viên, vị trí..." 
            className="pl-10 bg-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Tất cả vị trí" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả vị trí</SelectItem>
            {Array.from(new Set(interviews.map(i => i.cv_jobs?.title || i.cv_candidates?.cv_jobs?.title).filter(Boolean))).map(position => (
              <SelectItem key={position} value={position as string}>{position}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="Đang chờ">Đang chờ</SelectItem>
            <SelectItem value="Đang phỏng vấn">Đang phỏng vấn</SelectItem>
            <SelectItem value="Đang đánh giá">Đang đánh giá</SelectItem>
            <SelectItem value="Đang chờ đánh giá">Đang chờ đánh giá</SelectItem>
            <SelectItem value="Hoàn thành">Hoàn thành</SelectItem>
            <SelectItem value="Đã hủy">Đã hủy</SelectItem>
          </SelectContent>
        </Select>

        <Select>
<SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Danh sách lịch phỏng vấn</CardTitle>
          <div className="text-sm text-muted-foreground">
            {filteredInterviews.length} / {totalInterviews}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ứng viên</TableHead>
                <TableHead>Vị trí ứng tuyển</TableHead>
                <TableHead>Ngày & Giờ</TableHead>
                <TableHead>Người phỏng vấn</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-64">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredInterviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-64">
                    <div className="flex flex-col items-center justify-center">
                      <Calendar className="h-16 w-16 text-gray-300 mb-4" />
                      <h3 className="text-base font-medium text-gray-900">
                        {searchTerm || statusFilter !== 'all' || positionFilter !== 'all' 
                          ? 'Không tìm thấy kết quả phù hợp' 
                          : 'Chưa có lịch phỏng vấn nào'}
                      </h3>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInterviews.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell className="font-medium">
                      {interview.cv_candidates?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {interview.cv_jobs?.title || interview.cv_candidates?.cv_jobs?.title || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const date = new Date(interview.interview_date);
                        return date.toLocaleString('vi-VN', {
year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
                        });
                      })()}
                    </TableCell>
                    <TableCell>{interview.interviewer}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeClass(interview.status)}>
                        {interview.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white">
                            <DropdownMenuItem onClick={() => handleViewDetail(interview)}>
                             Xem chi tiết
                            </DropdownMenuItem>
  
                            {/* ✅ MERGED UI: Ẩn các thao tác nếu đã Hoàn thành HOẶC Đã hủy */}
                            {interview.status !== 'Hoàn thành' && interview.status !== 'Đã hủy' && (
                              <>
                                {/* ✅ Phỏng vấn ngay - KHÔNG CÓ ICON */}
        {interview.status === 'Đang chờ' && (
          <>
            <DropdownMenuItem
              className="text-green-600 font-medium"
              onClick={() => handleStartInterviewNow(interview)}
              disabled={submitting}
            >
              Phỏng vấn ngay
            </DropdownMenuItem>
            
            {/* ✅ Chỉnh sửa - KHÔNG CÓ ICON */}
            <DropdownMenuItem onClick={() => handleEditClick(interview)}>
              Chỉnh sửa
            </DropdownMenuItem>
          </>
        )}
      
                                {/* Kết thúc sớm theo logic V1 (Chuyển thành Đang đánh giá) */}
                                {interview.status === 'Đang phỏng vấn' && (
                                  <DropdownMenuItem
                                     className="text-orange-600"
                                     onClick={() => handleEndInterview(interview)}
                                     disabled={submitting}
                                   >
                                     Kết thúc sớm
                                  </DropdownMenuItem>
                                )}
      
                                {(interview.status === 'Đang đánh giá' || interview.status === 'Đang chờ đánh giá') && (
                                   <DropdownMenuItem
                                     className="text-blue-600"
                                     onClick={() => handleOpenReviewForm(interview)}
                                   >
                                      Đánh giá
                                   </DropdownMenuItem>
                                 )}
      
                                <DropdownMenuItem 
                                  className="text-red-600"
onClick={() => handleDelete(interview)}
                                 >
                                   Hủy lịch
                                 </DropdownMenuItem>
                              </>
                            )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog tạo lịch phỏng vấn (V2 UI) */}
      {isDialogOpen && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" style={{ zIndex: 999999 }} onClick={() => setIsDialogOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Tạo lịch phỏng vấn mới
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Điền thông tin chi tiết để tạo lịch phỏng vấn.
                </p>
              </div>
              <button onClick={() => setIsDialogOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4" /> Ứng viên <span className="text-red-500">*</span>
                </label>
                {!selectedCandidate ? (
                    <CandidateAutoCompleteDual onCandidateSelect={handleCandidateSelect} className="w-full" />
                ) : (
                    <>
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm font-medium text-blue-800">
                                Đã chọn ứng viên: {selectedCandidate.full_name} và {selectedCandidate.email}
                            </p>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                            <span className="font-medium text-sm text-gray-600">Có thể thay đổi ứng viên</span>
                            <Button variant="ghost" size="sm" onClick={() => {
                                    setSelectedCandidate(null);
setFormData(prev => ({...prev, candidate_id: "", job_id: ""}));
                                    setUseDifferentPosition(false);
                                }} type="button">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="w-4 h-4" /> Vị trí ứng tuyển <span className="text-red-500">*</span>
                </label>
                {selectedCandidate?.cv_jobs ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm font-medium text-blue-800">Vị trí đang ứng tuyển:</p>
                      <p className="text-base font-semibold text-blue-900">{selectedCandidate.cv_jobs.title}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="useDifferentPosition" checked={useDifferentPosition}
                        onChange={(e) => {
                          setUseDifferentPosition(e.target.checked);
                          if (!e.target.checked) setFormData(prev => ({ ...prev, job_id: selectedCandidate.cv_jobs?.id || "" }));
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="useDifferentPosition" className="text-sm text-gray-700">Phỏng vấn cho vị trí khác</label>
                    </div>
                    {useDifferentPosition && (
                      <Select value={formData.job_id} onValueChange={(value) => setFormData({...formData, job_id: value})} required>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Chọn vị trí phỏng vấn" /></SelectTrigger>
                        <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                            {jobs.map((job) => (<SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ) : (
                  <Select value={formData.job_id} onValueChange={(value) => setFormData({...formData, job_id: value})} required>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Chọn vị trí ứng tuyển" /></SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                      {jobs.map((job) => (<SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ngày phỏng vấn <span className="text-red-500">*</span></label>
                  <Input type="date" value={formData.interview_date}
                    onChange={(e) => {
                      setFormData({...formData, interview_date: e.target.value});
                      if (formErrors.interview_date) setFormErrors({...formErrors, interview_date: ""});
                    }}
                    required className={`${formErrors.interview_date ? "border-red-500" : ""} bg-white`}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {formErrors.interview_date && <p className="text-xs text-red-500">{formErrors.interview_date}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Giờ phỏng vấn <span className="text-red-500">*</span></label>
                  <Input type="time" value={formData.interview_time}
                    onChange={(e) => {
                      setFormData({...formData, interview_time: e.target.value});
                      if (formErrors.interview_time) setFormErrors({...formErrors, interview_time: ""});
                    }}
                    required className={`${formErrors.interview_time ? "border-red-500" : ""} bg-white`}
                  />
                  {formErrors.interview_time && <p className="text-xs text-red-500">{formErrors.interview_time}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium"><Clock className="w-4 h-4" /> Thời lượng (phút)</label>
                <Input type="number" value={formData.duration}
                  onChange={(e) => {
                    setFormData({...formData, duration: e.target.value});
                    if (formErrors.duration) setFormErrors({...formErrors, duration: ""});
                  }}
                  placeholder="60" min="5" step="5" className={`${formErrors.duration ? "border-red-500" : ""} bg-white`}
                />
                {formErrors.duration && <p className="text-xs text-red-500">{formErrors.duration}</p>}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium"><MapPin className="w-4 h-4" /> Địa điểm</label>
                <Input value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="Phòng họp, địa chỉ, link online" className="bg-white" />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium"><Video className="w-4 h-4" /> Hình thức</label>
<Select value={formData.format} onValueChange={(value) => setFormData({...formData, format: value})}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                    <SelectItem value="Trực tiếp">Trực tiếp</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium"><User className="w-4 h-4" /> Người phỏng vấn <span className="text-red-500">*</span></label>
                <Input value={formData.interviewer} onChange={(e) => setFormData({...formData, interviewer: e.target.value})} placeholder="Nhập tên người phỏng vấn" className="bg-white" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ghi chú</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Ghi chú thêm về cuộc phỏng vấn..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={submitting}>Hủy</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={submitting || !formData.candidate_id || !formData.job_id || !formData.interview_date || !formData.interview_time || !formData.interviewer}>
                  <Calendar className="w-4 h-4 mr-2" />
                  {submitting ? 'Đang tạo...' : 'Tạo lịch phỏng vấn'}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </>
      )}

      {/* Dialog Chỉnh Sửa */}
      {isEditDialogOpen && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" style={{ zIndex: 999999 }} onClick={() => setIsEditDialogOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2"><Pencil className="w-5 h-5 text-blue-600" /> Chỉnh sửa lịch phỏng vấn</h2>
<p className="text-sm text-gray-600 mt-1">Cập nhật thông tin cho lịch phỏng vấn đang chờ.</p>
                </div>
                <button onClick={() => setIsEditDialogOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleUpdate} className="p-6 space-y-6">
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium"><User className="w-4 h-4" /> Ứng viên (Không thể thay đổi)</label>
                    <Input value={editFormData.candidate_name} disabled className="bg-gray-100" />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium"><Briefcase className="w-4 h-4" /> Vị trí ứng tuyển</label>
                  <Select value={editFormData.job_id} onValueChange={(value) => setEditFormData({...editFormData, job_id: value})}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Chọn vị trí" /></SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>{jobs.map((job) => (<SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ngày phỏng vấn <span className="text-red-500">*</span></label>
                    <Input type="date" value={editFormData.interview_date} onChange={(e) => setEditFormData({...editFormData, interview_date: e.target.value})} required className={`${formErrors.interview_date ? "border-red-500" : ""} bg-white`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Giờ phỏng vấn <span className="text-red-500">*</span></label>
                    <Input type="time" value={editFormData.interview_time} onChange={(e) => setEditFormData({...editFormData, interview_time: e.target.value})} required className={`${formErrors.interview_time ? "border-red-500" : ""} bg-white`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium"><Clock className="w-4 h-4" /> Thời lượng (phút)</label>
                  <Input type="number" value={editFormData.duration} onChange={(e) => setEditFormData({...editFormData, duration: e.target.value})} placeholder="60" min="5" step="5" className={`${formErrors.duration ? "border-red-500" : ""} bg-white`} />
                </div>
                <div className="space-y-2">
<label className="flex items-center gap-2 text-sm font-medium"><MapPin className="w-4 h-4" /> Địa điểm</label>
                  <Input value={editFormData.location} onChange={(e) => setEditFormData({...editFormData, location: e.target.value})} placeholder="Phòng họp, địa chỉ, link online" className="bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium"><Video className="w-4 h-4" /> Hình thức</label>
                  <Select value={editFormData.format} onValueChange={(value) => setEditFormData({...editFormData, format: value})}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}><SelectItem value="Trực tiếp">Trực tiếp</SelectItem><SelectItem value="Online">Online</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium"><User className="w-4 h-4" /> Người phỏng vấn <span className="text-red-500">*</span></label>
                  <Input value={editFormData.interviewer} onChange={(e) => setEditFormData({...editFormData, interviewer: e.target.value})} placeholder="Nhập tên người phỏng vấn" className="bg-white" required />
                </div>
                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={submitting}>Hủy</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={submitting}><Pencil className="w-4 h-4 mr-2" /> {submitting ? 'Đang cập nhật...' : 'Cập nhật thay đổi'}</Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Dialog Xem Chi Tiết */}
      {isDetailDialogOpen && selectedInterview && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" style={{ zIndex: 999999 }} onClick={() => setIsDetailDialogOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" /> Chi tiết lịch phỏng vấn</h2>
<button onClick={() => setIsDetailDialogOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-gray-600">Ứng viên</label><p className="mt-1 text-base font-semibold">{selectedInterview.cv_candidates?.full_name || 'N/A'}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Vị trí phỏng vấn</label><p className="mt-1 text-base">{selectedInterview.cv_jobs?.title || selectedInterview.cv_candidates?.cv_jobs?.title || 'N/A'}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Trạng thái</label><div className="mt-1"><Badge className={getStatusBadgeClass(selectedInterview.status)}>{selectedInterview.status}</Badge></div></div>
                  <div><label className="text-sm font-medium text-gray-600">Ngày & Giờ</label><p className="mt-1 text-base">{new Date(selectedInterview.interview_date).toLocaleString('vi-VN', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'})}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Thời lượng</label><p className="mt-1 text-base">{selectedInterview.duration} phút</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Người phỏng vấn</label><p className="mt-1 text-base">{selectedInterview.interviewer}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Hình thức</label><p className="mt-1 text-base">{selectedInterview.format}</p></div>
                  <div className="col-span-2"><label className="text-sm font-medium text-gray-600">Địa điểm</label><p className="mt-1 text-base">{selectedInterview.location || 'Chưa có thông tin'}</p></div>
                </div>
              </div>
              <div className="border-t px-6 py-4 flex justify-end"><Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Đóng</Button></div>
            </div>
          </div>
        </>
      )}

      {/* Dialog Form Đánh Giá */}
      {isReviewFormDialogOpen && interviewToReview && (
        <> 
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" style={{ zIndex: 999999 }} onClick={() => { setIsReviewFormDialogOpen(false); setInterviewToReview(null); setReviewData({ rating: 0, notes: '', outcome: 'Đạt' }); }} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
<h2 className="text-xl font-semibold flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" /> Đánh giá buổi phỏng vấn</h2>
                <button onClick={() => { setIsReviewFormDialogOpen(false); setInterviewToReview(null); setReviewData({ rating: 0, notes: '', outcome: 'Đạt' }); }} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Ứng viên</p>
                  <p className="font-semibold text-lg">{interviewToReview.cv_candidates?.full_name}</p>
                  <p className="text-sm text-gray-600 mt-1">{interviewToReview.cv_jobs?.title || interviewToReview.cv_candidates?.cv_jobs?.title}</p>
                </div>
                <div className="space-y-3">
                    <label className="text-sm font-medium">Đánh giá <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setReviewData({...reviewData, rating: star})} className="transition-transform hover:scale-110">
                          <Star className={`w-10 h-10 ${star <= reviewData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        </button>
                      ))}
                      <span className="ml-2 text-lg font-semibold text-gray-700">{reviewData.rating > 0 ? `${reviewData.rating}/5` : 'Chưa chọn'}</span>
                    </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kết quả <span className="text-red-500">*</span></label>
                  <Select value={reviewData.outcome} onValueChange={(value) => setReviewData({...reviewData, outcome: value})}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                      <SelectItem value="Đạt">Đạt</SelectItem><SelectItem value="Không đạt">Không đạt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ghi chú đánh giá</label>
                  <textarea value={reviewData.notes} onChange={(e) => setReviewData({...reviewData, notes: e.target.value})} placeholder="Nhập ghi chú về buổi phỏng vấn..." rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white" />
                </div>
              </div>
              <div className="border-t px-6 py-4 flex justify-end gap-2">
<Button variant="outline" onClick={() => { setIsReviewFormDialogOpen(false); setInterviewToReview(null); setReviewData({ rating: 0, notes: '', outcome: 'Đạt' }); }} disabled={submitting}>Hủy</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmitReviewForm} disabled={submitting || reviewData.rating === 0}><Star className="w-4 h-4 mr-2" /> {submitting ? 'Đang lưu...' : 'Lưu đánh giá'}</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}