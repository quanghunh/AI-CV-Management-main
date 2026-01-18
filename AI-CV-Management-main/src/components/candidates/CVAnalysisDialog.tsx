// src/components/candidates/CVAnalysisDialog.tsx
import { Brain, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// ✅ FIX: Import từ cvParser thay vì advancedCVParser
import type { ParsedCV } from "@/utils/cvParser";

// Simple Progress component
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
    <div 
      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
      style={{ width: `${value}%` }}
    />
  </div>
);

interface Candidate {
  id: string;
  full_name: string;
  status: string;
  cv_url?: string;
  cv_parsed_data?: ParsedCV;
  cv_candidate_skills?: {
    cv_skills: {
      id: string;
      name: string;
    }
  }[];
}

interface CVAnalysisDialogProps {
  candidate: Candidate | null;
  isLoading: boolean;
  onClose: () => void;
}

export function CVAnalysisDialog({ candidate, isLoading, onClose }: CVAnalysisDialogProps) {
  if (!candidate) return null;

  const parsedData = candidate.cv_parsed_data;
  
  const getQualityColor = (quality?: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getQualityScore = (quality?: string) => {
    switch (quality) {
      case 'excellent': return 95;
      case 'good': return 75;
      case 'fair': return 50;
      case 'poor': return 25;
      default: return 0;
    }
  };

  const getQualityLabel = (quality?: string) => {
    switch (quality) {
      case 'excellent': return 'Xuất sắc';
      case 'good': return 'Tốt';
      case 'fair': return 'Khá';
      case 'poor': return 'Yếu';
      default: return 'Chưa xác định';
    }
  };

  return (
    <Dialog open={!!candidate} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Phân tích CV chi tiết - {candidate.full_name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Đang tải dữ liệu phân tích...</p>
          </div>
        ) : !parsedData && !candidate.cv_url ? (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">Chưa có dữ liệu phân tích CV</p>
            <p className="text-sm text-gray-400">
              CV của ứng viên chưa được parse hoặc chưa upload
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quality Score Card */}
            {parsedData && (
              <Card className={`border-2 ${getQualityColor(parsedData.parseQuality)}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>Chất lượng phân tích CV</span>
                    <Badge variant="outline" className={getQualityColor(parsedData.parseQuality)}>
                      {getQualityLabel(parsedData.parseQuality)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Progress 
                      value={getQualityScore(parsedData.parseQuality)} 
                      className="flex-1 h-3"
                    />
                    <span className="text-2xl font-bold">
                      {getQualityScore(parsedData.parseQuality)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="font-semibold text-lg">{parsedData.extractedFields?.length || 0}</div>
                      <div className="text-gray-600">Trường trích xuất</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="font-semibold text-lg">{parsedData.skills?.length || 0}</div>
                      <div className="text-gray-600">Kỹ năng</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="font-semibold text-lg">{parsedData.warnings?.length || 0}</div>
                      <div className="text-gray-600">Cảnh báo</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warnings */}
            {parsedData?.warnings && parsedData.warnings.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    Cảnh báo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm text-yellow-700">
                    {parsedData.warnings.map((warning: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-0.5">⚠️</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Extracted Personal Info */}
            {parsedData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    Thông tin cá nhân
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {/* ✅ FIX: Đổi parsedData.name thành parsedData.fullName */}
                    {parsedData.fullName && (
                      <div>
                        <span className="font-medium text-gray-600">👤 Họ tên:</span>
                        <p className="text-gray-900 mt-1">{parsedData.fullName}</p>
                      </div>
                    )}
                    {parsedData.email && (
                      <div>
                        <span className="font-medium text-gray-600">📧 Email:</span>
                        <p className="text-gray-900 mt-1">{parsedData.email}</p>
                      </div>
                    )}
                    {parsedData.phone && (
                      <div>
                        <span className="font-medium text-gray-600">📱 Số điện thoại:</span>
                        <p className="text-gray-900 mt-1">{parsedData.phone}</p>
                      </div>
                    )}
                    {parsedData.address && (
                      <div>
                        <span className="font-medium text-gray-600">📍 Địa chỉ:</span>
                        <p className="text-gray-900 mt-1">{parsedData.address}</p>
                      </div>
                    )}
                    {parsedData.university && (
                      <div className="col-span-2">
                        <span className="font-medium text-gray-600">🎓 Trường học:</span>
                        <p className="text-gray-900 mt-1">{parsedData.university}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            {parsedData?.summary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">📝 Tóm tắt</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {parsedData.summary}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Skills Comparison */}
            <div className="grid grid-cols-2 gap-4">
              {/* Skills from CV */}
              {parsedData?.skills && parsedData.skills.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>💼 Kỹ năng từ CV</span>
                      <Badge variant="outline">{parsedData.skills.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {parsedData.skills.map((skill: string, idx: number) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Skills in Database */}
              {candidate.cv_candidate_skills && candidate.cv_candidate_skills.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>✅ Kỹ năng đã lưu</span>
                      <Badge variant="outline">{candidate.cv_candidate_skills.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {candidate.cv_candidate_skills.map((item, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          {item.cv_skills.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Languages */}
            {parsedData?.languages && parsedData.languages.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">🌐 Ngôn ngữ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.languages.map((lang: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{lang}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Certifications */}
            {parsedData?.certifications && parsedData.certifications.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">🏆 Chứng chỉ</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {parsedData.certifications.map((cert: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>{cert}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Experience Preview */}
            {parsedData?.experience && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">💼 Kinh nghiệm làm việc</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto bg-gray-50 p-3 rounded border">
                    {parsedData.experience.substring(0, 500)}
                    {parsedData.experience.length > 500 && '...'}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Education Preview */}
            {parsedData?.education && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">🎓 Học vấn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto bg-gray-50 p-3 rounded border">
                    {parsedData.education.substring(0, 500)}
                    {parsedData.education.length > 500 && '...'}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Overall Assessment */}
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  Đánh giá tổng quan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Độ hoàn thiện thông tin:</span>
                    <Badge variant="outline" className={getQualityColor(parsedData?.parseQuality)}>
                      {getQualityLabel(parsedData?.parseQuality)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Số trường đã trích xuất:</span>
                    <Badge variant="secondary">{parsedData?.extractedFields?.length || 0} / 11</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Số kỹ năng phát hiện:</span>
                    <Badge variant="secondary">{parsedData?.skills?.length || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Trạng thái hiện tại:</span>
                    <Badge variant="outline">{candidate.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Full Text Preview */}
            {parsedData?.fullText && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">📄 Nội dung CV đầy đủ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto bg-gray-50 p-3 rounded border font-mono">
                    {parsedData.fullText.substring(0, 2000)}
                    {parsedData.fullText.length > 2000 && '\n\n... (còn tiếp)'}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}