// src/pages/InterviewsPage.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import {
  Plus, Calendar, Clock, CheckCircle, XCircle, MoreHorizontal,
  Search, User, Briefcase, MapPin, Video, X, Star, Pencil,
  ChevronDown, UserCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabaseClient"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { CandidateAutoCompleteDual } from "@/components/CandidateAutoCompleteDual"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  job_id?: string;
  cv_jobs?: { id: string; title: string; level: string } | null;
}

interface Interview {
  id: string;
  interview_date: string;
  interviewer: string;
  format: string;
  status: string;
  duration: string;
  location: string;
  job_id?: string;
  cv_candidates: {
    full_name: string;
    cv_jobs: { id: string; title: string } | null;
  } | null;
  cv_jobs?: { id: string; title: string } | null;
}

/** Người dùng hệ thống (từ cv_profiles) */
interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ─── InterviewerSelect component ─────────────────────────────────────────────
/**
 * Dropdown có search để chọn người phỏng vấn.
 * Cho phép cả nhập tên tự do (fallback) khi không tìm thấy.
 */
interface InterviewerSelectProps {
  value: string;                        // tên hiện tại
  onChange: (name: string) => void;
  users: SystemUser[];
  placeholder?: string;
  disabled?: boolean;
}

function InterviewerSelect({
  value, onChange, users, placeholder = "Chọn hoặc nhập tên người phỏng vấn", disabled
}: InterviewerSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectedUser = users.find(u => u.name === value);

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN': return 'bg-red-100 text-red-700';
      case 'HR': return 'bg-purple-100 text-purple-700';
      case 'INTERVIEWER': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className={`
          w-full flex items-center justify-between gap-2
          px-3 h-10 rounded-md border border-gray-300 bg-white text-sm
          hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${open ? 'border-blue-500 ring-2 ring-blue-200' : ''}
        `}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selectedUser ? (
            <>
              <Avatar className="h-5 w-5 flex-shrink-0">
                <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{selectedUser.name}</span>
              <Badge className={`text-[10px] px-1.5 py-0 h-4 ${getRoleBadgeColor(selectedUser.role)}`}>
                {selectedUser.role}
              </Badge>
            </>
          ) : value ? (
            <>
              <UserCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="truncate text-gray-700">{value}</span>
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {/* Search box */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* User list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              /* Fallback: use whatever was typed as custom name */
              <div className="p-3">
                <p className="text-xs text-gray-400 mb-2">Không tìm thấy trong hệ thống</p>
                {search.trim() && (
                  <button
                    type="button"
                    onClick={() => { onChange(search.trim()); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-blue-50 border border-dashed border-blue-300 text-blue-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Dùng tên "<span className="font-medium">{search.trim()}</span>"
                  </button>
                )}
              </div>
            ) : (
              filtered.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => { onChange(user.name); setOpen(false); }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors
                    ${value === user.name ? 'bg-blue-50' : ''}
                  `}
                >
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </Badge>
                  {value === user.name && (
                    <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer: type custom name */}
          <div className="border-t border-gray-100 p-2">
            <p className="text-xs text-gray-400 text-center">
              Hoặc nhập tên tuỳ ý nếu người phỏng vấn không có trong danh sách
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InterviewsPage() {
  // ── states ──────────────────────────────────────────────────────────────
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReviewFormDialogOpen, setIsReviewFormDialogOpen] = useState(false);

  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);   // ← NEW
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [useDifferentPosition, setUseDifferentPosition] = useState(false);

  const [reviewData, setReviewData] = useState({ rating: 0, notes: '', outcome: 'Đạt' });
  const [interviewToReview, setInterviewToReview] = useState<Interview | null>(null);

  const [formData, setFormData] = useState({
    candidate_id: "", job_id: "", interview_date: "", interview_time: "",
    duration: "60", location: "", format: "Trực tiếp", interviewer: "", notes: ""
  });

  const [editFormData, setEditFormData] = useState({
    id: "", job_id: "", interview_date: "", interview_time: "",
    duration: "", location: "", format: "", interviewer: "", candidate_name: ""
  });

  const [formErrors, setFormErrors] = useState({
    interview_date: "", interview_time: "", duration: ""
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  const getInterviewStatus = (interview: Interview) => {
    const now = new Date();
    const interviewStart = new Date(interview.interview_date);
    if (['Hoàn thành', 'Đã hủy', 'Đang đánh giá', 'Đang chờ đánh giá'].includes(interview.status))
      return interview.status;
    const isPast = interviewStart < now;
    const isToday = interviewStart.toDateString() === now.toDateString();
    if (isToday && !isPast) return 'Đang phỏng vấn';
    if (isPast) {
      const end = new Date(interviewStart.getTime() + (parseInt(interview.duration) || 60) * 60000);
      if (now <= end) return 'Đang phỏng vấn';
      return interview.status === 'Đang chờ' ? 'Đang chờ đánh giá' : interview.status;
    }
    return 'Đang chờ';
  };

  // ── fetch ────────────────────────────────────────────────────────────────

  const fetchInterviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cv_interviews')
      .select(`*, cv_candidates!candidate_id(full_name, cv_jobs!job_id(id,title)), cv_jobs!job_id(id,title)`)
      .order('interview_date', { ascending: false });
    if (data) setInterviews(data.map(i => ({ ...i, status: getInterviewStatus(i as Interview) })) as Interview[]);
    if (error) console.error('Error fetching interviews:', error);
    setLoading(false);
  };

  // ← NEW: load system users from cv_profiles
  const fetchSystemUsers = async () => {
    const { data, error } = await supabase
      .from('cv_profiles')
      .select(`
        id,
        full_name,
        email,
        status,
        cv_user_roles ( role_id, cv_roles ( name ) )
      `)
      .eq('status', 'active')
      .order('full_name');

    if (error) {
      console.warn('Could not fetch cv_profiles:', error.message);
      // fallback: try without join
      const { data: simple } = await supabase
        .from('cv_profiles')
        .select('id, full_name, email, role')
        .order('full_name');
      if (simple) {
        setSystemUsers(simple.map((u: any) => ({
          id: u.id,
          name: u.full_name || u.name || 'Unknown',
          email: u.email || '',
          role: u.role || 'USER',
        })));
      }
      return;
    }

    if (data) {
      setSystemUsers(data.map((u: any) => {
        const roleEntry = u.cv_user_roles?.[0];
        const roleName = roleEntry?.cv_roles?.name || 'USER';
        return {
          id: u.id,
          name: u.full_name || 'Không có tên',
          email: u.email || '',
          role: roleName.toUpperCase(),
        };
      }));
    }
  };

  useEffect(() => {
    // URL params (deep-link from candidates page)
    const initFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('create') === 'true') {
        setIsDialogOpen(true);
        const candidateId = params.get('candidateId');
        if (candidateId) {
          setFormData(prev => ({ ...prev, candidate_id: candidateId }));
          const { data } = await supabase
            .from('cv_candidates')
            .select(`id, full_name, email, cv_jobs!job_id(id,title,level)`)
            .eq('id', candidateId).single();
          if (data) {
            const raw = data.cv_jobs as any;
            const job = Array.isArray(raw) ? raw[0] : raw;
            setSelectedCandidate({ id: data.id, full_name: data.full_name, email: data.email, job_id: job?.id, cv_jobs: job });
            setFormData(prev => ({ ...prev, job_id: job?.id || "" }));
          }
        }
        window.history.replaceState({}, '', '/phong-van');
      }
    };
    initFromUrl();
    fetchInterviews();
    fetchSystemUsers();   // ← NEW
  }, []);

  useEffect(() => {
    async function loadFormData() {
      const { data: c } = await supabase.from('cv_candidates').select('id,full_name,cv_jobs!job_id(title)').order('full_name');
      const { data: j } = await supabase.from('cv_jobs').select('id,title').order('title');
      if (c) setCandidates(c);
      if (j) setJobs(j);
    }
    loadFormData();
  }, []);

  // ── handlers ─────────────────────────────────────────────────────────────

  const handleCandidateSelect = (candidate: Candidate | null) => {
    setSelectedCandidate(candidate);
    setFormData(prev => ({
      ...prev,
      candidate_id: candidate?.id || "",
      job_id: candidate?.cv_jobs?.id || ""
    }));
  };

  const validateDateTime = () => {
    const errors = { interview_date: "", interview_time: "", duration: "" };
    if (!formData.interview_date) errors.interview_date = "Vui lòng chọn ngày phỏng vấn";
    if (!formData.interview_time) errors.interview_time = "Vui lòng chọn giờ phỏng vấn";
    const dur = parseInt(formData.duration);
    if (!dur || dur < 5) errors.duration = "Thời lượng tối thiểu 5 phút";
    const [y, mo, d] = formData.interview_date.split('-');
    const [h, mi] = formData.interview_time.split(':');
    const dt = new Date(+y, +mo - 1, +d, +h, +mi);
    if (isNaN(dt.getTime())) errors.interview_date = "Ngày giờ không hợp lệ";
    else if (dt <= new Date()) {
      errors.interview_date = "Ngày giờ phỏng vấn phải ở tương lai";
      errors.interview_time = "Ngày giờ phỏng vấn phải ở tương lai";
    }
    setFormErrors(errors);
    return !errors.interview_date && !errors.interview_time && !errors.duration;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDateTime()) return;
    setSubmitting(true);
    try {
      const [y, mo, d] = formData.interview_date.split('-');
      const [h, mi] = formData.interview_time.split(':');
      const localDate = new Date(+y, +mo - 1, +d, +h, +mi);
      const payload: any = {
        interview_date: localDate.toISOString(),
        interviewer: formData.interviewer,
        format: formData.format,
        status: 'Đang chờ',
        duration: formData.duration,
        location: formData.location,
        notes: formData.notes,
      };
      if (formData.candidate_id) payload.candidate_id = formData.candidate_id;
      if (formData.job_id) payload.job_id = formData.job_id;
      const { error } = await supabase.from('cv_interviews').insert([payload]);
      if (error) throw error;
      if (formData.candidate_id)
        await supabase.from('cv_candidates').update({ status: 'Phỏng vấn' }).eq('id', formData.candidate_id);
      await fetchInterviews();
      setFormData({ candidate_id:"",job_id:"",interview_date:"",interview_time:"",duration:"60",location:"",format:"Trực tiếp",interviewer:"",notes:"" });
      setFormErrors({ interview_date:"",interview_time:"",duration:"" });
      setSelectedCandidate(null);
      setUseDifferentPosition(false);
      setIsDialogOpen(false);
      alert('Tạo lịch phỏng vấn thành công!');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi tạo lịch phỏng vấn!');
    } finally { setSubmitting(false); }
  };

  const handleViewDetail = (interview: Interview) => { setSelectedInterview(interview); setIsDetailDialogOpen(true); };

  const handleEndInterview = async (interview: Interview) => {
    if (!confirm(`Kết thúc sớm phỏng vấn với ${interview.cv_candidates?.full_name}?`)) return;
    setSubmitting(true);
    const { error } = await supabase.from('cv_interviews').update({ status: 'Đang đánh giá' }).eq('id', interview.id);
    if (!error) setInterviews(prev => prev.map(i => i.id === interview.id ? { ...i, status: 'Đang đánh giá' } : i));
    else alert('Có lỗi xảy ra!');
    setSubmitting(false);
  };

  const handleStartInterviewNow = async (interview: Interview) => {
    if (!confirm(`Bắt đầu phỏng vấn ngay với ${interview.cv_candidates?.full_name}?`)) return;
    setSubmitting(true);
    const { error } = await supabase.from('cv_interviews').update({ status: 'Đang phỏng vấn' }).eq('id', interview.id);
    if (!error) setInterviews(prev => prev.map(i => i.id === interview.id ? { ...i, status: 'Đang phỏng vấn' } : i));
    else alert('Có lỗi xảy ra!');
    setSubmitting(false);
  };

  const handleDelete = async (interview: Interview) => {
    if (!confirm(`Hủy lịch phỏng vấn với ${interview.cv_candidates?.full_name}?`)) return;
    setSubmitting(true);
    const { error } = await supabase.from('cv_interviews').update({ status: 'Đã hủy' }).eq('id', interview.id);
    if (!error) setInterviews(prev => prev.map(i => i.id === interview.id ? { ...i, status: 'Đã hủy' } : i));
    else alert('Có lỗi xảy ra!');
    setSubmitting(false);
  };

  const handleEditClick = (interview: Interview) => {
    const dt = new Date(interview.interview_date);
    setEditFormData({
      id: interview.id,
      job_id: interview.job_id || interview.cv_candidates?.cv_jobs?.id || "",
      interview_date: `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`,
      interview_time: `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
      duration: interview.duration,
      location: interview.location,
      format: interview.format,
      interviewer: interview.interviewer,
      candidate_name: interview.cv_candidates?.full_name || "Ứng viên"
    });
    setFormErrors({ interview_date:"",interview_time:"",duration:"" });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = { interview_date:"",interview_time:"",duration:"" };
    if (!editFormData.interview_date) errors.interview_date = "Vui lòng chọn ngày";
    if (!editFormData.interview_time) errors.interview_time = "Vui lòng chọn giờ";
    const dur = parseInt(editFormData.duration);
    if (!dur || dur < 5) errors.duration = "Tối thiểu 5 phút";
    const dt = new Date(`${editFormData.interview_date}T${editFormData.interview_time}:00`);
    if (isNaN(dt.getTime())) errors.interview_date = "Ngày giờ không hợp lệ";
    else if (dt <= new Date()) { errors.interview_date = "Thời gian phải ở tương lai"; errors.interview_time = "Thời gian phải ở tương lai"; }
    if (errors.interview_date || errors.interview_time || errors.duration) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('cv_interviews').update({
        interview_date: dt.toISOString(), duration: editFormData.duration,
        format: editFormData.format, interviewer: editFormData.interviewer,
        location: editFormData.location, job_id: editFormData.job_id
      }).eq('id', editFormData.id);
      if (error) throw error;
      await fetchInterviews();
      setIsEditDialogOpen(false);
      alert('Cập nhật lịch phỏng vấn thành công!');
    } catch (err: any) { alert(`Lỗi: ${err.message}`); }
    finally { setSubmitting(false); }
  };

  const handleOpenReviewForm = (interview: Interview) => {
    setInterviewToReview(interview);
    setReviewData({ rating: 0, notes: '', outcome: 'Đạt' });
    setIsReviewFormDialogOpen(true);
  };

  const handleSubmitReviewForm = async () => {
    if (!interviewToReview || reviewData.rating === 0) { alert('Vui lòng chọn số sao!'); return; }
    setSubmitting(true);
    try {
      await supabase.from('cv_interview_reviews').insert([{
        interview_id: interviewToReview.id, rating: reviewData.rating,
        notes: reviewData.notes, outcome: reviewData.outcome
      }]);
      await supabase.from('cv_interviews').update({ status: 'Hoàn thành' }).eq('id', interviewToReview.id);
      if (['Đạt','Không đạt'].includes(reviewData.outcome)) {
        const { data: iv } = await supabase.from('cv_interviews').select('candidate_id').eq('id', interviewToReview.id).single();
        if (iv?.candidate_id) {
          await supabase.from('cv_candidates')
            .update({ status: reviewData.outcome === 'Đạt' ? 'Chấp nhận' : 'Từ chối' })
            .eq('id', iv.candidate_id);
        }
      }
      await fetchInterviews();
      setIsReviewFormDialogOpen(false);
      setInterviewToReview(null);
      setReviewData({ rating: 0, notes: '', outcome: 'Đạt' });
      alert('✓ Đánh giá đã được lưu thành công!');
    } catch (err) { console.error(err); alert('Có lỗi xảy ra!'); }
    finally { setSubmitting(false); }
  };

  // ── render helpers ────────────────────────────────────────────────────────

  const totalInterviews = interviews.length;
  const pendingInterviews = interviews.filter(i => i.status === 'Đang chờ').length;
  const completedInterviews = interviews.filter(i => i.status === 'Hoàn thành').length;
  const cancelledInterviews = interviews.filter(i => i.status === 'Đã hủy').length;

  const filteredInterviews = interviews.filter(i => {
    const position = i.cv_jobs?.title || i.cv_candidates?.cv_jobs?.title;
    return (
      (!searchTerm || i.cv_candidates?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || position?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'all' || i.status === statusFilter) &&
      (positionFilter === 'all' || position === positionFilter)
    );
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Hoàn thành': return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'Đang chờ': return 'bg-orange-100 text-orange-700 hover:bg-orange-100';
      case 'Đang phỏng vấn': return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'Đang đánh giá': case 'Đang chờ đánh giá': return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
      case 'Đã hủy': return 'bg-red-100 text-red-700 hover:bg-red-100';
      default: return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
    }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('vi-VN', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Ho_Chi_Minh'
  });

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/50 p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 truncate">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Lịch phỏng vấn</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">Quản lý và theo dõi lịch phỏng vấn</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Tạo lịch
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {[
          { label:'Tổng số', value:totalInterviews, color:'text-blue-600', icon:<Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 shrink-0"/>, pct:'+8%', pctColor:'text-blue-600' },
          { label:'Đang chờ', value:pendingInterviews, color:'text-orange-600', icon:<Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 shrink-0"/>, pct:'+3%', pctColor:'text-orange-600' },
          { label:'Hoàn thành', value:completedInterviews, color:'text-green-600', icon:<CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 shrink-0"/>, pct:'+12%', pctColor:'text-green-600' },
          { label:'Đã hủy', value:cancelledInterviews, color:'text-red-600', icon:<XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 shrink-0"/>, pct:'-5%', pctColor:'text-red-600' },
        ].map(s => (
          <Card key={s.label} className="shadow-sm border-2 border-gray-100">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">{s.label}</p>
                  <div className="text-2xl sm:text-3xl font-bold">{s.value}</div>
                  <p className={`text-[10px] sm:text-xs font-medium ${s.pctColor}`}>{s.pct}</p>
                </div>
                {s.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
        <div className="relative min-w-[180px] sm:min-w-[250px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm theo tên ứng viên, vị trí..." className="pl-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[150px] sm:w-[180px] bg-white"><SelectValue placeholder="Vị trí" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả vị trí</SelectItem>
            {Array.from(new Set(interviews.map(i => i.cv_jobs?.title || i.cv_candidates?.cv_jobs?.title).filter(Boolean))).map(p => (
              <SelectItem key={p} value={p as string}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] sm:w-[180px] bg-white"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Tất cả</SelectItem>
            {['Đang chờ','Đang phỏng vấn','Đang đánh giá','Đang chờ đánh giá','Hoàn thành','Đã hủy'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-2 border-gray-100 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Danh sách lịch phỏng vấn</CardTitle>
          <div className="text-xs sm:text-sm text-muted-foreground">{filteredInterviews.length} / {totalInterviews}</div>
        </CardHeader>
        <CardContent className="p-0">

          {/* Desktop */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Ứng viên</TableHead>
                  <TableHead>Vị trí ứng tuyển</TableHead>
                  <TableHead>Ngày & Giờ</TableHead>
                  <TableHead>Người phỏng vấn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-64">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                      <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
                    </div>
                  </TableCell></TableRow>
                ) : filteredInterviews.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-64">
                    <div className="flex flex-col items-center justify-center">
                      <Calendar className="h-16 w-16 text-gray-300 mb-4" />
                      <h3 className="text-base font-medium text-gray-900">
                        {searchTerm || statusFilter !== 'all' || positionFilter !== 'all' ? 'Không tìm thấy kết quả' : 'Chưa có lịch phỏng vấn'}
                      </h3>
                    </div>
                  </TableCell></TableRow>
                ) : filteredInterviews.map(interview => (
                  <TableRow key={interview.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium">{interview.cv_candidates?.full_name || 'N/A'}</TableCell>
                    <TableCell>{interview.cv_jobs?.title || interview.cv_candidates?.cv_jobs?.title || 'N/A'}</TableCell>
                    <TableCell>{fmtDate(interview.interview_date)}</TableCell>
                    <TableCell>
                      {/* Show avatar if user found in system */}
                      {(() => {
                        const su = systemUsers.find(u => u.name === interview.interviewer);
                        return su ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                                {su.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{su.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm">{interview.interviewer}</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell><Badge className={getStatusBadgeClass(interview.status)}>{interview.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                            <MoreHorizontal className="h-4 w-4 text-gray-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50 bg-white shadow-lg border border-gray-200">
                          <DropdownMenuItem onClick={() => handleViewDetail(interview)}>Xem chi tiết</DropdownMenuItem>
                          {interview.status !== 'Hoàn thành' && interview.status !== 'Đã hủy' && (<>
                            {interview.status === 'Đang chờ' && (<>
                              <DropdownMenuItem className="text-green-600 font-medium" onClick={() => handleStartInterviewNow(interview)} disabled={submitting}>Phỏng vấn ngay</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClick(interview)}>Chỉnh sửa</DropdownMenuItem>
                            </>)}
                            {interview.status === 'Đang phỏng vấn' && (
                              <DropdownMenuItem className="text-orange-600" onClick={() => handleEndInterview(interview)} disabled={submitting}>Kết thúc sớm</DropdownMenuItem>
                            )}
                            {(interview.status === 'Đang đánh giá' || interview.status === 'Đang chờ đánh giá') && (
                              <DropdownMenuItem className="text-blue-600" onClick={() => handleOpenReviewForm(interview)}>Đánh giá</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(interview)}>Hủy lịch</DropdownMenuItem>
                          </>)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-3 p-3">
            {loading ? (
              <div className="text-center py-8"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" /></div>
            ) : filteredInterviews.length === 0 ? (
              <div className="text-center py-8"><Calendar className="mx-auto h-10 w-10 text-gray-400 mb-3" /><h3 className="text-base font-medium text-gray-900">Chưa có lịch phỏng vấn</h3></div>
            ) : filteredInterviews.map(interview => (
              <div key={interview.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-base truncate">{interview.cv_candidates?.full_name || 'N/A'}</h3>
                    <p className="text-sm text-gray-500 truncate">{interview.cv_jobs?.title || interview.cv_candidates?.cv_jobs?.title || 'N/A'}</p>
                  </div>
                  <Badge className={getStatusBadgeClass(interview.status)}>{interview.status}</Badge>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex gap-4"><span className="text-gray-500">Ngày:</span><span>{fmtDate(interview.interview_date)}</span></div>
                  <div className="flex gap-4"><span className="text-gray-500">Người PV:</span><span>{interview.interviewer}</span></div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetail(interview)}>Xem</Button>
                  {interview.status === 'Đang chờ' && (<>
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(interview)}>Sửa</Button>
                    <Button variant="outline" size="sm" onClick={() => handleStartInterviewNow(interview)} className="text-green-700 border-green-200" disabled={submitting}>PV ngay</Button>
                  </>)}
                  {(interview.status === 'Đang đánh giá' || interview.status === 'Đang chờ đánh giá') && (
                    <Button variant="outline" size="sm" onClick={() => handleOpenReviewForm(interview)} className="text-blue-700 border-blue-200">Đánh giá</Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4 text-gray-600" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white z-50 shadow-lg border border-gray-200">
                      {interview.status === 'Đang phỏng vấn' && (
                        <DropdownMenuItem className="text-orange-600" onClick={() => handleEndInterview(interview)} disabled={submitting}>Kết thúc sớm</DropdownMenuItem>
                      )}
                      {interview.status !== 'Hoàn thành' && interview.status !== 'Đã hủy' && (
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(interview)}>Hủy lịch</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Dialog TẠO LỊCH ────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />Tạo lịch phỏng vấn mới
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">Điền thông tin chi tiết để tạo lịch phỏng vấn.</p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">

            {/* Ứng viên */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium"><User className="w-4 h-4" /> Ứng viên <span className="text-red-500">*</span></label>
              {!selectedCandidate ? (
                <CandidateAutoCompleteDual onCandidateSelect={handleCandidateSelect} className="w-full" />
              ) : (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-800">Đã chọn: {selectedCandidate.full_name}</p>
                    <p className="text-xs text-blue-600 truncate">{selectedCandidate.email}</p>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                    <span className="text-sm text-gray-600">Thay đổi ứng viên</span>
                    <Button variant="ghost" size="sm" type="button" onClick={() => { setSelectedCandidate(null); setFormData(p => ({...p,candidate_id:"",job_id:""})); setUseDifferentPosition(false); }} className="h-8 w-8 p-0">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Vị trí */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium"><Briefcase className="w-4 h-4" /> Vị trí ứng tuyển <span className="text-red-500">*</span></label>
              {selectedCandidate?.cv_jobs ? (
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs font-medium text-blue-800">Vị trí đang ứng tuyển:</p>
                    <p className="text-sm font-semibold text-blue-900">{selectedCandidate.cv_jobs.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="diffPos" checked={useDifferentPosition}
                      onChange={e => { setUseDifferentPosition(e.target.checked); if (!e.target.checked) setFormData(p => ({...p,job_id:selectedCandidate.cv_jobs?.id||""})); }}
                      className="rounded border-gray-300 text-blue-600 w-4 h-4" />
                    <label htmlFor="diffPos" className="text-sm text-gray-700">Phỏng vấn vị trí khác</label>
                  </div>
                  {useDifferentPosition && (
                    <Select value={formData.job_id} onValueChange={v => setFormData(p=>({...p,job_id:v}))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Chọn vị trí phỏng vấn" /></SelectTrigger>
                      <SelectContent className="bg-white">{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <Select value={formData.job_id} onValueChange={v => setFormData(p=>({...p,job_id:v}))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn vị trí ứng tuyển" /></SelectTrigger>
                  <SelectContent className="bg-white">{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>

            {/* Ngày & Giờ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Ngày <span className="text-red-500">*</span></label>
                <Input type="date" value={formData.interview_date}
                  onChange={e => { setFormData(p=>({...p,interview_date:e.target.value})); if(formErrors.interview_date) setFormErrors(p=>({...p,interview_date:""})); }}
                  min={new Date().toISOString().split('T')[0]}
                  className={`bg-white ${formErrors.interview_date ? 'border-red-500':''}`} style={{WebkitAppearance:'none'}} />
                {formErrors.interview_date && <p className="text-xs text-red-500">{formErrors.interview_date}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Giờ <span className="text-red-500">*</span></label>
                <Input type="time" value={formData.interview_time}
                  onChange={e => { setFormData(p=>({...p,interview_time:e.target.value})); if(formErrors.interview_time) setFormErrors(p=>({...p,interview_time:""})); }}
                  className={`bg-white ${formErrors.interview_time ? 'border-red-500':''}`} style={{WebkitAppearance:'none'}} />
                {formErrors.interview_time && <p className="text-xs text-red-500">{formErrors.interview_time}</p>}
              </div>
            </div>

            {/* Thời lượng */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium"><Clock className="w-4 h-4" /> Thời lượng (phút)</label>
              <Input type="number" value={formData.duration} min="5" step="5" placeholder="60"
                onChange={e => { setFormData(p=>({...p,duration:e.target.value})); if(formErrors.duration) setFormErrors(p=>({...p,duration:""})); }}
                className={`bg-white ${formErrors.duration?'border-red-500':''}`} />
              {formErrors.duration && <p className="text-xs text-red-500">{formErrors.duration}</p>}
            </div>

            {/* Địa điểm */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium"><MapPin className="w-4 h-4" /> Địa điểm</label>
              <Input value={formData.location} onChange={e=>setFormData(p=>({...p,location:e.target.value}))} placeholder="Phòng họp, link online..." className="bg-white" />
            </div>

            {/* Hình thức */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium"><Video className="w-4 h-4" /> Hình thức</label>
              <Select value={formData.format} onValueChange={v=>setFormData(p=>({...p,format:v}))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Trực tiếp">Trực tiếp</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Người phỏng vấn (NEW: dropdown từ system users) ── */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4" /> Người phỏng vấn <span className="text-red-500">*</span>
              </label>

              {/* Info banner nếu có user trong hệ thống */}
              {systemUsers.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-1.5 mb-1">
                  <UserCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{systemUsers.length} người dùng hệ thống — chọn nhanh hoặc nhập tên khác</span>
                </div>
              )}

              <InterviewerSelect
                value={formData.interviewer}
                onChange={v => setFormData(p => ({ ...p, interviewer: v }))}
                users={systemUsers}
                disabled={submitting}
              />

              {/* Fallback: nếu không có user nào → input thường */}
              {systemUsers.length === 0 && (
                <Input
                  value={formData.interviewer}
                  onChange={e => setFormData(p => ({ ...p, interviewer: e.target.value }))}
                  placeholder="Nhập tên người phỏng vấn"
                  className="bg-white"
                />
              )}
            </div>

            {/* Ghi chú */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Ghi chú</label>
              <textarea value={formData.notes} onChange={e=>setFormData(p=>({...p,notes:e.target.value}))}
                placeholder="Ghi chú thêm..." rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white text-sm" />
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={submitting} className="w-full sm:w-auto">Hủy</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                disabled={submitting || !formData.candidate_id || !formData.job_id || !formData.interview_date || !formData.interview_time || !formData.interviewer}>
                <Calendar className="w-4 h-4 mr-2" />
                {submitting ? 'Đang tạo...' : 'Tạo lịch'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog CHỈNH SỬA ───────────────────────────────────────────── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />Chỉnh sửa lịch phỏng vấn
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">Cập nhật thông tin lịch phỏng vấn đang chờ.</p>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4 mt-4">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium"><User className="w-4 h-4" /> Ứng viên</label>
              <Input value={editFormData.candidate_name} disabled className="bg-gray-100" />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium"><Briefcase className="w-4 h-4" /> Vị trí</label>
              <Select value={editFormData.job_id} onValueChange={v=>setEditFormData(p=>({...p,job_id:v}))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Chọn vị trí" /></SelectTrigger>
                <SelectContent className="bg-white">{jobs.map(j=><SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Ngày <span className="text-red-500">*</span></label>
                <Input type="date" value={editFormData.interview_date} onChange={e=>setEditFormData(p=>({...p,interview_date:e.target.value}))}
                  className={`bg-white ${formErrors.interview_date?'border-red-500':''}`} style={{WebkitAppearance:'none'}} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Giờ <span className="text-red-500">*</span></label>
                <Input type="time" value={editFormData.interview_time} onChange={e=>setEditFormData(p=>({...p,interview_time:e.target.value}))}
                  className={`bg-white ${formErrors.interview_time?'border-red-500':''}`} style={{WebkitAppearance:'none'}} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium"><Clock className="w-4 h-4" /> Thời lượng (phút)</label>
              <Input type="number" value={editFormData.duration} min="5" step="5" onChange={e=>setEditFormData(p=>({...p,duration:e.target.value}))} className="bg-white" />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium"><MapPin className="w-4 h-4" /> Địa điểm</label>
              <Input value={editFormData.location} onChange={e=>setEditFormData(p=>({...p,location:e.target.value}))} className="bg-white" />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium"><Video className="w-4 h-4" /> Hình thức</label>
              <Select value={editFormData.format} onValueChange={v=>setEditFormData(p=>({...p,format:v}))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Trực tiếp">Trực tiếp</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Người phỏng vấn (edit — cũng dùng InterviewerSelect) ── */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4" /> Người phỏng vấn <span className="text-red-500">*</span>
              </label>
              <InterviewerSelect
                value={editFormData.interviewer}
                onChange={v => setEditFormData(p => ({ ...p, interviewer: v }))}
                users={systemUsers}
                disabled={submitting}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={()=>setIsEditDialogOpen(false)} disabled={submitting} className="w-full sm:w-auto">Hủy</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto" disabled={submitting}>
                <Pencil className="w-4 h-4 mr-2" />{submitting ? 'Đang cập nhật...' : 'Cập nhật thay đổi'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog XEM CHI TIẾT ────────────────────────────────────────── */}
      {isDetailDialogOpen && selectedInterview && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" style={{zIndex:999999}} onClick={()=>setIsDetailDialogOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none p-4 sm:p-6" style={{zIndex:1000000}}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" />Chi tiết lịch phỏng vấn</h2>
                <button onClick={()=>setIsDetailDialogOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-gray-600">Ứng viên</label><p className="mt-1 font-semibold">{selectedInterview.cv_candidates?.full_name||'N/A'}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Vị trí</label><p className="mt-1">{selectedInterview.cv_jobs?.title||selectedInterview.cv_candidates?.cv_jobs?.title||'N/A'}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Trạng thái</label><div className="mt-1"><Badge className={getStatusBadgeClass(selectedInterview.status)}>{selectedInterview.status}</Badge></div></div>
                  <div><label className="text-sm font-medium text-gray-600">Ngày & Giờ</label><p className="mt-1">{fmtDate(selectedInterview.interview_date)}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Thời lượng</label><p className="mt-1">{selectedInterview.duration} phút</p></div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Người phỏng vấn</label>
                    <div className="mt-1 flex items-center gap-2">
                      {(() => {
                        const su = systemUsers.find(u => u.name === selectedInterview.interviewer);
                        return su ? (
                          <>
                            <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">{su.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                            <span>{su.name}</span>
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700">{su.role}</Badge>
                          </>
                        ) : <span>{selectedInterview.interviewer}</span>;
                      })()}
                    </div>
                  </div>
                  <div><label className="text-sm font-medium text-gray-600">Hình thức</label><p className="mt-1">{selectedInterview.format}</p></div>
                  <div className="col-span-2"><label className="text-sm font-medium text-gray-600">Địa điểm</label><p className="mt-1">{selectedInterview.location||'Chưa có thông tin'}</p></div>
                </div>
              </div>
              <div className="border-t px-6 py-4 flex justify-end"><Button variant="outline" onClick={()=>setIsDetailDialogOpen(false)}>Đóng</Button></div>
            </div>
          </div>
        </>
      )}

      {/* ── Dialog ĐÁNH GIÁ ────────────────────────────────────────────── */}
      {isReviewFormDialogOpen && interviewToReview && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" style={{zIndex:999999}}
            onClick={()=>{setIsReviewFormDialogOpen(false);setInterviewToReview(null);setReviewData({rating:0,notes:'',outcome:'Đạt'});}} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{zIndex:1000000}}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" />Đánh giá buổi phỏng vấn</h2>
                <button onClick={()=>{setIsReviewFormDialogOpen(false);setInterviewToReview(null);setReviewData({rating:0,notes:'',outcome:'Đạt'});}} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Ứng viên</p>
                  <p className="font-semibold text-lg">{interviewToReview.cv_candidates?.full_name}</p>
                  <p className="text-sm text-gray-600 mt-1">{interviewToReview.cv_jobs?.title||interviewToReview.cv_candidates?.cv_jobs?.title}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Đánh giá <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map(star=>(
                      <button key={star} type="button" onClick={()=>setReviewData(p=>({...p,rating:star}))} className="transition-transform hover:scale-110">
                        <Star className={`w-9 h-9 ${star<=reviewData.rating?'fill-yellow-400 text-yellow-400':'text-gray-300'}`} />
                      </button>
                    ))}
                    <span className="ml-2 text-lg font-semibold text-gray-700">{reviewData.rating>0?`${reviewData.rating}/5`:'Chưa chọn'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Kết quả <span className="text-red-500">*</span></label>
                  <Select value={reviewData.outcome} onValueChange={v=>setReviewData(p=>({...p,outcome:v}))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white"><SelectItem value="Đạt">Đạt</SelectItem><SelectItem value="Không đạt">Không đạt</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Ghi chú</label>
                  <textarea value={reviewData.notes} onChange={e=>setReviewData(p=>({...p,notes:e.target.value}))}
                    placeholder="Nhận xét về buổi phỏng vấn..." rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white text-sm" />
                </div>
              </div>
              <div className="border-t px-6 py-4 flex justify-end gap-2">
                <Button variant="outline" onClick={()=>{setIsReviewFormDialogOpen(false);setInterviewToReview(null);setReviewData({rating:0,notes:'',outcome:'Đạt'});}} disabled={submitting}>Hủy</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmitReviewForm} disabled={submitting||reviewData.rating===0}>
                  <Star className="w-4 h-4 mr-2" />{submitting?'Đang lưu...':'Lưu đánh giá'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default InterviewsPage;