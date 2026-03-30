"use client"

import { useState, useEffect, useRef } from "react"
import {
  Plus, Calendar, Clock, CheckCircle, XCircle, MoreHorizontal,
  Search, User, Briefcase, MapPin, Video, X, Star, Pencil,
  ChevronDown, UserCircle
} from 'lucide-react'
import { fireCampaign } from '@/utils/campaignTriggerEngine'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabaseClient"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CandidateOption {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  status: string;
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
  candidate_id?: string;
  job_id?: string;
  cv_candidates: {
    full_name: string;
    cv_jobs: { id: string; title: string } | null;
  } | null;
  cv_jobs?: { id: string; title: string } | null;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ─── CandidateSearch ────────────────────────────────────────────────────────

interface CandidateSearchProps {
  onSelect: (candidate: CandidateOption) => void;
}

function CandidateSearch({ onSelect }: CandidateSearchProps) {
  const [query, setQuery] = useState('');
  const [allCandidates, setAllCandidates] = useState<CandidateOption[]>([]);
  const [results, setResults] = useState<CandidateOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingList(true);
      const { data, error } = await supabase
        .from('cv_candidates')
        .select(`
          id, full_name, email, phone_number, status, job_id,
          cv_jobs!job_id ( id, title, level )
        `)
        .order('full_name');

      if (!error && data) {
        const mapped = data.map((c: any) => ({
          ...c,
          cv_jobs: Array.isArray(c.cv_jobs) ? (c.cv_jobs[0] ?? null) : (c.cv_jobs ?? null),
        })) as CandidateOption[];
        setAllCandidates(mapped);
        setResults(mapped.slice(0, 50));
      }
      setLoadingList(false);
    };
    load();
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults(allCandidates.slice(0, 50));
    } else {
      setResults(
        allCandidates.filter(c =>
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone_number || '').includes(q) ||
          (c.cv_jobs?.title || '').toLowerCase().includes(q)
        ).slice(0, 50)
      );
    }
  }, [query, allCandidates]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const statusColor = (s: string) => {
    switch (s) {
      case 'Mới': return 'bg-blue-100 text-blue-700';
      case 'Sàng lọc': return 'bg-yellow-100 text-yellow-700';
      case 'Phỏng vấn': return 'bg-purple-100 text-purple-700';
      case 'Chấp nhận': return 'bg-green-100 text-green-700';
      case 'Từ chối': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { setResults(allCandidates.slice(0, 50)); setOpen(true); }}
          placeholder="Tìm theo tên, email, SĐT hoặc vị trí ứng tuyển..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
        {loadingList && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && (
        <div className="absolute z-[60] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">
              {results.length > 0
                ? `${results.length} ứng viên${query.trim() ? ` khớp "${query.trim()}"` : ' — tất cả'}`
                : 'Không tìm thấy ứng viên'}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {results.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Không tìm thấy ứng viên phù hợp
              </div>
            ) : results.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelect(c); setOpen(false); setQuery(''); }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-blue-50 transition-colors group"
              >
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className="text-sm bg-gradient-to-br from-blue-400 to-purple-500 text-white font-medium">
                    {c.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 truncate">
                      {c.full_name}
                    </span>
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${statusColor(c.status)}`}>
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{c.email}</p>
                  {c.cv_jobs && (
                    <p className="text-xs text-blue-600 truncate mt-0.5 flex items-center gap-1">
                      <Briefcase className="h-3 w-3 flex-shrink-0" />
                      {c.cv_jobs.title}
                      {c.cv_jobs.level && <span className="text-gray-400">· {c.cv_jobs.level}</span>}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── InterviewerSelect ────────────────────────────────────────────────────────

interface InterviewerSelectProps {
  value: string;
  onChange: (name: string) => void;
  users: SystemUser[];
  placeholder?: string;
  disabled?: boolean;
}

function InterviewerSelect({
  value, onChange, users, placeholder = "Chọn hoặc nhập tên người phỏng vấn", disabled,
}: InterviewerSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

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

  const roleBadgeColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN': return 'bg-red-100 text-red-700';
      case 'HR': return 'bg-purple-100 text-purple-700';
      case 'INTERVIEWER': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className={`w-full flex items-center justify-between gap-2 px-3 h-10 rounded-lg border border-gray-300 bg-white text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${open ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}
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
              <Badge className={`text-[10px] px-1.5 py-0 h-4 ${roleBadgeColor(selectedUser.role)}`}>
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

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
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

          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
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
            ) : filtered.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => { onChange(user.name); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${value === user.name ? 'bg-blue-50' : ''}`}
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
                <Badge className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${roleBadgeColor(user.role)}`}>
                  {user.role}
                </Badge>
                {value === user.name && (
                  <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 p-2">
            <p className="text-xs text-gray-400 text-center">Hoặc nhập tên tuỳ ý nếu không có trong danh sách</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InterviewsPage() {
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
  const [jobs, setJobs] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [useDifferentPosition, setUseDifferentPosition] = useState(false);

  const [reviewData, setReviewData] = useState({ rating: 0, notes: '', outcome: 'Đạt' });
  const [interviewToReview, setInterviewToReview] = useState<Interview | null>(null);

  const [formData, setFormData] = useState({
    candidate_id: "", job_id: "", interview_date: "", interview_time: "",
    duration: "60", location: "", format: "Trực tiếp", interviewer: "", notes: "",
  });

  const [editFormData, setEditFormData] = useState({
    id: "", job_id: "", interview_date: "", interview_time: "",
    duration: "", location: "", format: "", interviewer: "", candidate_name: "",
  });

  const [formErrors, setFormErrors] = useState({
    interview_date: "", interview_time: "", duration: "",
  });

  const getInterviewStatus = (iv: Interview) => {
    const now = new Date();
    const start = new Date(iv.interview_date);
    if (['Hoàn thành', 'Đã hủy', 'Đang đánh giá', 'Đang chờ đánh giá'].includes(iv.status))
      return iv.status;
    if (start > now) return 'Đang chờ';
    const end = new Date(start.getTime() + (parseInt(iv.duration) || 60) * 60000);
    if (now <= end) return 'Đang phỏng vấn';
    return iv.status === 'Đang chờ' ? 'Đang chờ đánh giá' : iv.status;
  };

  const fetchInterviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cv_interviews')
      .select(`
        *,
        cv_candidates!candidate_id ( full_name, cv_jobs!job_id ( id, title ) ),
        cv_jobs!job_id ( id, title )
      `)
      .order('interview_date', { ascending: false });
    if (data)
      setInterviews(data.map(i => ({ ...i, status: getInterviewStatus(i as Interview) })) as Interview[]);
    if (error) console.error(error);
    setLoading(false);
  };

  const fetchSystemUsers = async () => {
    const { data, error } = await supabase
      .from('cv_profiles')
      .select(`id, full_name, email, status, cv_user_roles ( role_id, cv_roles ( name ) )`)
      .eq('status', 'active')
      .order('full_name');

    if (!error && data) {
      setSystemUsers(data.map((u: any) => ({
        id: u.id,
        name: u.full_name || 'Không có tên',
        email: u.email || '',
        role: (u.cv_user_roles?.[0]?.cv_roles?.name || 'USER').toUpperCase(),
      })));
    }
  };

  useEffect(() => {
    const initFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('create') === 'true') {
        setIsDialogOpen(true);
        const candidateId = params.get('candidateId');
        if (candidateId) {
          const { data } = await supabase
            .from('cv_candidates')
            .select(`id, full_name, email, phone_number, status, job_id, cv_jobs!job_id ( id, title, level )`)
            .eq('id', candidateId)
            .single();
          if (data) {
            const raw = data.cv_jobs as any;
            const job = Array.isArray(raw) ? raw[0] : raw;
            const candidate: CandidateOption = {
              id: data.id, full_name: data.full_name, email: data.email,
              phone_number: data.phone_number, status: data.status, job_id: job?.id, cv_jobs: job,
            };
            setSelectedCandidate(candidate);
            setFormData(prev => ({ ...prev, candidate_id: data.id, job_id: job?.id || '' }));
          }
        }
        window.history.replaceState({}, '', '/phong-van');
      }
    };
    initFromUrl();
    fetchInterviews();
    fetchSystemUsers();
  }, []);

  useEffect(() => {
    supabase.from('cv_jobs').select('id, title').order('title').then(({ data }) => {
      if (data) setJobs(data);
    });
  }, []);

  const handleCandidateSelect = (c: CandidateOption) => {
    setSelectedCandidate(c);
    setUseDifferentPosition(false);
    setFormData(prev => ({ ...prev, candidate_id: c.id, job_id: c.cv_jobs?.id || '' }));
  };

  const handleClearCandidate = () => {
    setSelectedCandidate(null);
    setUseDifferentPosition(false);
    setFormData(prev => ({ ...prev, candidate_id: '', job_id: '' }));
  };

  const validateDateTime = () => {
    const errors = { interview_date: "", interview_time: "", duration: "" };
    if (!formData.interview_date) errors.interview_date = "Vui lòng chọn ngày phỏng vấn";
    if (!formData.interview_time) errors.interview_time = "Vui lòng chọn giờ phỏng vấn";
    const dur = parseInt(formData.duration);
    if (!dur || dur < 5) errors.duration = "Thời lượng tối thiểu 5 phút";
    if (formData.interview_date && formData.interview_time) {
      const [y, mo, d] = formData.interview_date.split('-');
      const [h, mi] = formData.interview_time.split(':');
      const dt = new Date(+y, +mo - 1, +d, +h, +mi);
      if (isNaN(dt.getTime())) errors.interview_date = "Ngày giờ không hợp lệ";
      else if (dt <= new Date()) {
        errors.interview_date = "Ngày giờ phỏng vấn phải ở tương lai";
        errors.interview_time = "Ngày giờ phỏng vấn phải ở tương lai";
      }
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
      
      if (formData.candidate_id) {
        fireCampaign('interview_created', {
          candidateId: formData.candidate_id,
          candidateName: selectedCandidate?.full_name,
          interviewDate: localDate.toISOString(),
          interviewFormat: formData.format,
          interviewLocation: formData.location,
          jobTitle: selectedCandidate?.cv_jobs?.title || jobs.find(j => j.id === formData.job_id)?.title,
          interviewerName: formData.interviewer,
        }).catch(console.error);
      }
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi tạo lịch phỏng vấn!');
    } finally { setSubmitting(false); }
  };

  const handleViewDetail = (iv: Interview) => { setSelectedInterview(iv); setIsDetailDialogOpen(true); };

  const handleEndInterview = async (iv: Interview) => {
    if (!confirm(`Kết thúc sớm phỏng vấn với ${iv.cv_candidates?.full_name}?`)) return;
    setSubmitting(true);
    const { error } = await supabase.from('cv_interviews').update({ status: 'Đang đánh giá' }).eq('id', iv.id);
    if (!error) setInterviews(prev => prev.map(i => i.id === iv.id ? { ...i, status: 'Đang đánh giá' } : i));
    setSubmitting(false);
  };

  const handleStartInterviewNow = async (iv: Interview) => {
    if (!confirm(`Bắt đầu phỏng vấn ngay với ${iv.cv_candidates?.full_name}?`)) return;
    setSubmitting(true);
    const { error } = await supabase.from('cv_interviews').update({ status: 'Đang phỏng vấn' }).eq('id', iv.id);
    if (!error) setInterviews(prev => prev.map(i => i.id === iv.id ? { ...i, status: 'Đang phỏng vấn' } : i));
    setSubmitting(false);
  };

  const handleDelete = async (iv: Interview) => {
    if (!confirm(`Hủy lịch phỏng vấn với ${iv.cv_candidates?.full_name}?`)) return;
    setSubmitting(true);
    const { error } = await supabase.from('cv_interviews').update({ status: 'Đã hủy' }).eq('id', iv.id);
    if (!error) setInterviews(prev => prev.map(i => i.id === iv.id ? { ...i, status: 'Đã hủy' } : i));
    setSubmitting(false);
  };

  const handleEditClick = (iv: Interview) => {
    const dt = new Date(iv.interview_date);
    setEditFormData({
      id: iv.id,
      job_id: iv.job_id || iv.cv_candidates?.cv_jobs?.id || "",
      interview_date: `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`,
      interview_time: `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
      duration: iv.duration,
      location: iv.location,
      format: iv.format,
      interviewer: iv.interviewer,
      candidate_name: iv.cv_candidates?.full_name || "Ứng viên",
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
    
    let dt: Date | null = null;
    if (editFormData.interview_date && editFormData.interview_time) {
      dt = new Date(`${editFormData.interview_date}T${editFormData.interview_time}:00`);
      if (isNaN(dt.getTime())) errors.interview_date = "Ngày giờ không hợp lệ";
      else if (dt <= new Date()) { errors.interview_date = "Thời gian phải ở tương lai"; errors.interview_time = "Thời gian phải ở tương lai"; }
    }
    
    if (errors.interview_date || errors.interview_time || errors.duration) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      const isoDateTimeString = dt!.toISOString();
      const { error } = await supabase.from('cv_interviews').update({
        interview_date: isoDateTimeString, duration: editFormData.duration,
        format: editFormData.format, interviewer: editFormData.interviewer,
        location: editFormData.location, job_id: editFormData.job_id,
      }).eq('id', editFormData.id);
      if (error) throw error;
      await fetchInterviews();
      setIsEditDialogOpen(false);
      alert('Cập nhật lịch phỏng vấn thành công!');
      
      fireCampaign('interview_rescheduled', {
        interviewId: editFormData.id,
        interviewDate: isoDateTimeString,
        interviewFormat: editFormData.format,
        interviewLocation: editFormData.location,
        interviewerName: editFormData.interviewer,
      }).catch(console.error);
    } catch (err: any) { alert(`Lỗi: ${err.message}`); }
    finally { setSubmitting(false); }
  };

  const handleOpenReviewForm = (iv: Interview) => {
    setInterviewToReview(iv);
    setReviewData({ rating: 0, notes: '', outcome: 'Đạt' });
    setIsReviewFormDialogOpen(true);
  };

  const handleSubmitReviewForm = async () => {
    if (!interviewToReview || reviewData.rating === 0) { alert('Vui lòng chọn số sao!'); return; }
    setSubmitting(true);
    try {
      await supabase.from('cv_interview_reviews').insert([{
        interview_id: interviewToReview.id, rating: reviewData.rating,
        notes: reviewData.notes, outcome: reviewData.outcome,
      }]);
      await supabase.from('cv_interviews').update({ status: 'Hoàn thành' }).eq('id', interviewToReview.id);
      if (['Đạt','Không đạt'].includes(reviewData.outcome)) {
        const { data: iv } = await supabase.from('cv_interviews')
          .select('candidate_id').eq('id', interviewToReview.id).single();
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
      
      // FIRE CAMPAIGN interview_result_published
      if (['Đạt','Không đạt'].includes(reviewData.outcome)) {
          const ivData = interviews.find(i => i.id === interviewToReview.id);
          fireCampaign('interview_result_published', {
              interviewId: interviewToReview.id,
              candidateName: ivData?.cv_candidates?.full_name,
              result: reviewData.outcome,
              rating: reviewData.rating,
              feedback: reviewData.notes,
              jobTitle: ivData?.cv_jobs?.title || ivData?.cv_candidates?.cv_jobs?.title,
              interviewDate: ivData?.interview_date,
              interviewerName: ivData?.interviewer
          }).catch(console.error);
      }
      
      alert('✓ Đánh giá đã được lưu thành công!');
    } catch (err) { console.error(err); alert('Có lỗi xảy ra!'); }
    finally { setSubmitting(false); }
  };

  const totalInterviews = interviews.length;
  const pendingInterviews = interviews.filter(i => i.status === 'Đang chờ').length;
  const completedInterviews = interviews.filter(i => i.status === 'Hoàn thành').length;
  const cancelledInterviews = interviews.filter(i => i.status === 'Đã hủy').length;

  const filteredInterviews = interviews.filter(i => {
    const position = i.cv_jobs?.title || i.cv_candidates?.cv_jobs?.title;
    return (
      (!searchTerm || i.cv_candidates?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        position?.toLowerCase().includes(searchTerm.toLowerCase())) &&
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
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit',
  });

  const InterviewerCell = ({ name }: { name: string }) => {
    const su = systemUsers.find(u => u.name === name);
    return su ? (
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
            {su.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm">{su.name}</span>
      </div>
    ) : <span className="text-sm">{name}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

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

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {[
          { label:'Tổng số', value:totalInterviews, icon:<Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 shrink-0"/>, pct:'+8%', pctColor:'text-blue-600' },
          { label:'Đang chờ', value:pendingInterviews, icon:<Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 shrink-0"/>, pct:'+3%', pctColor:'text-orange-600' },
          { label:'Hoàn thành', value:completedInterviews, icon:<CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 shrink-0"/>, pct:'+12%', pctColor:'text-green-600' },
          { label:'Đã hủy', value:cancelledInterviews, icon:<XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 shrink-0"/>, pct:'-5%', pctColor:'text-red-600' },
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

      <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
        <div className="relative min-w-[180px] sm:min-w-[250px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm theo tên ứng viên, vị trí..." className="pl-10 bg-white"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[150px] sm:w-[180px] bg-white"><SelectValue placeholder="Vị trí" /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Tất cả vị trí</SelectItem>
            {Array.from(new Set(interviews.map(i => i.cv_jobs?.title || i.cv_candidates?.cv_jobs?.title).filter(Boolean))).map(p => (
              <SelectItem key={p as string} value={p as string}>{p as string}</SelectItem>
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

      <Card className="shadow-sm border-2 border-gray-100 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Danh sách lịch phỏng vấn</CardTitle>
          <div className="text-xs sm:text-sm text-muted-foreground">{filteredInterviews.length} / {totalInterviews}</div>
        </CardHeader>
        <CardContent className="p-0">

          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Ứng viên</TableHead>
                  <TableHead>Vị trí</TableHead>
                  <TableHead>Ngày & Giờ</TableHead>
                  <TableHead>Người phỏng vấn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Đang tải dữ liệu...</TableCell></TableRow>
                ) : filteredInterviews.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Không có lịch phỏng vấn</TableCell></TableRow>
                ) : (
                  filteredInterviews.map((iv) => (
                    <TableRow key={iv.id}>
                      <TableCell className="font-medium">{iv.cv_candidates?.full_name || 'N/A'}</TableCell>
                      <TableCell>{iv.cv_jobs?.title || iv.cv_candidates?.cv_jobs?.title || 'N/A'}</TableCell>
                      <TableCell>{fmtDate(iv.interview_date)}</TableCell>
                      <TableCell><InterviewerCell name={iv.interviewer} /></TableCell>
                      <TableCell><Badge className={getStatusBadgeClass(iv.status)}>{iv.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50 bg-white">
                            <DropdownMenuItem onClick={() => handleViewDetail(iv)}>Xem chi tiết</DropdownMenuItem>
                            {iv.status !== 'Hoàn thành' && iv.status !== 'Đã hủy' && (
                              <>
                                {iv.status === 'Đang chờ' && (
                                  <>
                                    <DropdownMenuItem className="text-green-600 font-medium" onClick={() => handleStartInterviewNow(iv)} disabled={submitting}>Phỏng vấn ngay</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditClick(iv)}>Chỉnh sửa</DropdownMenuItem>
                                    <DropdownMenuItem className="text-blue-600 font-medium" onClick={() => window.location.assign(`/quan-ly-email?compose=true&candidate_id=${iv.candidate_id || ''}`)}>Gửi mail thông báo</DropdownMenuItem>
                                  </>
                                )}
                                {iv.status === 'Đang phỏng vấn' && (
                                  <DropdownMenuItem className="text-orange-600" onClick={() => handleEndInterview(iv)} disabled={submitting}>Kết thúc sớm</DropdownMenuItem>
                                )}
                                {(iv.status === 'Đang đánh giá' || iv.status === 'Đang chờ đánh giá') && (
                                   <DropdownMenuItem className="text-blue-600" onClick={() => handleOpenReviewForm(iv)}>Đánh giá</DropdownMenuItem>
                                 )}
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(iv)}>Hủy lịch</DropdownMenuItem>
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
          </div>

          <div className="sm:hidden space-y-3 p-3">
            {filteredInterviews.map((iv) => (
              <div key={iv.id} className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="flex justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold">{iv.cv_candidates?.full_name}</h3>
                    <p className="text-sm text-gray-500">{iv.cv_jobs?.title || iv.cv_candidates?.cv_jobs?.title}</p>
                  </div>
                  <Badge className={getStatusBadgeClass(iv.status)}>{iv.status}</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-500">Ngày:</span> {fmtDate(iv.interview_date)}</div>
                  <div className="flex items-center gap-1"><span className="text-gray-500">Người PV:</span> <InterviewerCell name={iv.interviewer} /></div>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetail(iv)}>Xem</Button>
                  {iv.status === 'Đang chờ' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(iv)}>Sửa</Button>
                      <Button variant="outline" size="sm" className="text-green-700" onClick={() => handleStartInterviewNow(iv)}>PV ngay</Button>
                    </>
                  )}
                  {(iv.status === 'Đang đánh giá' || iv.status === 'Đang chờ đánh giá') && (
                    <Button variant="outline" size="sm" className="text-blue-700" onClick={() => handleOpenReviewForm(iv)}>Đánh giá</Button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tạo lịch phỏng vấn mới</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ứng viên <span className="text-red-500">*</span></label>
              {!selectedCandidate ? <CandidateSearch onSelect={handleCandidateSelect} /> : (
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold text-blue-900">{selectedCandidate.full_name}</p>
                  </div>
                  <button type="button" onClick={handleClearCandidate} className="text-xs text-red-500">Chọn lại</button>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Vị trí ứng tuyển <span className="text-red-500">*</span></label>
              <Select value={formData.job_id} onValueChange={v => setFormData(p => ({ ...p, job_id: v }))}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Chọn vị trí" /></SelectTrigger>
                <SelectContent className="bg-white">{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ngày <span className="text-red-500">*</span></label>
                <Input type="date" className={formErrors.interview_date ? 'border-red-500' : ''} value={formData.interview_date} onChange={e => setFormData({ ...formData, interview_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Giờ <span className="text-red-500">*</span></label>
                <Input type="time" className={formErrors.interview_time ? 'border-red-500' : ''} value={formData.interview_time} onChange={e => setFormData({ ...formData, interview_time: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Thời lượng (phút) <span className="text-red-500">*</span></label>
                <Input type="number" min="5" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hình thức</label>
                <Select value={formData.format} onValueChange={v => setFormData({ ...formData, format: v })}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white"><SelectItem value="Trực tiếp">Trực tiếp</SelectItem><SelectItem value="Online">Online</SelectItem><SelectItem value="Điện thoại">Điện thoại</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Người phỏng vấn</label>
              <InterviewerSelect value={formData.interviewer} onChange={v => setFormData({ ...formData, interviewer: v })} users={systemUsers} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Địa điểm / Link</label>
              <Input placeholder="Phòng họp 1 or meet.google.com/..." value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo lịch'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cập nhật lịch phỏng vấn</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ứng viên</label>
              <Input value={editFormData.candidate_name} disabled className="bg-gray-50 text-gray-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ngày <span className="text-red-500">*</span></label>
                <Input type="date" value={editFormData.interview_date} onChange={e => setEditFormData({ ...editFormData, interview_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Giờ <span className="text-red-500">*</span></label>
                <Input type="time" value={editFormData.interview_time} onChange={e => setEditFormData({ ...editFormData, interview_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Thời lượng (phút)</label>
                <Input type="number" min="5" value={editFormData.duration} onChange={e => setEditFormData({ ...editFormData, duration: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hình thức</label>
                <Select value={editFormData.format} onValueChange={v => setEditFormData({ ...editFormData, format: v })}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white"><SelectItem value="Trực tiếp">Trực tiếp</SelectItem><SelectItem value="Online">Online</SelectItem><SelectItem value="Điện thoại">Điện thoại</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Người phỏng vấn</label>
              <InterviewerSelect value={editFormData.interviewer} onChange={v => setEditFormData({ ...editFormData, interviewer: v })} users={systemUsers} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Địa điểm / Link</label>
              <Input value={editFormData.location} onChange={e => setEditFormData({ ...editFormData, location: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={submitting}>Cập nhật</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewFormDialogOpen} onOpenChange={setIsReviewFormDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Đánh giá phỏng vấn</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 mt-2">
              <label className="text-sm font-medium">Kết quả</label>
              <Select value={reviewData.outcome} onValueChange={v => setReviewData({ ...reviewData, outcome: v })}>
                <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="Đạt">Đạt</SelectItem><SelectItem value="Không đạt">Không đạt</SelectItem><SelectItem value="Dự phòng">Dự phòng</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Đánh giá chung (Sao) <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(s => (
                  <button key={s} type="button" onClick={() => setReviewData({ ...reviewData, rating: s })} className="focus:outline-none">
                    <Star className={`h-8 w-8 ${reviewData.rating >= s ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nhận xét chi tiết</label>
              <textarea className="w-full h-24 p-3 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Điểm mạnh, yếu, mức độ phù hợp..." value={reviewData.notes} onChange={e => setReviewData({ ...reviewData, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsReviewFormDialogOpen(false)}>Hủy</Button>
              <Button onClick={handleSubmitReviewForm} disabled={submitting}>Lưu đánh giá</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-[425px]">
          <DialogHeader><DialogTitle>Chi tiết phỏng vấn</DialogTitle></DialogHeader>
          {selectedInterview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 py-2 border-b"><div className="text-sm text-gray-500">Ứng viên:</div><div className="col-span-2 font-medium">{selectedInterview.cv_candidates?.full_name}</div></div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b"><div className="text-sm text-gray-500">Vị trí:</div><div className="col-span-2">{selectedInterview.cv_jobs?.title || selectedInterview.cv_candidates?.cv_jobs?.title}</div></div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b"><div className="text-sm text-gray-500">Thời gian:</div><div className="col-span-2">{fmtDate(selectedInterview.interview_date)} ({selectedInterview.duration} phút)</div></div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b"><div className="text-sm text-gray-500">Hình thức:</div><div className="col-span-2">{selectedInterview.format}</div></div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b"><div className="text-sm text-gray-500">Người PV:</div><div className="col-span-2"><InterviewerCell name={selectedInterview.interviewer} /></div></div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b"><div className="text-sm text-gray-500">Nơi PV:</div><div className="col-span-2">{selectedInterview.location}</div></div>
              <div className="grid grid-cols-3 gap-2 py-2"><div className="text-sm text-gray-500">Trạng thái:</div><div className="col-span-2"><Badge className={getStatusBadgeClass(selectedInterview.status)}>{selectedInterview.status}</Badge></div></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}