// src/components/candidates/CandidateFormDialog.tsx
import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem
} from "@/components/ui/select";
import { SkillsInput } from "@/components/ui/skills-input";
import CVUploadZone  from "./CVUploadZone";
import type { ParsedCV } from "@/utils/cvParser";

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

interface Job {
  id: string;
  title: string;
  level: string;
}

interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: CandidateFormData, cvFile?: File, parsedData?: ParsedCV) => Promise<void>;
  jobs: Job[];
  initialData?: Partial<CandidateFormData>;
  mode: 'create' | 'edit';
}

export function CandidateFormDialog({
  open,
  onOpenChange,
  onSubmit,
  jobs,
  initialData,
  mode
}: CandidateFormDialogProps) {
  const [currentTab, setCurrentTab] = useState<'basic' | 'cv'>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCV | null>(null);
  
  const [formData, setFormData] = useState<CandidateFormData>({
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

  useEffect(() => {
    if (initialData) {
      setFormData({
        full_name: initialData.full_name || '',
        email: initialData.email || '',
        phone_number: initialData.phone_number || '',
        job_id: initialData.job_id || '',
        address: initialData.address || '',
        experience: initialData.experience || '',
        education: initialData.education || '',
        university: initialData.university || '',
        status: initialData.status || 'Mới',
        source: initialData.source || '',
        skills: initialData.skills || []
      });
    }
  }, [initialData]);

  const handleInputChange = (field: keyof CandidateFormData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (file: File, parsed: ParsedCV) => {
    setSelectedFile(file);
    setParsedData(parsed);
    
    // Auto-fill form with parsed data
    if (parsed.email && !formData.email) {
      handleInputChange('email', parsed.email);
    }
    if (parsed.phone && !formData.phone_number) {
      handleInputChange('phone_number', parsed.phone);
    }
    if (parsed.fullName && !formData.full_name) {
      handleInputChange('full_name', parsed.fullName);
    }
    if (parsed.address && !formData.address) {
      handleInputChange('address', parsed.address);
    }
    if (parsed.university && !formData.university) {
      handleInputChange('university', parsed.university);
    }
    if (parsed.experience && !formData.experience) {
      handleInputChange('experience', parsed.experience);
    }
    if (parsed.education && !formData.education) {
      handleInputChange('education', parsed.education);
    }
    if (parsed.skills && parsed.skills.length > 0 && formData.skills.length === 0) {
      handleInputChange('skills', parsed.skills);
    }
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setParsedData(null);
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
  };

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email || !formData.job_id) {
      alert('Vui lòng điền đầy đủ các trường bắt buộc (*)');
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(formData, selectedFile || undefined, parsedData || undefined);
      resetForm();
      onOpenChange(false);
      alert(mode === 'create' ? '✓ Thêm ứng viên thành công!' : '✓ Cập nhật thông tin thành công!');
    } catch (error: any) {
      alert('Lỗi: ' + (error.message || 'Không xác định'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">
                {mode === 'create' ? 'Thêm ứng viên mới' : 'Chỉnh sửa ứng viên'}
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                {mode === 'create' 
                  ? 'Nhập thông tin ứng viên mới và tải lên CV nếu có. Các trường có dấu (*) là bắt buộc.'
                  : 'Cập nhật thông tin ứng viên'}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
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
          {mode === 'create' && (
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
          )}
        </div>

        {/* Form Content */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Số điện thoại
                  </label>
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
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title} - {job.level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Địa chỉ
                </label>
                <Input
                  placeholder="Nhập địa chỉ"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Trường học
                </label>
                <Input
                  placeholder="VD: Đại học Bách Khoa TP.HCM"
                  value={formData.university}
                  onChange={(e) => handleInputChange('university', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Kinh nghiệm
                  </label>
                  <Textarea
                    placeholder="VD: 3 năm làm Frontend Developer tại ABC Company"
                    className="min-h-[80px] resize-none"
                    value={formData.experience}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Học vấn
                  </label>
                  <Textarea
                    placeholder="VD: Cử nhân CNTT, GPA 3.5/4.0"
                    className="min-h-[80px] resize-none"
                    value={formData.education}
                    onChange={(e) => handleInputChange('education', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Trạng thái
                  </label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                      <SelectItem value="Mới">Mới</SelectItem>
                      <SelectItem value="Sàng lọc">Sàng lọc</SelectItem>
                      <SelectItem value="Phỏng vấn">Phỏng vấn</SelectItem>
                      <SelectItem value="Chấp nhận">Chấp nhận</SelectItem>
                      <SelectItem value="Từ chối">Từ chối</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nguồn ứng tuyển
                  </label>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kỹ năng
                </label>
                <SkillsInput
                  value={formData.skills}
                  onChange={(skills) => handleInputChange('skills', skills)}
                  placeholder="Nhập kỹ năng và nhấn Enter (VD: JavaScript, React...)"
                />
              </div>
            </>
          ) : (
            <CVUploadZone
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              disabled={isSaving}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t">
          <Button 
            variant="outline" 
            className="px-6" 
            onClick={resetForm}
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button 
            variant="outline" 
            className="px-6" 
            onClick={handleClose}
            disabled={isSaving}
          >
            Hủy
          </Button>
          <Button 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              'Đang lưu...'
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {mode === 'create' ? 'Thêm ứng viên' : 'Cập nhật'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}