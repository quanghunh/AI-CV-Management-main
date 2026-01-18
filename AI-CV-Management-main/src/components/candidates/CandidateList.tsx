// src/components/candidates/CandidateList.tsx
import { Eye, Edit, FileText, Brain, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Candidate {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone_number?: string;
  status: string;
  source: string;
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

interface CandidateListProps {
  candidates: Candidate[];
  loading: boolean;
  onView: (candidate: Candidate) => void;
  onEdit: (candidate: Candidate) => void;
  onViewCV: (candidate: Candidate) => void;
  onAnalyzeCV: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
}

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { variant: string; className: string; label: string }> = {
    "Mới": { variant: "outline", className: "text-blue-600 border-blue-600 bg-blue-50", label: "new" },
    "Sàng lọc": { variant: "outline", className: "text-yellow-600 border-yellow-600 bg-yellow-50", label: "screening" },
    "Phỏng vấn": { variant: "outline", className: "text-purple-600 border-purple-600 bg-purple-50", label: "interview" },
    "Chấp nhận": { variant: "outline", className: "text-green-600 border-green-600 bg-green-50", label: "accepted" },
    "Từ chối": { variant: "outline", className: "text-red-600 border-red-600 bg-red-50", label: "rejected" },
  };

  const config = statusMap[status];
  if (!config) return <Badge variant="secondary">{status}</Badge>;

  return (
    <Badge variant={config.variant as any} className={config.className}>
      {config.label}
    </Badge>
  );
};

export function CandidateList({
  candidates,
  loading,
  onView,
  onEdit,
  onViewCV,
  onAnalyzeCV,
  onDelete
}: CandidateListProps) {
  if (loading) {
    return (
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ứng viên</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Cấp độ</TableHead>
              <TableHead>Ngày ứng tuyển</TableHead>
              <TableHead>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                Đang tải dữ liệu...
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ứng viên</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Cấp độ</TableHead>
              <TableHead>Ngày ứng tuyển</TableHead>
              <TableHead>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                <p className="font-medium">Chưa có ứng viên nào</p>
                <p className="text-sm text-muted-foreground">
                  Hãy bắt đầu bằng cách thêm ứng viên đầu tiên!
                </p>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ứng viên</TableHead>
            <TableHead>Vị trí</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Cấp độ</TableHead>
            <TableHead>Ngày ứng tuyển</TableHead>
            <TableHead>Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {candidate.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{candidate.full_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {candidate.email || candidate.phone_number}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div>{candidate.cv_jobs?.title || 'N/A'}</div>
                <div className="text-sm text-muted-foreground">
                  {candidate.cv_candidate_skills && candidate.cv_candidate_skills.length > 0 
                    ? `${candidate.cv_candidate_skills.length} kỹ năng` 
                    : 'Chưa có kỹ năng'}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(candidate.status)}</TableCell>
              <TableCell>{candidate.cv_jobs?.level || 'N/A'}</TableCell>
              <TableCell>
                <div>{new Date(candidate.created_at).toLocaleDateString('vi-VN')}</div>
                <div className="text-sm text-muted-foreground">
                  Nguồn: {candidate.source}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                    title="Xem thông tin ứng viên"
                    onClick={() => onView(candidate)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-gray-600 hover:text-gray-700 hover:bg-gray-50" 
                    title="Chỉnh sửa"
                    onClick={() => onEdit(candidate)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" 
                    title="Xem CV"
                    onClick={() => onViewCV(candidate)}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50" 
                    title="Phân tích CV"
                    onClick={() => onAnalyzeCV(candidate)}
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" 
                    title="Xóa"
                    onClick={() => onDelete(candidate)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}