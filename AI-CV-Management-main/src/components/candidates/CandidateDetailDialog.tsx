// src/components/candidates/CandidateDetailDialog.tsx
import { X } from 'lucide-react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  address?: string;
  status: string;
  source: string;
  experience?: string;
  education?: string;
  university?: string;
  cv_jobs: {
    title: string;
    level: string;
  } | null;
  cv_candidate_skills?: {
    cv_skills: {
      id: string;
      name: string;
    }
  }[];
}

interface CandidateDetailDialogProps {
  candidate: Candidate | null;
  open: boolean;
  onClose: () => void;
}

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { className: string; label: string }> = {
    "Mới": { className: "bg-blue-100 text-blue-700 border-blue-300", label: "new" },
    "Sàng lọc": { className: "bg-yellow-100 text-yellow-700 border-yellow-300", label: "screening" },
    "Phỏng vấn": { className: "bg-purple-100 text-purple-700 border-purple-300", label: "interview" },
    "Chấp nhận": { className: "bg-green-100 text-green-700 border-green-300", label: "accepted" },
    "Từ chối": { className: "bg-red-100 text-red-700 border-red-300", label: "rejected" },
  };

  const config = statusMap[status] || { className: "bg-gray-100 text-gray-700", label: status };

  return (
    <Badge variant="outline" className={`${config.className} font-medium`}>
      {config.label}
    </Badge>
  );
};
const getCandidateStatusBadge = (status: string) => {
  switch (status) {
    case "Chấp nhận":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{status}</Badge>
    case "Từ chối":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{status}</Badge>
    case "Phỏng vấn":
      return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{status}</Badge>
    case "Sàng lọc":
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{status}</Badge>
    case "Mới":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}
export function CandidateDetailDialog({ candidate, open, onClose }: CandidateDetailDialogProps) {
  if (!candidate) return null;

  const initials = candidate.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const skills = candidate.cv_candidate_skills?.map(cs => cs.cv_skills.name) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold">Thông tin ứng viên</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Profile Section */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 text-xl">
              <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">{candidate.full_name}</h3>
              <p className="text-gray-600 mb-2">{candidate.cv_jobs?.title || 'N/A'}</p>
              {getStatusBadge(candidate.status)}
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-1">Email</h4>
              <p className="text-gray-900">{candidate.email}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-1">Số điện thoại</h4>
              <p className="text-gray-900">{candidate.phone_number || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-1">Địa chỉ</h4>
              <p className="text-gray-900">{candidate.address || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-1">Trường học</h4>
              <p className="text-gray-900">{candidate.university || 'N/A'}</p>
            </div>
          </div>

          <Separator />

          {/* Job Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-1">Cấp độ</h4>
              <p className="text-gray-900">{candidate.cv_jobs?.level || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-1">Nguồn</h4>
              <p className="text-gray-900">{candidate.source}</p>
            </div>
          </div>

          <Separator />

          {/* Experience */}
          {candidate.experience && (
            <>
              <div>
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Kinh nghiệm</h4>
                <p className="text-gray-900 whitespace-pre-wrap">{candidate.experience}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Education */}
          {candidate.education && (
            <>
              <div>
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Học vấn</h4>
                <p className="text-gray-900 whitespace-pre-wrap">{candidate.education}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-3">Kỹ năng</h4>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary"
                    className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}