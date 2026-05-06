
"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RefreshCw, FileText, Star, TrendingUp, MoreHorizontal, X, AlertTriangle } from "lucide-react"
import { fireCampaign } from '@/utils/campaignTriggerEngine'
import { supabase } from "@/lib/supabaseClient"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  )
}

interface Review {
  id: string;
  rating: number;
  outcome: string;
  notes: string;
  created_at: string;
  updated_at?: string;
  cv_interviews: {
    id: string;
    interviewer: string;
    interview_date: string;
    duration: string;
    location: string;
    format: string;
    cv_candidates: {
      full_name: string;
      cv_jobs: {
        title: string;
      } | null;
    } | null;
  } | null;
}

interface PendingInterview {
  id: string;
  interview_date: string;
  interviewer: string;
  duration: string;
  location: string;
  format: string;
  cv_candidates: {
    full_name: string;
    cv_jobs: {
      title: string;
    } | null;
  } | null;
}

export function ReviewsPage() {

  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingInterviews, setPendingInterviews] = useState<PendingInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalReviews: 0, averageRating: 0, recommendationRate: 0 });
  

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isReratingDialogOpen, setIsReratingDialogOpen] = useState(false);
  const [isNewReviewDialogOpen, setIsNewReviewDialogOpen] = useState(false);
  

  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [selectedPendingInterview, setSelectedPendingInterview] = useState<PendingInterview | null>(null);
  

  const [newRating, setNewRating] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [reviewOutcome, setReviewOutcome] = useState('Đạt');
  const [submitting, setSubmitting] = useState(false);
useEffect(() => {
    getReviews();
  }, []);

  async function getReviews() {
    setLoading(true);

    const { data: reviewData, error: reviewError } = await supabase
      .from('cv_interview_reviews')
      .select(`
        *,
        cv_interviews (
          *,
          cv_candidates (
            full_name,
            cv_jobs ( title )
          )
        )
      `)
      .order('created_at', { ascending: false });

    const { data: pendingData, error: pendingError } = await supabase
      .from('cv_interviews')
      .select(`
        id,
        interview_date,
        interviewer,
        duration,
        location,
        format,
        cv_candidates (
          full_name,
          cv_jobs ( title )
        )
      `)
      .in('status', ['Đang chờ đánh giá', 'Đang đánh giá'])
      .order('interview_date', { ascending: false });

    if (reviewData) {
      const uniqueReviews = (reviewData as Review[]).reduce((acc: Review[], review: Review) => {
        const existingIndex = acc.findIndex((r: Review) => r.cv_interviews?.id === review.cv_interviews?.id);
        
        if (existingIndex === -1) {
          acc.push(review);
        } else {
          const existingDate = new Date(acc[existingIndex].created_at);
          const currentDate = new Date(review.created_at);
          if (currentDate > existingDate) {
            acc[existingIndex] = review;
          }
        }
        return acc;
      }, [] as Review[]);

      setReviews(uniqueReviews);

      const total = uniqueReviews.length;
      const sumOfRatings = uniqueReviews.reduce((sum, review) => sum + review.rating, 0);
      const recommendedCount = uniqueReviews.filter(review => review.outcome === 'Đạt').length;

      setStats({
        totalReviews: total,
        averageRating: total > 0 ? sumOfRatings / total : 0,
        recommendationRate: total > 0 ? (recommendedCount / total) * 100 : 0,
      });
    }

    if (pendingData) {
      setPendingInterviews(pendingData as unknown as PendingInterview[]);
    }

    if (reviewError) console.error('Error fetching reviews:', reviewError);
    if (pendingError) console.error('Error fetching pending interviews:', pendingError);
    setLoading(false);
  }

  const handleViewDetail = (review: Review) => {
    setSelectedReview(review);
    setIsDetailDialogOpen(true);
  };

  const handleCreateReview = (interview: PendingInterview) => {
    setSelectedPendingInterview(interview);
    setIsNewReviewDialogOpen(true);
    setNewRating(0);
    setNewNote('');
    setReviewOutcome('Đạt');
  };

  const handleSubmitNewReview = async () => {
    if (!selectedPendingInterview || newRating === 0) {
      toast.warning('Vui lòng chọn số sao đánh giá!');
      return;
    }

    setSubmitting(true);
    try {
      
      const { error: reviewError } = await supabase
        .from('cv_interview_reviews')
        .insert([{
          interview_id: selectedPendingInterview.id,
          rating: newRating,
          notes: newNote,
          outcome: reviewOutcome
        }]);

      if (reviewError) throw reviewError;

      
      const { error: updateError } = await supabase
        .from('cv_interviews')
        .update({ status: 'Hoàn thành' })
        .eq('id', selectedPendingInterview.id);

      if (updateError) throw updateError;

    
      let resolvedCandidateId: string | undefined
      if (reviewOutcome === 'Đạt' || reviewOutcome === 'Không đạt') {
        const { data: interviewData } = await supabase
          .from('cv_interviews')
          .select('candidate_id')
          .eq('id', selectedPendingInterview.id)
          .single();

        if (interviewData?.candidate_id) {
          resolvedCandidateId = interviewData.candidate_id
          const newCandidateStatus = reviewOutcome === 'Đạt' ? 'Chấp nhận' : 'Từ chối';
          
          const { error: candidateUpdateError } = await supabase
            .from('cv_candidates')
            .update({ status: newCandidateStatus })
            .eq('id', interviewData.candidate_id);

          if (candidateUpdateError) {
            console.error('Error updating candidate status:', candidateUpdateError);
          }
        }
      }

      
      await getReviews();

      const capturedRating = newRating;
      const capturedNote = newNote;
      const capturedOutcome = reviewOutcome;

      setIsNewReviewDialogOpen(false);
      setSelectedPendingInterview(null);
      setNewRating(0);
      setNewNote('');
      setReviewOutcome('Đạt');

      toast.success('Đánh giá đã được lưu thành công!');

      fireCampaign('interview_result_published', {
        candidateId: resolvedCandidateId,
        interviewId: selectedPendingInterview.id,
        interviewDate: selectedPendingInterview.interview_date,
        jobTitle: selectedPendingInterview.cv_candidates?.cv_jobs?.title,
        interviewerName: selectedPendingInterview.interviewer,
        result: capturedOutcome,
        rating: capturedRating,
        feedback: capturedNote,
      }).catch(console.error);
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Có lỗi xảy ra khi lưu đánh giá!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRerating = (review: Review) => {
    setSelectedReview(review);
    setNewRating(review.rating);
    setNewNote(review.notes || '');
    setReviewOutcome(review.outcome);
    setIsReratingDialogOpen(true);
  };

  const handleSubmitRerating = async () => {
    if (!selectedReview || newRating === 0) {
      toast.warning('Vui lòng chọn số sao đánh giá!');
      return;
    }

    setSubmitting(true);
    try {

      const { error } = await supabase
        .from('cv_interview_reviews')
        .update({ 
          rating: newRating,
          notes: newNote,
          outcome: reviewOutcome,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReview.id);

      if (error) throw error;

      if (reviewOutcome === 'Đạt' || reviewOutcome === 'Không đạt') {
        const { data: interviewData } = await supabase
          .from('cv_interviews')
          .select('candidate_id')
          .eq('id', selectedReview.cv_interviews?.id)
          .single();

        if (interviewData?.candidate_id) {
          const newCandidateStatus = reviewOutcome === 'Đạt' ? 'Chấp nhận' : 'Từ chối';
          
          await supabase
            .from('cv_candidates')
            .update({ status: newCandidateStatus })
            .eq('id', interviewData.candidate_id);
        }
      }

      await getReviews();

      setIsReratingDialogOpen(false);
      setSelectedReview(null);
      setNewRating(0);
      setNewNote('');
      
      toast.success('Cập nhật đánh giá thành công!');
    } catch (error: any) {
      console.error('Error updating rating:', error);
      toast.error(`Có lỗi xảy ra: ${error.message || 'Không thể cập nhật đánh giá'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Đánh giá phỏng vấn</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">Quản lý và theo dõi đánh giá phỏng vấn</p>
        </div>
        <Button variant="outline" size="sm" onClick={getReviews} className="shrink-0">
          <RefreshCw className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Làm mới</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <Card className="shadow-sm border-2 border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Tổng số đánh giá</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground shrink-0"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{stats.totalReviews}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-2 border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Đánh giá trung bình</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground shrink-0"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              {stats.averageRating.toFixed(1)}
              <StarRating rating={stats.averageRating} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-2 border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Tỷ lệ khuyên nghị</CardTitle>
<TrendingUp className="h-4 w-4 text-muted-foreground shrink-0"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{stats.recommendationRate.toFixed(0)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Reviews Section */}
      {pendingInterviews.length > 0 && (
        <Card className="shadow-sm border-2 border-gray-100 overflow-hidden">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              Chờ đánh giá ({pendingInterviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table - shows on sm and up */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Ứng viên</TableHead>
                    <TableHead>Vị trí</TableHead>
                    <TableHead>Người PV</TableHead>
                    <TableHead>Ngày PV</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInterviews.map((interview) => (
                    <TableRow key={interview.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{interview.cv_candidates?.full_name || 'N/A'}</TableCell>
                      <TableCell>{interview.cv_candidates?.cv_jobs?.title || 'N/A'}</TableCell>
                      <TableCell>{interview.interviewer}</TableCell>
                      <TableCell>
                        {new Date(interview.interview_date).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleCreateReview(interview)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Đánh giá
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile Card Layout - shows only on mobile */}
            <div className="sm:hidden space-y-3 p-3">
              {pendingInterviews.map((interview) => (
                <div key={interview.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base truncate">
                        {interview.cv_candidates?.full_name || 'N/A'}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {interview.cv_candidates?.cv_jobs?.title || 'N/A'}
                      </p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700">Chờ đánh giá</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Người PV:</span>
                      <span className="text-gray-900">{interview.interviewer}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Ngày PV:</span>
                      <span className="text-gray-900">
                        {new Date(interview.interview_date).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleCreateReview(interview)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Đánh giá
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List Table */}
      <Card className="shadow-sm border-2 border-gray-100 overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Danh sách đánh giá</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table - shows on sm and up */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Ứng viên</TableHead>
                  <TableHead>Vị trí</TableHead>
                  <TableHead>Người PV</TableHead>
                  <TableHead>Ngày PV</TableHead>
                  <TableHead>Đánh giá</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">Đang tải dữ liệu...</TableCell>
                  </TableRow>
                ) : reviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">Chưa có đánh giá nào</TableCell>
                  </TableRow>
                ) : (
                  reviews.map((review) => (
                    <TableRow key={review.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{review.cv_interviews?.cv_candidates?.full_name || 'N/A'}</TableCell>
                      <TableCell>{review.cv_interviews?.cv_candidates?.cv_jobs?.title || 'N/A'}</TableCell>
                      <TableCell>{review.cv_interviews?.interviewer || 'N/A'}</TableCell>
                      <TableCell>
                        {review.cv_interviews ? new Date(review.cv_interviews.interview_date).toLocaleDateString('vi-VN') : 'N/A'}
                      </TableCell>
                      <TableCell><StarRating rating={review.rating} /></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                              <MoreHorizontal className="h-4 w-4 text-gray-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white z-60 shadow-lg border border-gray-200" style={{ zIndex: 50 }}>
                            <DropdownMenuItem onClick={() => handleViewDetail(review)}>
                              Hiển thị
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRerating(review)}>
                              Đánh giá lại
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-blue-600"

                              onClick={() => window.location.href = `/quan-ly-email?compose=true&candidate_id=${(review.cv_interviews as any)?.candidate_id || ''}`}
                            >
                              Gửi mail thông báo
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
          <div className="sm:hidden space-y-3 p-3">
            {loading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-3 sm:mt-4 text-sm">Đang tải dữ liệu...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <FileText className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
                <p className="text-sm text-gray-500">Chưa có đánh giá nào</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base truncate">
                        {review.cv_interviews?.cv_candidates?.full_name || 'N/A'}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {review.cv_interviews?.cv_candidates?.cv_jobs?.title || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} />
                      <Badge className={
                        review.outcome === 'Đạt'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }>
                        {review.outcome}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Người PV:</span>
                      <span className="text-gray-900">{review.cv_interviews?.interviewer || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Ngày PV:</span>
                      <span className="text-gray-900">
                        {review.cv_interviews ? new Date(review.cv_interviews.interview_date).toLocaleDateString('vi-VN') : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetail(review)}
                      className="text-gray-700 hover:text-blue-600"
                    >
                      Xem
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRerating(review)}
                      className="text-gray-700 hover:text-orange-600"
                    >
                      Đánh giá lại
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog Hiển thị Chi tiết */}
      {isDetailDialogOpen && selectedReview && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => setIsDetailDialogOpen(false)}
          />

          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
Chi tiết đánh giá phỏng vấn
                </h2>
                <button
                  onClick={() => setIsDetailDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-3 sm:space-y-6">
                {/* Thông tin ứng viên */}
                <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-100">
                  <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">Thông tin ứng viên</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs sm:text-sm text-blue-700">Họ tên</p>
                      <p className="font-semibold text-blue-900 text-sm sm:text-base">{selectedReview.cv_interviews?.cv_candidates?.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-blue-700">Vị trí ứng tuyển</p>
                      <p className="font-semibold text-blue-900 text-sm sm:text-base">{selectedReview.cv_interviews?.cv_candidates?.cv_jobs?.title || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Thông tin buổi phỏng vấn */}
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">Thông tin buổi phỏng vấn</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                      <p className="text-xs sm:text-sm text-gray-600">Người phỏng vấn</p>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{selectedReview.cv_interviews?.interviewer || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Ngày phỏng vấn</p>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">
                        {selectedReview.cv_interviews ? new Date(selectedReview.cv_interviews.interview_date).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Thời lượng</p>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{selectedReview.cv_interviews?.duration || 'N/A'} phút</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Hình thức</p>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{selectedReview.cv_interviews?.format || 'N/A'}</p>
                    </div>
                    <div>
<p className="text-xs sm:text-sm text-gray-600">Địa điểm</p>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{selectedReview.cv_interviews?.location || 'Chưa có thông tin'}</p>
                    </div>
                  </div>
                </div>

                {/* Đánh giá */}
                <div className="bg-yellow-50 rounded-lg p-3 sm:p-4 border border-yellow-200">
                  <h3 className="font-semibold text-yellow-900 mb-3 text-sm sm:text-base">Đánh giá</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs sm:text-sm text-yellow-700 mb-1">Rating</p>
                      <div className="flex items-center gap-2">
                        <StarRating rating={selectedReview.rating} />
                        <span className="font-bold text-yellow-900 text-base sm:text-lg">{selectedReview.rating}/5</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-yellow-700 mb-1">Kết quả</p>
                      <Badge className={
                        selectedReview.outcome === 'Đạt' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }>
                        {selectedReview.outcome}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-yellow-700 mb-1">Thời gian đánh giá</p>
                      <p className="font-medium text-yellow-900 text-sm sm:text-base">
                        {new Date(selectedReview.created_at).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {selectedReview.notes && (
                      <div>
                        <p className="text-xs sm:text-sm text-yellow-700 mb-1">Ghi chú</p>
                        <p className="text-yellow-900 bg-white rounded p-3 border border-yellow-200 text-sm sm:text-base">{selectedReview.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t px-4 sm:px-6 py-4 flex justify-end">
                <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dialog Đánh giá lại (Rerating) */}
      {isReratingDialogOpen && selectedReview && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => {
              setIsReratingDialogOpen(false);
              setNewRating(0);
setNewNote('');
            }}
          />

          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="truncate">Đánh giá lại buổi phỏng vấn</span>
                </h2>
                <button
                  onClick={() => {
                    setIsReratingDialogOpen(false);
                    setNewRating(0);
                    setNewNote('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Thông tin ứng viên */}
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-gray-600">Ứng viên</p>
                  <p className="font-semibold text-base sm:text-lg">{selectedReview.cv_interviews?.cv_candidates?.full_name}</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">{selectedReview.cv_interviews?.cv_candidates?.cv_jobs?.title}</p>
                </div>

                {/* Đánh giá hiện tại */}
                <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
                  <p className="text-xs sm:text-sm text-blue-700 mb-2">Đánh giá hiện tại</p>
                  <div className="flex items-center gap-2 mb-3">
                    <StarRating rating={selectedReview.rating} />
                    <span className="font-bold text-blue-900 text-sm sm:text-base">{selectedReview.rating}/5</span>
                  </div>
                  {selectedReview.notes && (
                    <div>
                      <p className="text-xs sm:text-sm text-blue-700 mb-1">Ghi chú cũ</p>
                      <p className="text-xs sm:text-sm text-blue-900 bg-white rounded p-2 border border-blue-200">{selectedReview.notes}</p>
                    </div>
                  )}
                </div>

                {/* Rating mới */}
                <div className="space-y-3">
                  <label className="text-xs sm:text-sm font-medium">
                    Đánh giá mới <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="transition-transform hover:scale-110"
>
                        <Star 
                          className={`w-10 h-10 ${
                            star <= newRating 
                              ? 'fill-yellow-400 text-yellow-400' 
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-lg font-semibold text-gray-700">
                      {newRating > 0 ? `${newRating}/5` : 'Chưa chọn'}
                    </span>
                  </div>
                </div>

                {/* Kết quả mới (Updated UI from V1) */}
                <div className="space-y-3">
                  <label className="text-xs sm:text-sm font-medium">
                    Kết quả <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={reviewOutcome}
                    onValueChange={(value) => setReviewOutcome(value)}
                  >
                    <SelectTrigger className="bg-white px-2.5 sm:px-3 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-60 shadow-lg border border-gray-200" style={{ zIndex: 1000001 }}>
                      <SelectItem value="Đạt">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">✓</span>
                          <span>Đạt</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Không đạt">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600">✕</span>
                          <span>Không đạt</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Thông báo cảnh báo (Feature V1) */}
                  {(reviewOutcome === 'Đạt' || reviewOutcome === 'Không đạt') && (
                    <div className={`p-3 rounded-lg border-2 flex items-start gap-2 ${
                      reviewOutcome === 'Đạt'
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 ${
                        reviewOutcome === 'Đạt' ? 'text-green-600' : 'text-red-600'
                      }`} />
                      <div className={`text-xs sm:text-sm ${
                        reviewOutcome === 'Đạt' ? 'text-green-900' : 'text-red-900'
                      }`}>
                        <p className="font-semibold mb-1">
                          {reviewOutcome === 'Đạt'
                            ? '✓ Trạng thái ứng viên sẽ chuyển sang "Chấp nhận"'
                            : '⚠️ Trạng thái ứng viên sẽ chuyển sang "Từ chối"'
                          }
                        </p>
                        <p className="text-xs opacity-90">
                           Hệ thống sẽ tự động cập nhật trạng thái ứng viên khi bạn lưu đánh giá.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ghi chú mới */}
                <div className="space-y-3">
                  <label className="text-xs sm:text-sm font-medium">
                    Ghi chú đánh giá
                  </label>
                  <Textarea
                    placeholder="Nhập ghi chú về đánh giá của bạn..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={4}
                    className="min-h-20 resize-none px-2.5 sm:px-3 w-full text-sm sm:text-base"
                  />
                  <p className="text-xs text-gray-500">
                    {newNote.length}/500 ký tự
                  </p>
                </div>
              </div>

              <div className="border-t px-4 sm:px-6 py-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReratingDialogOpen(false);
                    setNewRating(0);
                    setNewNote('');
                  }}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSubmitRerating}
                  disabled={submitting || newRating === 0}
                >
                  <Star className="w-4 h-4 mr-2" />
                  {submitting ? 'Đang lưu...' : 'Cập nhật đánh giá'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ✅ New Review Dialog (Feature V1) */}
      {isNewReviewDialogOpen && selectedPendingInterview && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => {
              setIsNewReviewDialogOpen(false);
              setSelectedPendingInterview(null);
              setNewRating(0);
              setNewNote('');
              setReviewOutcome('Đạt');
            }}
          />

          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-[95vw] max-w-lg m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="truncate">Đánh giá buổi phỏng vấn</span>
                </h2>
                <button
onClick={() => {
                    setIsNewReviewDialogOpen(false);
                    setSelectedPendingInterview(null);
                    setNewRating(0);
                    setNewNote('');
                    setReviewOutcome('Đạt');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Thông tin ứng viên */}
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-gray-600">Ứng viên</p>
                  <p className="font-semibold text-base sm:text-lg">{selectedPendingInterview.cv_candidates?.full_name}</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">{selectedPendingInterview.cv_candidates?.cv_jobs?.title}</p>
                </div>

                {/* Rating */}
                <div className="space-y-3">
                  <label className="text-xs sm:text-sm font-medium">
                    Đánh giá <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-8 h-8 sm:w-10 sm:h-10 ${
                            star <= newRating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-base sm:text-lg font-semibold text-gray-700">
                      {newRating > 0 ? `${newRating}/5` : 'Chưa chọn'}
                    </span>
                  </div>
                </div>

                {/* Outcome (Updated UI from V1 with Warning) */}
                <div className="space-y-3">
                  <label className="text-xs sm:text-sm font-medium">
                    Kết quả <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={reviewOutcome}
                    onValueChange={(value) => setReviewOutcome(value)}
                  >
                    <SelectTrigger className="bg-white px-2.5 sm:px-3 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-60 shadow-lg border border-gray-200" style={{ zIndex: 1000001 }}>
                      <SelectItem value="Đạt">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">✓</span>
                          <span>Đạt</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Không đạt">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600">✕</span>
                          <span>Không đạt</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Thông báo cảnh báo (Feature V1) */}
                  {(reviewOutcome === 'Đạt' || reviewOutcome === 'Không đạt') && (
                    <div className={`p-3 rounded-lg border-2 flex items-start gap-2 ${
                      reviewOutcome === 'Đạt'
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 ${
                        reviewOutcome === 'Đạt' ? 'text-green-600' : 'text-red-600'
                      }`} />
                      <div className={`text-xs sm:text-sm ${
                        reviewOutcome === 'Đạt' ? 'text-green-900' : 'text-red-900'
                      }`}>
                        <p className="font-semibold mb-1">
                          {reviewOutcome === 'Đạt'
                            ? '✓ Trạng thái ứng viên sẽ chuyển sang "Chấp nhận"'
                            : '⚠️ Trạng thái ứng viên sẽ chuyển sang "Từ chối"'
                          }
                        </p>
                        <p className="text-xs opacity-90">
                           Khi bạn lưu đánh giá này, hệ thống sẽ tự động cập nhật trạng thái ứng viên.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium">Ghi chú đánh giá</label>
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Nhập ghi chú về buổi phỏng vấn..."
                    rows={3}
                    className="min-h-20 resize-none px-2.5 sm:px-3 w-full bg-white text-sm sm:text-base"
                  />
                </div>
              </div>

              <div className="border-t px-4 sm:px-6 py-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsNewReviewDialogOpen(false);
                    setSelectedPendingInterview(null);
                    setNewRating(0);
                    setNewNote('');
                    setReviewOutcome('Đạt');
                  }}
                  disabled={submitting}
                >
Hủy
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSubmitNewReview}
                  disabled={submitting || newRating === 0}
                >
                  <Star className="w-4 h-4 mr-2" />
                  {submitting ? 'Đang lưu...' : 'Lưu đánh giá'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}