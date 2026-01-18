"use client"
import { useState, useEffect } from "react"
import { Search, Plus, Eye, Edit, Trash2, Users, UserCheck, TrendingUp, Filter, Download, FileText, Brain, X, AlertTriangle, CheckCircle2, Info, MoreHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { saveCandidateSkills, getCandidateSkills, type Skill } from "@/utils/skillsHelper"
import { SkillsInput } from "@/components/ui/skills-input"
import { Input } from "@/components/ui/input"

// ✅ THÊM IMPORT MỚI - Activity Logger
import { ActivityLogger } from '@/lib/activityLogger';

// Checkbox component inline definition (nếu chưa có trong project)
const Checkbox = ({ id, checked, onCheckedChange, className }: { 
  id?: string; 
  checked: boolean; 
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) => (
  <input
    type="checkbox"
    id={id}
    checked={checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
    className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${className || ''}`}
  />
);

import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import { parseCV, validateCVFile, type ParsedCV } from "@/utils/cvParser"

const getStatusBadge = (status: string) => {
  if (status === "Mới") return <Badge variant="outline" className="text-blue-600 border-blue-600 bg-blue-50">Mới</Badge>
  if (status === "Sàng lọc") return <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">Sàng lọc</Badge>
  if (status === "Phỏng vấn") return <Badge variant="outline" className="text-purple-600 border-purple-600 bg-purple-50">Phỏng vấn</Badge>
  if (status === "Chấp nhận") return <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">Chấp nhận</Badge>
  if (status === "Từ chối") return <Badge variant="outline" className="text-red-600 border-red-600 bg-red-50">Từ chối</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

interface Candidate {
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
  cv_parsed_data?: any;
  mandatory_requirements_met?: boolean;
  mandatory_requirements_notes?: string;
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

interface Job {
  id: string;
  title: string;
  level: string;
  department: string;
  description: string;
  requirements: string;
  benefits: string;
  mandatory_requirements?: string;
  job_type: string;
  work_location: string;
  location: string;
}

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<'basic' | 'cv' | 'requirements'>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCV | null>(null);
  
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null);
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Candidate | null>(null);
  const [viewCVCandidate, setViewCVCandidate] = useState<Candidate | null>(null);
  const [analyzeCVCandidate, setAnalyzeCVCandidate] = useState<Candidate | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempFilterStatus, setTempFilterStatus] = useState<string>('all');
  const [tempFilterPosition, setTempFilterPosition] = useState<string>('all');
  const [tempFilterLevel, setTempFilterLevel] = useState<string>('all');
  const [tempFilterSource, setTempFilterSource] = useState<string>('all');
  
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isLoadingCV, setIsLoadingCV] = useState(false);
  const [isLoadingAnalyze, setIsLoadingAnalyze] = useState(false);
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [mandatoryRequirementsMet, setMandatoryRequirementsMet] = useState(false);
  const [mandatoryRequirementsNotes, setMandatoryRequirementsNotes] = useState('');
  const [showRequirementsWarning, setShowRequirementsWarning] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    job_id: '',
    address: '',
    experience: '',
    education: '',
    university: '',
    status: 'Mới',
    source: '',
    skills: [] as string[]
  });

  useEffect(() => {
    fetchCandidates();
  }, []);

  useEffect(() => {
    async function getJobs() {
      const { data, error } = await supabase
        .from('cv_jobs')
        .select('id, title, level, department, description, requirements, benefits, mandatory_requirements, job_type, work_location, location')
        .order('title');

      if (data) {
        console.log('Fetched jobs with full data:', data.length, 'jobs');
        console.log('Sample job data:', data[0]);
        setJobs(data);
      }
      if (error) {
        console.error('Error fetching jobs:', error);
      }
    }
    getJobs();
  }, []);

  useEffect(() => {
    if (formData.job_id) {
      const job = jobs.find(j => j.id === formData.job_id);
      setSelectedJob(job || null);
      
      if (job?.mandatory_requirements) {
        setCurrentTab('requirements');
      }
    } else {
      setSelectedJob(null);
      setMandatoryRequirementsMet(false);
      setMandatoryRequirementsNotes('');
    }
  }, [formData.job_id, jobs]);

  const fetchCandidates = async () => {
    setLoading(true);
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

    if (data) {
      const candidatesData = data as Candidate[];
      setCandidates(candidatesData);
    }
    if (error) {
      console.error('Error fetching candidates:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone_number: '',
      job_id: '',
      address: '',
      experience: '',
      education: '',
      university: '',
      status: 'Mới',
      source: '',
      skills: []
    });
    setCurrentTab('basic');
    setSelectedFile(null);
    setParsedData(null);
    setSelectedJob(null);
    setMandatoryRequirementsMet(false);
    setMandatoryRequirementsNotes('');
    setShowRequirementsWarning(false);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateCVFile(file);
    if (!validation.valid) {
      alert(validation.error);
      event.target.value = '';
      return;
    }

    setSelectedFile(file);

    try {
      setIsUploading(true);
      
      console.log('=== BẮT ĐẦU PARSE CV ===');
      const parsed = await parseCV(file);
      console.log('=== KẾT QUẢ PARSE ===', parsed);
      
      setParsedData(parsed);

      let filledCount = 0;
      const foundInfo = [];

      if (parsed.fullName) {
        console.log('✅ Điền Họ và tên:', parsed.fullName);
        handleInputChange('full_name', parsed.fullName);
        foundInfo.push(`👤 Họ tên: ${parsed.fullName}`);
        filledCount++;
      } else {
        console.log('❌ Không tìm thấy Họ và tên');
      }

      if (parsed.email) {
        console.log('✅ Điền Email:', parsed.email);
        handleInputChange('email', parsed.email);
        foundInfo.push(`📧 Email: ${parsed.email}`);
        filledCount++;
      } else {
        console.log(' Không tìm thấy Email');
      }

      if (parsed.phone) {
        console.log('✅ Điền SĐT:', parsed.phone);
        handleInputChange('phone_number', parsed.phone);
        foundInfo.push(`📱 SĐT: ${parsed.phone}`);
        filledCount++;
      } else {
        console.log('❌ Không tìm thấy SĐT');
      }

      if (parsed.address) {
        console.log('✅ Điền Địa chỉ:', parsed.address);
        handleInputChange('address', parsed.address);
        foundInfo.push(`📍 Địa chỉ: ${parsed.address}`);
        filledCount++;
      } else {
        console.log('❌ Không tìm thấy Địa chỉ');
      }

      if (parsed.university) {
        console.log('✅ Điền Trường học:', parsed.university);
        handleInputChange('university', parsed.university);
        foundInfo.push(`🎓 Trường: ${parsed.university}`);
        filledCount++;
      } else {
        console.log('❌ Không tìm thấy Trường học');
      }

      if (parsed.education) {
        console.log('✅ Điền Học vấn:', parsed.education);
        handleInputChange('education', parsed.education);
        foundInfo.push(`📚 Học vấn: ${parsed.education}`);
        filledCount++;
      } else {
        console.log('❌ Không tìm thấy Học vấn');
      }

      if (parsed.experience) {
        console.log('✅ Điền Kinh nghiệm:', parsed.experience.substring(0, 100));
        handleInputChange('experience', parsed.experience);
        const expPreview = parsed.experience.length > 50 
          ? parsed.experience.substring(0, 50) + '...' 
          : parsed.experience;
        foundInfo.push(`💼 Kinh nghiệm: ${expPreview}`);
        filledCount++;
      } else {
        console.log('❌ Không tìm thấy Kinh nghiệm');
      }

      if (parsed.skills && parsed.skills.length > 0) {
        console.log('✅ Điền Skills:', parsed.skills);
        handleInputChange('skills', parsed.skills);
        foundInfo.push(`🔧 Kỹ năng: ${parsed.skills.length} kỹ năng (${parsed.skills.slice(0, 5).join(', ')}${parsed.skills.length > 5 ? '...' : ''})`);
        filledCount++;
      } else {
        console.log('❌ Không tìm thấy Skills');
      }

      console.log('=== TỔNG KẾT ===');
      console.log(`Đã điền: ${filledCount}/8 trường`);

      const message = filledCount > 0
        ? `✅ Đã phân tích CV thành công!\n\n` +
          `Tự động điền ${filledCount}/8 trường:\n${foundInfo.join('\n')}\n\n` +
          `${filledCount < 8 ? '⚠️ Vui lòng bổ sung các trường còn thiếu.' : '✓ Tất cả thông tin đã được điền!'}`
        : `⚠️ Không thể trích xuất thông tin từ CV.\n\n` +
          `Vui lòng nhập thủ công hoặc thử file CV khác.`;

      alert(message);

      if (filledCount > 0) {
        setTimeout(() => {
          setCurrentTab('basic');
        }, 300);
      }

    } catch (error: any) {
      console.error('❌ Lỗi parse CV:', error);
      alert('⚠️ Không thể phân tích CV:\n' + (error.message || 'Lỗi không xác định'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setParsedData(null);
  };

  // ✅ CẬP NHẬT: handleSubmit - Thêm logging và RÀNG BUỘC TRẠNG THÁI "MỚI"
  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email || !formData.job_id) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc (Họ tên, Email, Vị trí ứng tuyển)');
      return;
    }

    if (selectedJob?.mandatory_requirements && !mandatoryRequirementsMet) {
      setShowRequirementsWarning(true);
      setCurrentTab('requirements');
      return;
    }

    setIsSaving(true);
    try {
      let cvUrl = null;
      let cvFileName = null;
      let parsedCV = null;

      if (selectedFile) {
        const fileName = `${Date.now()}_${selectedFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('cv-files')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('cv-files').getPublicUrl(fileName);
        cvUrl = publicUrlData.publicUrl;
        cvFileName = selectedFile.name;
        parsedCV = parsedData;
      }

      const { data, error } = await supabase
        .from('cv_candidates')
        .insert({
          full_name: formData.full_name,
          email: formData.email,
          phone_number: formData.phone_number || null,
          job_id: formData.job_id,
          address: formData.address || null,
          experience: formData.experience || null,
          education: formData.education || null,
          university: formData.university || null,
          status: 'Mới', // 🔒 LUÔN LUÔN LÀ "MỚI" KHI TẠO
          source: formData.source || null,
          cv_url: cvUrl,
          cv_file_name: cvFileName,
          cv_parsed_data: parsedCV,
          mandatory_requirements_met: mandatoryRequirementsMet,
          mandatory_requirements_notes: mandatoryRequirementsNotes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Save skills
      await saveCandidateSkills(data.id, formData.skills);

      // ✅ LOG ACTIVITY - Thêm ứng viên mới
      try {
        const jobTitle = jobs.find(j => j.id === formData.job_id)?.title;
        await ActivityLogger.logCVSubmitted(
          formData.full_name,
          data.id,
          jobTitle
        );
      } catch (logError) {
        console.error('Failed to log activity:', logError);
        // Không throw để không ảnh hưởng UX
      }

      // Fetch full data
      const { data: fullData } = await supabase
        .from('cv_candidates')
        .select(`
          *,
          cv_jobs ( title, level ),
          cv_candidate_skills ( 
            cv_skills ( id, name, category )
          )
        `)
        .eq('id', data.id)
        .single();

      if (fullData) {
        setCandidates(prev => [fullData as Candidate, ...prev]);
        
        setIsDialogOpen(false);
        resetForm();
        alert('✓ Thêm ứng viên thành công!');
      }
    } catch (err: any) {
      console.error('Error creating candidate:', err);
      alert('Lỗi: ' + (err.message || 'Không thể thêm ứng viên'));
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ CẬP NHẬT: handleUpdateCandidate - Thêm logging
  const handleUpdateCandidate = async () => {
    if (!editCandidate) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('cv_candidates')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone_number: formData.phone_number || null,
          address: formData.address || null,
          experience: formData.experience || null,
          education: formData.education || null,
          university: formData.university || null,
          // status: formData.status, // ⚠️ ĐÃ LOẠI BỎ CẬP NHẬT STATUS Ở ĐÂY NHƯ YÊU CẦU TRƯỚC
          source: formData.source || null,
        })
        .eq('id', editCandidate.id)
        .select(`
          *,
          cv_jobs ( title, level )
        `);

      if (error) throw error;

      // Save skills
      await saveCandidateSkills(editCandidate.id, formData.skills);

      // ✅ LOG ACTIVITY - Cập nhật ứng viên
      try {
        await ActivityLogger.logCustomActivity(
          'Cập nhật thông tin ứng viên',
          `Cập nhật thông tin ứng viên ${formData.full_name}`,
          'cv',
          editCandidate.id
        );
      } catch (logError) {
        console.error('Failed to log activity:', logError);
      }

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
        .eq('id', editCandidate.id)
        .single();

      if (completeData) {
        const updatedCandidate = completeData as Candidate;
        setCandidates(prev =>
          prev.map(c => (c.id === editCandidate.id ? updatedCandidate : c))
        );
        
        setEditCandidate(null);
        resetForm();
        alert('✓ Cập nhật thông tin thành công!');
      }
    } catch (err: any) {
      console.error('Error updating candidate:', err);
      alert('Lỗi: ' + (err.message || 'Không thể cập nhật'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewCandidate = (candidate: Candidate) => {
    setViewCandidate(candidate);
  };

  const handleEditCandidate = (candidate: Candidate) => {
    const skills = candidate.cv_candidate_skills?.map(item => item.cv_skills.name) || [];
    setFormData({
      full_name: candidate.full_name || '',
      email: candidate.email || '',
      phone_number: candidate.phone_number || '',
      job_id: '',
      address: candidate.address || '',
      experience: candidate.experience || '',
      education: candidate.education || '',
      university: candidate.university || '',
      status: candidate.status || 'Mới',
      source: candidate.source || '',
      skills,
    });
    setEditCandidate(candidate);
  };

  const handleViewCV = async (candidate: Candidate) => {
    setIsLoadingCV(true);
    try {
      const { data, error } = await supabase
        .from('cv_candidates')
        .select('id, full_name, cv_url, cv_file_name, created_at')
        .eq('id', candidate.id)
        .single();

      if (error) {
        console.error('Error fetching CV info:', error);
        alert('Không thể tải thông tin CV');
        return;
      }

      if (data) {
        if (!data.cv_url) {
          alert('Ứng viên chưa có CV');
          return;
        }
        setViewCVCandidate(data as Candidate);
        
        // ✅ LOG ACTIVITY - Xem CV (optional)
        try {
          await ActivityLogger.logCVViewed(candidate.full_name, candidate.id);
        } catch (logError) {
          console.error('Failed to log activity:', logError);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Có lỗi xảy ra');
    } finally {
      setIsLoadingCV(false);
    }
  };

  const handleAnalyzeCV = async (candidate: Candidate) => {
    setIsLoadingAnalyze(true);
    try {
      const { data, error } = await supabase
        .from('cv_candidates')
        .select('id, full_name, cv_url, cv_parsed_data, status, mandatory_requirements_met, mandatory_requirements_notes, cv_candidate_skills ( cv_skills ( id, name, category ) )')
        .eq('id', candidate.id)
        .single();

      if (error) {
        console.error('Error fetching CV analysis:', error);
        alert('Không thể tải dữ liệu phân tích CV');
        return;
      }

      if (data) {
        if (!data.cv_parsed_data && !data.cv_url) {
          alert('Ứng viên chưa có CV để phân tích');
          return;
        }
        setAnalyzeCVCandidate(data as unknown as Candidate);
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Có lỗi xảy ra');
    } finally {
      setIsLoadingAnalyze(false);
    }
  };

  const handleDeleteCandidate = (candidate: Candidate) => {
    setDeleteCandidate(candidate);
  };

  // ✅ CẬP NHẬT: confirmDelete - Thêm logging
  const confirmDelete = async () => {
    if (!deleteCandidate) return;

    const candidateName = deleteCandidate.full_name; // ✅ Lưu tên trước khi xóa

    try {
      // Delete CV file if exists
      if (deleteCandidate.cv_url) {
        const fileName = deleteCandidate.cv_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('cv-files').remove([fileName]);
        }
      }

      // Delete candidate
      const { error } = await supabase
        .from('cv_candidates')
        .delete()
        .eq('id', deleteCandidate.id);

      if (error) throw error;

      // ✅ LOG ACTIVITY - Xóa ứng viên
      try {
        await ActivityLogger.logCVDeleted(candidateName);
      } catch (logError) {
        console.error('Failed to log activity:', logError);
      }

      // Update UI
      setCandidates(prev => prev.filter(c => c.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      alert('✓ Đã xóa ứng viên thành công!');
    } catch (err: any) {
      console.error('Error deleting candidate:', err);
      alert('Lỗi khi xóa: ' + (err.message || 'Không xác định'));
    }
  };

  const applyFilters = () => {
    setFilterStatus(tempFilterStatus);
    setFilterPosition(tempFilterPosition);
    setFilterLevel(tempFilterLevel);
    setFilterSource(tempFilterSource);
    setIsFilterOpen(false);
  };

  const resetFilters = () => {
    setTempFilterStatus('all');
    setTempFilterPosition('all');
    setTempFilterLevel('all');
    setTempFilterSource('all');
  };

  const exportCSV = () => {
    const headers = ['ID', 'Full Name', 'Email', 'Phone', 'Status', 'Source', 'Position', 'Level', 'Requirements Met'];
    const csvContent = [
      headers.join(','),
      ...filteredCandidates.map(c => {
        return [
          c.id,
          `"${c.full_name.replace(/"/g, '""')}"`,
          c.email,
          c.phone_number || '',
          c.status,
          c.source,
          c.cv_jobs?.title || '',
          c.cv_jobs?.level || '',
          c.mandatory_requirements_met ? 'Yes' : 'No'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'candidates.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const uniquePositions = Array.from(new Set(candidates.map(c => c.cv_jobs?.title).filter((v): v is string => !!v)));
  const uniqueLevels = Array.from(new Set(candidates.map(c => c.cv_jobs?.level).filter((v): v is string => !!v)));
  const uniqueStatuses = ['Mới', 'Sàng lọc', 'Phỏng vấn', 'Chấp nhận', 'Từ chối'];

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = searchQuery === '' || 
      candidate.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (candidate.cv_jobs?.title && candidate.cv_jobs.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || candidate.status === filterStatus;
    const matchesPosition = filterPosition === 'all' || candidate.cv_jobs?.title === filterPosition;
    const matchesLevel = filterLevel === 'all' || candidate.cv_jobs?.level === filterLevel;
    const matchesSource = filterSource === 'all' || candidate.source === filterSource;

    return matchesSearch && matchesStatus && matchesPosition && matchesLevel && matchesSource;
  }).slice(0, 100);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quản lý ứng viên</h1>
          <p className="text-sm text-muted-foreground">Quản lý và theo dõi tất cả ứng viên</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchCandidates}>Làm mới</Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm ứng viên
          </Button>
        </div>
      </div>

      {/* Dialog Thêm ứng viên */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">Thêm ứng viên mới</DialogTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Nhập thông tin ứng viên mới và tải lên CV nếu có. Các trường có dấu (*) là bắt buộc.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex gap-2 mt-4">
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                currentTab === 'basic'
                  ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setCurrentTab('basic')}
            >
              Thông tin cơ bản
            </button>
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                currentTab === 'cv'
                  ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setCurrentTab('cv')}
            >
              CV & Tài liệu
            </button>
            {selectedJob?.mandatory_requirements && (
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg relative ${
                  currentTab === 'requirements'
                    ? 'bg-amber-50 text-amber-700 border-2 border-amber-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setCurrentTab('requirements')}
              >
                Yêu cầu bắt buộc
                {!mandatoryRequirementsMet && (
                  <AlertTriangle className="w-4 h-4 absolute -top-1 -right-1 text-red-500" />
                )}
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {currentTab === 'basic' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="Nhập họ tên đầy đủ"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="example@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label>
                    <Input
                      placeholder="0123456789"
                      value={formData.phone_number}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Vị trí ứng tuyển <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.job_id}
                      onValueChange={(value) => handleInputChange('job_id', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn vị trí" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-60 shadow-lg border border-gray-200 max-h-[300px]">
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.title} - {job.level}
                            {job.mandatory_requirements && <span className="ml-2 text-amber-600">⚠️</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedJob?.mandatory_requirements && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-900">Vị trí này có yêu cầu bắt buộc</p>
                        <p className="text-amber-700 text-xs mt-1">
                          Vui lòng kiểm tra tab "Yêu cầu bắt buộc" để xác nhận ứng viên đáp ứng đủ điều kiện
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Địa chỉ</label>
                  <Input
                    placeholder="Nhập địa chỉ"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Trường học</label>
                  <Input
                    placeholder="VD: Đại học Bách Khoa TP.HCM"
                    value={formData.university}
                    onChange={(e) => handleInputChange('university', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Kinh nghiệm</label>
                    <Textarea
                      placeholder="VD: 3 năm làm Frontend Developer tại ABC Company"
                      className="min-h-[80px] resize-none"
                      value={formData.experience}
                      onChange={(e) => handleInputChange('experience', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Học vấn</label>
                    <Textarea
                      placeholder="VD: Cử nhân CNTT, GPA 3.5/4.0"
                      className="min-h-[80px] resize-none"
                      value={formData.education}
                      onChange={(e) => handleInputChange('education', e.target.value)}
                    />
                  </div>
                </div>

                {/* 🔒 ĐÃ LOẠI BỎ CHỌN TRẠNG THÁI (MẶC ĐỊNH LÀ MỚI) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nguồn ứng tuyển</label>
                  <Select
                    value={formData.source}
                    onValueChange={(value) => handleInputChange('source', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn nguồn" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="TopCV">TopCV</SelectItem>
                      <SelectItem value="Giới thiệu">Giới thiệu</SelectItem>
                      <SelectItem value="Khác">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kỹ năng</label>
                  <SkillsInput
                    value={formData.skills}
                    onChange={(skills) => handleInputChange('skills', skills)}
                    placeholder="Nhập kỹ năng và nhấn Enter (VD: JavaScript, React...)"
                  />
                </div>
              </>
            ) : currentTab === 'cv' ? (
              <div className="space-y-4">
                <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                }`}>
                  <input
                    type="file"
                    id="cv-upload"
                    className="hidden"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                  
                  {isUploading ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <div className="relative">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                          <FileText className="h-6 w-6 text-blue-600 absolute top-3 left-3" />
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-sm font-medium text-blue-700">
                          Đang phân tích CV...
                        </p>
                        <p className="text-xs text-gray-500">
                          AI đang trích xuất thông tin từ CV của bạn
                        </p>
                        <div className="flex items-center justify-center space-x-1">
                          <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                          <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-700 text-center">
                          ⏱️ Quá trình này mất khoảng 10-30 giây
                        </p>
                      </div>
                    </div>
                  ) : selectedFile ? (
                    <div className="space-y-3">
                      <FileText className="h-12 w-12 mx-auto text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">
                          ✓ {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <div className="flex gap-2 justify-center">
                        <label htmlFor="cv-upload">
                          <Button variant="outline" size="sm" type="button" asChild>
                            <span>Chọn file khác</span>
                          </Button>
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={handleRemoveFile}
                          className="text-red-600 hover:text-red-700"
                        >
                          Xóa file
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="cv-upload" className="cursor-pointer block">
                      <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 mb-2">
                        Kéo thả file CV vào đây hoặc click để chọn
                      </p>
                      <Button variant="outline" size="sm" type="button">
                        Chọn file
                      </Button>
                      <p className="text-xs text-gray-500 mt-2">
                        Hỗ trợ: PDF, DOCX, TXT (tối đa 5MB)
                      </p>
                    </label>
                  )}
                </div>
                
                {parsedData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      ✓ Đã phân tích CV thành công
                    </p>
                    <div className="text-xs text-blue-700 space-y-1">
                      {parsedData.email && <p>• Email: {parsedData.email}</p>}
                      {parsedData.phone && <p>• SĐT: {parsedData.phone}</p>}
                      {parsedData.university && <p>• Trường: {parsedData.university}</p>}
                      {parsedData.skills && parsedData.skills.length > 0 && (
                        <p>• Skills: {parsedData.skills.join(', ')}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : currentTab === 'requirements' ? (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-amber-900 mb-1">
                        Yêu cầu bắt buộc cho vị trí: {selectedJob?.title}
                      </h4>
                      <p className="text-sm text-amber-800 mb-3">
                        Ứng viên cần đáp ứng các yêu cầu bắt buộc sau để có thể ứng tuyển vào vị trí này:
                      </p>
                      <div className="bg-white rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border border-amber-200">
                        {selectedJob?.mandatory_requirements}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <div className="flex items-start gap-3 mb-4">
                    <Checkbox 
                      id="requirements-met"
                      checked={mandatoryRequirementsMet}
                      onCheckedChange={(checked: boolean) => {
                        setMandatoryRequirementsMet(checked);
                        setShowRequirementsWarning(false);
                      }}
                      className="mt-1"
                    />
                    <label htmlFor="requirements-met" className="text-sm cursor-pointer flex-1">
                      <span className="font-medium text-gray-900">
                        Xác nhận ứng viên đáp ứng đầy đủ các yêu cầu bắt buộc trên
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Vui lòng đọc kỹ và xác nhận rằng ứng viên có đủ điều kiện theo yêu cầu bắt buộc
                      </p>
                    </label>
                  </div>

                  {showRequirementsWarning && !mandatoryRequirementsMet && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                        <p className="text-sm text-red-700">
                          <strong>Không thể thêm ứng viên!</strong> Vui lòng xác nhận rằng ứng viên đáp ứng đầy đủ các yêu cầu bắt buộc.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Ghi chú về yêu cầu bắt buộc (tùy chọn)
                    </label>
                    <Textarea
                      placeholder="VD: Ứng viên có bằng Cử nhân CNTT từ ĐH Bách Khoa, TOEIC 850 điểm, 3 năm kinh nghiệm React..."
                      className="min-h-[100px] resize-none"
                      value={mandatoryRequirementsNotes}
                      onChange={(e) => setMandatoryRequirementsNotes(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Ghi chú chi tiết về cách ứng viên đáp ứng các yêu cầu bắt buộc
                    </p>
                  </div>
                </div>

                {mandatoryRequirementsMet && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-sm font-medium text-green-800">
                        ✓ Đã xác nhận ứng viên đáp ứng yêu cầu bắt buộc
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" className="px-6" onClick={resetForm}>
              <X className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button variant="outline" className="px-6" onClick={() => { setIsDialogOpen(false); resetForm(); }} disabled={isSaving}>
              Hủy
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? <>Đang lưu...</> : <><Plus className="mr-2 h-4 w-4" />Thêm ứng viên</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Xem thông tin ứng viên */}
      <Dialog open={!!viewCandidate || isLoadingView} onOpenChange={() => setViewCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thông tin ứng viên</DialogTitle>
          </DialogHeader>
          {isLoadingView ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Đang tải thông tin...</p>
            </div>
          ) : viewCandidate ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-16 w-16 border-2 border-blue-200">
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                    {viewCandidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{viewCandidate.full_name}</h3>
                  <p className="text-sm text-gray-500">{viewCandidate.cv_jobs?.title || 'N/A'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(viewCandidate.status)}
                    {viewCandidate.mandatory_requirements_met && (
                      <Badge className="bg-green-100 text-green-700 border-green-300">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Đáp ứng yêu cầu
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-gray-500">Email</label><p className="text-gray-900">{viewCandidate.email}</p></div>
                <div><label className="text-sm font-medium text-gray-500">Số điện thoại</label><p className="text-gray-900">{viewCandidate.phone_number || 'N/A'}</p></div>
                <div><label className="text-sm font-medium text-gray-500">Địa chỉ</label><p className="text-gray-900">{viewCandidate.address || 'N/A'}</p></div>
                <div><label className="text-sm font-medium text-gray-500">Trường học</label><p className="text-gray-900">{viewCandidate.university || 'N/A'}</p></div>
                <div><label className="text-sm font-medium text-gray-500">Cấp độ</label><p className="text-gray-900">{viewCandidate.cv_jobs?.level || 'N/A'}</p></div>
                <div><label className="text-sm font-medium text-gray-500">Nguồn</label><p className="text-gray-900">{viewCandidate.source || 'N/A'}</p></div>
              </div>

              <div><label className="text-sm font-medium text-gray-500">Kinh nghiệm</label><p className="text-gray-900 mt-1">{viewCandidate.experience || 'Chưa có thông tin'}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Học vấn</label><p className="text-gray-900 mt-1">{viewCandidate.education || 'Chưa có thông tin'}</p></div>
              
              {viewCandidate.mandatory_requirements_notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <label className="text-sm font-medium text-amber-900 block mb-1">
                    Ghi chú yêu cầu bắt buộc
                  </label>
                  <p className="text-sm text-amber-800">{viewCandidate.mandatory_requirements_notes}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-gray-500">Kỹ năng</label>
                <div className="mt-1">
                  {viewCandidate?.cv_candidate_skills && viewCandidate.cv_candidate_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewCandidate.cv_candidate_skills.map((item, idx) => (
                        <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {item.cv_skills.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-900">Chưa có thông tin</p>
                  )}
                </div>
              </div>

              <div><label className="text-sm font-medium text-gray-500">Ngày ứng tuyển</label><p className="text-gray-900">{new Date(viewCandidate.created_at).toLocaleDateString('vi-VN')}</p></div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialog Chỉnh sửa ứng viên */}
      <Dialog open={!!editCandidate || isLoadingEdit} onOpenChange={() => { setEditCandidate(null); resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông tin ứng viên</DialogTitle>
          </DialogHeader>
          {isLoadingEdit ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Đang tải thông tin...</p>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên *</label><Input value={formData.full_name} onChange={(e) => handleInputChange('full_name', e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label><Input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label><Input value={formData.phone_number} onChange={(e) => handleInputChange('phone_number', e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Địa chỉ</label><Input value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} /></div>
              </div>

              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Trường học</label><Input value={formData.university} onChange={(e) => handleInputChange('university', e.target.value)} /></div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Kinh nghiệm</label><Textarea className="min-h-[80px] resize-none" value={formData.experience} onChange={(e) => handleInputChange('experience', e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Học vấn</label><Textarea className="min-h-[80px] resize-none" value={formData.education} onChange={(e) => handleInputChange('education', e.target.value)} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* ĐÃ XÓA PHẦN CHỌN TRẠNG THÁI Ở ĐÂY */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nguồn</label>
                  <Select value={formData.source} onValueChange={(value) => handleInputChange('source', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="TopCV">TopCV</SelectItem>
                      <SelectItem value="Giới thiệu">Giới thiệu</SelectItem>
                      <SelectItem value="Khác">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kỹ năng</label>
                <SkillsInput
                  value={formData.skills}
                  onChange={(skills) => handleInputChange('skills', skills)}
                  placeholder="Nhập kỹ năng và nhấn Enter"
                />
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => { setEditCandidate(null); resetForm(); }}>Hủy</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleUpdateCandidate} disabled={isSaving}>
                  {isSaving ? 'Đang lưu...' : 'Cập nhật'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Xem CV */}
      <Dialog open={!!viewCVCandidate || isLoadingCV} onOpenChange={() => setViewCVCandidate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>CV - {viewCVCandidate?.full_name}</DialogTitle>
          </DialogHeader>
          {isLoadingCV ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Đang tải CV...</p>
            </div>
          ) : viewCVCandidate?.cv_url ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{viewCVCandidate.cv_file_name}</p>
                  <p className="text-sm text-gray-500">Ngày upload: {new Date(viewCVCandidate.created_at).toLocaleDateString('vi-VN')}</p>
                </div>
                <a href={viewCVCandidate.cv_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Download className="w-4 h-4" />
                  Tải xuống
                </a>
              </div>
              <iframe src={viewCVCandidate.cv_url} className="w-full h-[600px] border rounded-lg" title="CV Preview" />
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Ứng viên chưa upload CV</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Phân tích CV */}
      <Dialog open={!!analyzeCVCandidate || isLoadingAnalyze} onOpenChange={() => setAnalyzeCVCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Phân tích CV - {analyzeCVCandidate?.full_name}</DialogTitle>
          </DialogHeader>
          {isLoadingAnalyze ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Đang tải dữ liệu phân tích...</p>
            </div>
          ) : analyzeCVCandidate?.cv_parsed_data ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Thông tin trích xuất từ CV</h4>
                <div className="space-y-2 text-sm">
                  {analyzeCVCandidate.cv_parsed_data.email && <div><span className="font-medium">Email:</span> {analyzeCVCandidate.cv_parsed_data.email}</div>}
                  {analyzeCVCandidate.cv_parsed_data.phone && <div><span className="font-medium">Số điện thoại:</span> {analyzeCVCandidate.cv_parsed_data.phone}</div>}
                  {analyzeCVCandidate.cv_parsed_data.university && <div><span className="font-medium">Trường học:</span> {analyzeCVCandidate.cv_parsed_data.university}</div>}
                  
                  {analyzeCVCandidate.cv_parsed_data.skills && analyzeCVCandidate.cv_parsed_data.skills.length > 0 && (
                    <div>
                      <span className="font-medium">Kỹ năng phát hiện từ CV:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {analyzeCVCandidate.cv_parsed_data.skills.map((skill: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="bg-white">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {analyzeCVCandidate.mandatory_requirements_met !== undefined && (
                <div className={`p-4 border-2 rounded-lg ${
                  analyzeCVCandidate.mandatory_requirements_met 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {analyzeCVCandidate.mandatory_requirements_met ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    )}
                    <div>
                      <h4 className={`font-semibold mb-1 ${
                        analyzeCVCandidate.mandatory_requirements_met 
                          ? 'text-green-900' 
                          : 'text-amber-900'
                      }`}>
                        {analyzeCVCandidate.mandatory_requirements_met 
                          ? 'Ứng viên đáp ứng yêu cầu bắt buộc' 
                          : 'Chưa xác nhận yêu cầu bắt buộc'}
                      </h4>
                      {analyzeCVCandidate.mandatory_requirements_notes && (
                        <p className="text-sm text-gray-700 mt-1">
                          {analyzeCVCandidate.mandatory_requirements_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {analyzeCVCandidate.cv_candidate_skills && analyzeCVCandidate.cv_candidate_skills.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Kỹ năng đã lưu trong hệ thống</h4>
                  <div className="flex flex-wrap gap-2">
                    {analyzeCVCandidate.cv_candidate_skills.map((item: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="bg-white text-green-700 border-green-200">
                        {item.cv_skills.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Đánh giá tổng quan</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>• Độ hoàn thiện thông tin: {analyzeCVCandidate.cv_parsed_data.email && analyzeCVCandidate.cv_parsed_data.phone ? 'Tốt' : 'Cần bổ sung'}</p>
                  <p>• Số kỹ năng phát hiện: {analyzeCVCandidate.cv_parsed_data.skills?.length || 0}</p>
                  <p>• Số kỹ năng đã lưu: {analyzeCVCandidate.cv_candidate_skills?.length || 0}</p>
                  <p>• Yêu cầu bắt buộc: {analyzeCVCandidate.mandatory_requirements_met ? '✓ Đã đáp ứng' : '⚠️ Chưa xác nhận'}</p>
                  <p>• Trạng thái hiện tại: {analyzeCVCandidate.status}</p>
                </div>
              </div>

              {analyzeCVCandidate.cv_parsed_data.fullText && (
                <div className="p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                  <h4 className="font-semibold mb-2">Nội dung CV (preview)</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{analyzeCVCandidate.cv_parsed_data.fullText.substring(0, 500)}...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Brain className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Chưa có dữ liệu phân tích CV</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Bộ lọc */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bộ lọc nâng cao</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Trạng thái</label>
              <Select value={tempFilterStatus} onValueChange={setTempFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent className="z-[60] bg-white shadow-lg border border-gray-200">
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vị trí</label>
              <Select value={tempFilterPosition} onValueChange={setTempFilterPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả vị trí" />
                </SelectTrigger>
                <SelectContent className="z-60 bg-white shadow-lg border border-gray-200">
                  <SelectItem value="all">Tất cả vị trí</SelectItem>
                  {uniquePositions.map(pos => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cấp độ</label>
              <Select value={tempFilterLevel} onValueChange={setTempFilterLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả cấp độ" />
                </SelectTrigger>
                <SelectContent className="z-60 bg-white shadow-lg border border-gray-200">
                  <SelectItem value="all">Tất cả cấp độ</SelectItem>
                  {uniqueLevels.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nguồn</label>
              <Select value={tempFilterSource} onValueChange={setTempFilterSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả nguồn" />
                </SelectTrigger>
                <SelectContent className="z-60 bg-white shadow-lg border border-gray-200">
                  <SelectItem value="all">Tất cả nguồn</SelectItem>
                  <SelectItem value="Website">Website</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="TopCV">TopCV</SelectItem>
                  <SelectItem value="Giới thiệu">Giới thiệu</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
            <Button onClick={applyFilters}>Áp dụng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cards thống kê */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-2 border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Tổng ứng viên</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{candidates.length}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-4 w-4 mr-1 text-green-500" />
              +20.1% so với tháng trước
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-2 border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Ứng viên mới</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{candidates.filter(c => c.status === 'Mới').length}</div>
            <p className="text-xs text-muted-foreground">
              <Users className="inline h-4 w-4 mr-1 text-blue-500" />
              Trong tuần này
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-2 border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Đáp ứng yêu cầu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {candidates.filter(c => c.mandatory_requirements_met).length}
            </div>
            <p className="text-xs text-muted-foreground">
              <UserCheck className="inline h-4 w-4 mr-1 text-green-500" />
              Ứng viên phù hợp
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bộ lọc và nút chức năng */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Tìm theo tên, email, vị trí..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setIsFilterOpen(true)}>
            <Filter className="mr-2 h-4 w-4" />
            Bộ lọc nâng cao
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Xuất CSV
          </Button>
        </div>
      </div>

      {/* Bảng ứng viên */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Đang tải dữ liệu ứng viên...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Không tìm thấy ứng viên</h3>
          <p className="text-sm text-gray-500 mt-1">Thử thay đổi bộ lọc hoặc thêm ứng viên mới</p>
        </div>
      ) : (
        <Card className="shadow-sm border-2 border-gray-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[250px]">Ứng viên</TableHead>
                <TableHead>Vị trí</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Kỹ năng</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.map((candidate) => (
                <TableRow key={candidate.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border-2 border-blue-200">
                        <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                          {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {candidate.full_name}
                          {candidate.mandatory_requirements_met && (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{candidate.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {candidate.cv_jobs ? (
                      <div>
                        <div className="font-medium">{candidate.cv_jobs.title}</div>
                        <div className="text-sm text-gray-500">{candidate.cv_jobs.level}</div>
                      </div>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell>{getStatusBadge(candidate.status)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[300px]">
                      {candidate.cv_candidate_skills?.slice(0, 4).map((item, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {item.cv_skills.name}
                        </Badge>
                      ))}
                      {candidate.cv_candidate_skills && candidate.cv_candidate_skills.length > 4 && (
                        <Badge variant="secondary" className="text-xs">+{candidate.cv_candidate_skills.length - 4}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[60] bg-white shadow-lg border border-gray-200">
                        <DropdownMenuItem onClick={() => handleViewCandidate(candidate)} className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-blue-600" />
                          <span>Xem thông tin</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditCandidate(candidate)} className="flex items-center gap-2">
                          <Edit className="h-4 w-4 text-green-600" />
                          <span>Chỉnh sửa</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewCV(candidate)} className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-purple-600" />
                          <span>Xem CV</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAnalyzeCV(candidate)} className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-orange-600" />
                          <span>Phân tích CV</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteCandidate(candidate)} className="flex items-center gap-2 text-red-600">
                          <Trash2 className="h-4 w-4" />
                          <span>Xóa ứng viên</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Alert Dialog Xóa */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa ứng viên</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn chắc chắn muốn xóa ứng viên "{deleteCandidate?.full_name}"? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CandidatesPage;