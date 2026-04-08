"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  RefreshCw, Brain, Users, Download, Eye, CheckCircle, AlertCircle,
  Target, Sparkles, Briefcase, RotateCcw, TrendingUp, Filter, Calendar,
  Trophy, Medal, Award, ChevronDown, ChevronUp, ArrowUpDown,
  LayoutGrid, List, BarChart3, Layers, Star, Crown, BarChart2,
  CheckCircle2, AlertTriangle,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ==================== TOAST ====================
const useToast = () => {
  const toast = React.useCallback((options: { title: string; description: string; duration: number }) => {
    alert(`${options.title}\n${options.description}`)
  }, [])
  return { toast }
}

// ==================== PROGRESS BAR ====================
const Progress = ({ value, className = "" }: { value: number; className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${className}`}>
    <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
)

// ==================== OPENROUTER SERVICE ====================
interface JobMatchResult {
  job_id: string; job_title: string; match_score: number
  strengths: string[]; weaknesses: string[]; recommendation: string
}
interface CVAnalysisResult {
  overall_score: number; best_match: JobMatchResult | null; all_matches: JobMatchResult[]
}

async function analyzeWithGPT4o(cvText: string, cvData: any, jobs: any[], primaryJobId?: string): Promise<CVAnalysisResult> {
  const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
  const response = await fetch(`${API_URL}/api/match-cv-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cv_text: cvText,
      cv_data: {
        full_name: cvData.full_name,
        email: cvData.email,
        phone_number: cvData.phone_number,
        address: cvData.address,
        university: cvData.university,
        education: cvData.education,
        experience: cvData.experience,
      },
      jobs: jobs.map((j: any) => ({
        id: j.id, title: j.title, department: j.department, level: j.level,
        job_type: j.job_type, work_location: j.work_location, location: j.location,
        description: j.description, requirements: j.requirements, benefits: j.benefits,
        mandatory_requirements: j.mandatory_requirements || null,
      })),
      primary_job_id: primaryJobId,
    }),
  })
  if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error((e as any).detail || `Backend error: ${response.status}`) }
  const result = await response.json()
  if (result.success && result.data) return result.data as CVAnalysisResult
  throw new Error('Backend không trả về dữ liệu hợp lệ')
}

// ==================== HELPERS ====================
const getScoreColor = (score: number) => {
  if (score >= 85) return "text-green-600"
  if (score >= 70) return "text-blue-600"
  if (score >= 50) return "text-yellow-600"
  return "text-red-600"
}
const getScoreBg = (score: number) => {
  if (score >= 85) return "bg-green-50 border-green-200"
  if (score >= 70) return "bg-blue-50 border-blue-200"
  if (score >= 50) return "bg-yellow-50 border-yellow-200"
  return "bg-red-50 border-red-200"
}
const getScoreBarColor = (score: number) => {
  if (score >= 85) return "bg-green-500"
  if (score >= 70) return "bg-blue-500"
  if (score >= 50) return "bg-yellow-500"
  return "bg-red-400"
}

// ── Đồng bộ getStatusLabel với CandidatesPage (dùng source badge) ──
const getStatusLabel = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    'Mới':       { label: 'Mới',       className: 'bg-blue-100 text-blue-700 border-blue-200' },
    'Sàng lọc':  { label: 'Sàng lọc',  className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    'Phỏng vấn': { label: 'Phỏng vấn', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    'Chấp nhận': { label: 'Chấp nhận', className: 'bg-green-100 text-green-700 border-green-200' },
    'Từ chối':   { label: 'Từ chối',   className: 'bg-red-100 text-red-700 border-red-200' },
  }
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
}

// Medal component for top 3
function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 border-2 border-yellow-400 flex-shrink-0">
      <Crown className="h-4 w-4 text-yellow-600" />
    </div>
  )
  if (rank === 2) return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-400 flex-shrink-0">
      <Medal className="h-4 w-4 text-gray-500" />
    </div>
  )
  if (rank === 3) return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 border-2 border-orange-400 flex-shrink-0">
      <Award className="h-4 w-4 text-orange-600" />
    </div>
  )
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex-shrink-0">
      <span className="text-xs font-bold text-gray-500">{rank}</span>
    </div>
  )
}

// ── Badge yêu cầu bắt buộc (đồng bộ với CandidatesPage) ──
function MandatoryBadge({ met, notes }: { met?: boolean; notes?: string }) {
  if (met === undefined || met === null) return null
  return met ? (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
      <CheckCircle2 className="h-3 w-3" />Đáp ứng YC bắt buộc
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />Chưa xác nhận YC
    </Badge>
  )
}

// ── Badge bảng tiêu chí (đồng bộ với JobsPage rubric) ──
function RubricBadge({ hasRubric, passingScore }: { hasRubric: boolean; passingScore?: number }) {
  if (!hasRubric) return null
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
      <BarChart2 className="h-3 w-3" />Có bảng tiêu chí{passingScore ? ` (≥${passingScore})` : ''}
    </Badge>
  )
}

// ==================== RANKING TABLE COMPONENT ====================
type SortKey = 'rank' | 'name' | 'score' | 'job' | 'status'
type SortDir = 'asc' | 'desc'

interface RankingTableProps {
  candidates: any[]
  jobs: any[]
  rubricMap: Map<string, any>   // job_id → rubric data (đồng bộ JobsPage)
  onViewDetail: (c: any) => void
  onCreateInterview: (c: any) => void
  onReanalyze: (c: any) => void
  reanalyzingId: string | null
  analyzing: boolean
  onAnalyzeOne: (c: any) => void
}

function RankingTable({ candidates, jobs, rubricMap, onViewDetail, onCreateInterview, onReanalyze, reanalyzingId, analyzing, onAnalyzeOne }: RankingTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>('rank')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [jobFilter, setJobFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [scoreMin, setScoreMin] = React.useState(0)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = React.useState('all')   // đồng bộ CandidatesPage

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'score' ? 'desc' : 'asc') }
  }

  const analyzed = React.useMemo(() =>
    candidates.filter(c => c.analysis_result).sort((a, b) => b.overall_score - a.overall_score),
    [candidates]
  )
  const rankMap = React.useMemo(() => {
    const m = new Map<string, number>()
    analyzed.forEach((c, i) => m.set(c.id, i + 1))
    return m
  }, [analyzed])

  // Lấy unique sources từ candidates (đồng bộ với CandidatesPage)
  const uniqueSources = React.useMemo(() =>
    Array.from(new Set(candidates.map(c => c.source).filter(Boolean))),
    [candidates]
  )

  const filtered = React.useMemo(() => {
    let list = [...candidates]
    if (jobFilter !== 'all') list = list.filter(c => c.job_id === jobFilter)
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter)
    if (sourceFilter !== 'all') list = list.filter(c => c.source === sourceFilter)
    if (scoreMin > 0) list = list.filter(c => c.overall_score >= scoreMin)

    list.sort((a, b) => {
      let av: any, bv: any
      switch (sortKey) {
        case 'rank':   av = rankMap.get(a.id) ?? 9999; bv = rankMap.get(b.id) ?? 9999; break
        case 'name':   av = a.full_name; bv = b.full_name; break
        case 'score':  av = a.overall_score; bv = b.overall_score; break
        case 'job':    av = a.cv_jobs?.title || ''; bv = b.cv_jobs?.title || ''; break
        case 'status': av = a.status; bv = b.status; break
        default: av = 0; bv = 0
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [candidates, jobFilter, statusFilter, sourceFilter, scoreMin, sortKey, sortDir, rankMap])

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-300 ml-1 inline" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-blue-600 ml-1 inline" />
      : <ChevronDown className="h-3.5 w-3.5 text-blue-600 ml-1 inline" />
  }

  const exportRanking = () => {
    const rows = [
      ['Hạng', 'Họ tên', 'Email', 'Vị trí', 'Nguồn', 'Điểm', 'Trạng thái', 'Đáp ứng YC bắt buộc', 'Phù hợp nhất'].join(','),
      ...filtered.map(c => [
        rankMap.get(c.id) ?? '—',
        `"${c.full_name}"`,
        c.email,
        `"${c.cv_jobs?.title || ''}"`,
        c.source || '',
        c.overall_score,
        c.status,
        c.mandatory_requirements_met ? 'Có' : 'Không',
        `"${c.analysis_result?.best_match?.job_title || ''}"`,
      ].join(','))
    ].join('\n')
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'ranking_ung_vien.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const uniqueStatuses = ['Mới', 'Sàng lọc', 'Phỏng vấn', 'Chấp nhận', 'Từ chối']

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Vị trí</label>
          <select className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-blue-500"
            value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
            <option value="all">Tất cả vị trí</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title} – {j.level}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
          <select className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-blue-500"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Lọc theo nguồn — đồng bộ CandidatesPage */}
        {uniqueSources.length > 0 && (
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nguồn</label>
            <select className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-blue-500"
              value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
              <option value="all">Tất cả nguồn</option>
              {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Điểm tối thiểu: <strong>{scoreMin}</strong></label>
          <input type="range" min={0} max={100} step={5} value={scoreMin}
            onChange={e => setScoreMin(Number(e.target.value))}
            className="w-full accent-blue-600" />
        </div>
        <Button variant="outline" size="sm" onClick={exportRanking} className="flex-shrink-0 gap-1.5">
          <Download className="h-4 w-4" />Xuất CSV
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 font-medium">
          {filtered.length} ứng viên
        </span>
        <span className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-green-700 font-medium">
          {filtered.filter(c => c.overall_score >= 85).length} xuất sắc (≥85)
        </span>
        <span className="px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-full text-yellow-700 font-medium">
          {filtered.filter(c => c.analysis_result).length} đã phân tích
        </span>
        {/* Đồng bộ CandidatesPage: đáp ứng yêu cầu bắt buộc */}
        <span className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 font-medium">
          {filtered.filter(c => c.mandatory_requirements_met).length} đáp ứng YC bắt buộc
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('rank')} className="flex items-center text-xs font-semibold text-gray-600 hover:text-blue-600">
                    Hạng<SortIcon col="rank" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('name')} className="flex items-center text-xs font-semibold text-gray-600 hover:text-blue-600">
                    Ứng viên<SortIcon col="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('job')} className="flex items-center text-xs font-semibold text-gray-600 hover:text-blue-600">
                    Vị trí ứng tuyển<SortIcon col="job" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left" style={{ minWidth: 160 }}>
                  <button onClick={() => handleSort('score')} className="flex items-center text-xs font-semibold text-gray-600 hover:text-blue-600">
                    Điểm phù hợp<SortIcon col="score" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('status')} className="flex items-center text-xs font-semibold text-gray-600 hover:text-blue-600">
                    Trạng thái<SortIcon col="status" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Khớp tốt nhất</th>
                {/* Cột nguồn — đồng bộ CandidatesPage */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nguồn</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const rank = rankMap.get(c.id)
                const st = getStatusLabel(c.status)
                const isExpanded = expandedId === c.id
                const isPerfectMatch = c.analysis_result?.best_match?.job_id === c.cv_jobs?.id
                const jobRubric = c.job_id ? rubricMap.get(c.job_id) : null
                return (
                  <React.Fragment key={c.id}>
                    <tr className={`hover:bg-gray-50 transition-colors ${rank && rank <= 3 ? 'bg-gradient-to-r from-amber-50/40 to-transparent' : ''}`}>
                      {/* Rank */}
                      <td className="px-4 py-3">
                        {rank ? <RankMedal rank={rank} /> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* Candidate */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                            c.overall_score >= 85 ? 'bg-green-500' : c.overall_score >= 70 ? 'bg-blue-500' : c.overall_score >= 50 ? 'bg-yellow-500' : 'bg-gray-400'
                          }`}>
                            {c.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate max-w-[150px]">{c.full_name}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[150px]">{c.email}</p>
                            {/* Đồng bộ CandidatesPage: mandatory_requirements_met */}
                            {c.mandatory_requirements_met !== undefined && (
                              <MandatoryBadge met={c.mandatory_requirements_met} notes={c.mandatory_requirements_notes} />
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Job */}
                      <td className="px-4 py-3">
                        <p className="text-gray-800 text-sm truncate max-w-[140px]">{c.cv_jobs?.title || '—'}</p>
                        {c.cv_jobs?.level && <p className="text-xs text-gray-400">{c.cv_jobs.level}</p>}
                        {/* Đồng bộ JobsPage: hiển thị rubric nếu vị trí có bảng tiêu chí */}
                        {jobRubric && (
                          <RubricBadge hasRubric={true} passingScore={jobRubric.passing_score} />
                        )}
                      </td>
                      {/* Score bar */}
                      <td className="px-4 py-3">
                        {c.analysis_result ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-base font-bold ${getScoreColor(c.overall_score)}`}>{c.overall_score}</span>
                              <span className="text-[10px] text-gray-400">/100</span>
                            </div>
                            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${getScoreBarColor(c.overall_score)}`}
                                style={{ width: `${c.overall_score}%` }} />
                            </div>
                            {/* Đồng bộ JobsPage: cảnh báo nếu điểm dưới passing_score */}
                            {jobRubric && c.overall_score < jobRubric.passing_score && (
                              <p className="text-[10px] text-red-500 flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3" />Dưới mức đạt ({jobRubric.passing_score})
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Chưa phân tích</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${st.className}`}>{st.label}</Badge>
                      </td>
                      {/* Best match */}
                      <td className="px-4 py-3">
                        {c.analysis_result?.best_match ? (
                          <div className="flex items-center gap-1.5">
                            {isPerfectMatch
                              ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                              : <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            }
                            <span className="text-xs text-gray-700 truncate max-w-[120px]">
                              {c.analysis_result.best_match.job_title}
                            </span>
                            <span className={`text-[10px] font-bold flex-shrink-0 ${getScoreColor(c.analysis_result.best_match.match_score)}`}>
                              {c.analysis_result.best_match.match_score}%
                            </span>
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      {/* Nguồn — đồng bộ CandidatesPage */}
                      <td className="px-4 py-3">
                        {c.source
                          ? <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{c.source}</span>
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          {c.analysis_result ? (
                            <>
                              <button onClick={() => onViewDetail(c)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Xem chi tiết">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Điểm mạnh/yếu">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                              </button>
                              <button onClick={() => onReanalyze(c)} disabled={reanalyzingId === c.id}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Phân tích lại">
                                <RotateCcw className={`h-4 w-4 ${reanalyzingId === c.id ? 'animate-spin' : ''}`} />
                              </button>
                              <button onClick={() => onCreateInterview(c)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Tạo lịch phỏng vấn">
                                <Calendar className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => onAnalyzeOne(c)} disabled={analyzing}
                              className="px-2.5 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1">
                              <Brain className="h-3.5 w-3.5" />Phân tích
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded row: strengths & weaknesses inline */}
                    {isExpanded && c.analysis_result?.best_match && (
                      <tr className="bg-purple-50/40">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5" />Điểm mạnh
                              </p>
                              <ul className="space-y-1">
                                {(c.analysis_result.best_match.strengths || []).slice(0, 4).map((s: string, i: number) => (
                                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                    <span className="text-emerald-400 mt-0.5">•</span>{s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />Điểm yếu
                              </p>
                              <ul className="space-y-1">
                                {(c.analysis_result.best_match.weaknesses || []).slice(0, 4).map((w: string, i: number) => (
                                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                    <span className="text-amber-400 mt-0.5">•</span>{w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          {c.analysis_result.best_match.recommendation && (
                            <div className="mt-3 p-2.5 bg-white border border-purple-100 rounded-lg">
                              <p className="text-xs text-gray-600 flex items-start gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                                {c.analysis_result.best_match.recommendation}
                              </p>
                            </div>
                          )}
                          {/* Đồng bộ CandidatesPage: ghi chú yêu cầu bắt buộc */}
                          {c.mandatory_requirements_notes && (
                            <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                              <p className="text-xs text-amber-700 flex items-start gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                <span><strong>Ghi chú YC bắt buộc:</strong> {c.mandatory_requirements_notes}</span>
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm">Không có ứng viên nào phù hợp với bộ lọc</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ==================== BY-JOB VIEW COMPONENT ====================
interface ByJobViewProps {
  candidates: any[]
  jobs: any[]
  rubricMap: Map<string, any>   // đồng bộ JobsPage
  onViewDetail: (c: any) => void
  onCreateInterview: (c: any) => void
  onReanalyze: (c: any) => void
  reanalyzingId: string | null
  analyzing: boolean
  onAnalyzeOne: (c: any) => void
}

function ByJobView({ candidates, jobs, rubricMap, onViewDetail, onCreateInterview, onReanalyze, reanalyzingId, analyzing, onAnalyzeOne }: ByJobViewProps) {
  const [expandedJobs, setExpandedJobs] = React.useState<Set<string>>(new Set())
  const [scoreThreshold, setScoreThreshold] = React.useState(0)
  const [showOnlyAnalyzed, setShowOnlyAnalyzed] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [showOnlyMandatoryMet, setShowOnlyMandatoryMet] = React.useState(false)  // đồng bộ CandidatesPage

  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev)
      next.has(jobId) ? next.delete(jobId) : next.add(jobId)
      return next
    })
  }

  const expandAll = () => setExpandedJobs(new Set(jobs.map(j => j.id)))
  const collapseAll = () => setExpandedJobs(new Set())

  const byJob = React.useMemo(() => {
    const grouped = new Map<string, { job: any; candidates: any[] }>()
    jobs.forEach(j => grouped.set(j.id, { job: j, candidates: [] }))
    candidates.forEach(c => {
      if (c.job_id && grouped.has(c.job_id)) {
        grouped.get(c.job_id)!.candidates.push(c)
      }
    })
    grouped.forEach(g => {
      g.candidates.sort((a, b) => b.overall_score - a.overall_score)
    })
    return Array.from(grouped.values()).filter(g => g.candidates.length > 0)
      .sort((a, b) => b.candidates.length - a.candidates.length)
  }, [candidates, jobs])

  const filterCandidates = (list: any[]) => {
    let res = list
    if (showOnlyAnalyzed) res = res.filter(c => c.analysis_result)
    if (scoreThreshold > 0) res = res.filter(c => c.overall_score >= scoreThreshold)
    if (statusFilter !== 'all') res = res.filter(c => c.status === statusFilter)
    // Đồng bộ CandidatesPage: lọc theo yêu cầu bắt buộc
    if (showOnlyMandatoryMet) res = res.filter(c => c.mandatory_requirements_met === true)
    return res
  }

  const exportByJob = () => {
    const rows = [
      ['Vị trí', 'Có bảng tiêu chí', 'Điểm đạt tối thiểu', 'Hạng trong vị trí', 'Họ tên', 'Email', 'Nguồn', 'Điểm', 'Trạng thái', 'Đáp ứng YC bắt buộc', 'Apply đúng vị trí'].join(','),
      ...byJob.flatMap(({ job, candidates: cands }) => {
        const rubric = rubricMap.get(job.id)
        return filterCandidates(cands).map((c, i) => [
          `"${job.title}"`,
          rubric ? 'Có' : 'Không',
          rubric?.passing_score ?? '',
          i + 1,
          `"${c.full_name}"`,
          c.email,
          c.source || '',
          c.overall_score,
          c.status,
          c.mandatory_requirements_met ? 'Có' : 'Không',
          c.analysis_result?.best_match?.job_id === c.job_id ? 'Có' : 'Không',
        ].join(','))
      })
    ].join('\n')
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'ung_vien_theo_vitri.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex items-center gap-3">
          <button onClick={expandAll} className="text-xs text-blue-600 hover:underline">Mở tất cả</button>
          <span className="text-gray-300">|</span>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:underline">Thu gọn</button>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Điểm tối thiểu: <strong>{scoreThreshold}</strong></label>
          <input type="range" min={0} max={100} step={5} value={scoreThreshold}
            onChange={e => setScoreThreshold(Number(e.target.value))} className="w-full accent-blue-600" />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
          <select className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            {['Mới','Sàng lọc','Phỏng vấn','Chấp nhận','Từ chối'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="only-analyzed" checked={showOnlyAnalyzed}
            onChange={e => setShowOnlyAnalyzed(e.target.checked)} className="accent-blue-600" />
          <label htmlFor="only-analyzed" className="text-xs text-gray-600 cursor-pointer whitespace-nowrap">Chỉ đã phân tích</label>
        </div>
        {/* Đồng bộ CandidatesPage: lọc đáp ứng yêu cầu bắt buộc */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="only-mandatory" checked={showOnlyMandatoryMet}
            onChange={e => setShowOnlyMandatoryMet(e.target.checked)} className="accent-indigo-600" />
          <label htmlFor="only-mandatory" className="text-xs text-gray-600 cursor-pointer whitespace-nowrap">Đáp ứng YC bắt buộc</label>
        </div>
        <Button variant="outline" size="sm" onClick={exportByJob} className="flex-shrink-0 gap-1.5">
          <Download className="h-4 w-4" />Xuất CSV
        </Button>
      </div>

      {/* Job groups */}
      <div className="space-y-3">
        {byJob.map(({ job, candidates: allCands }) => {
          const cands = filterCandidates(allCands)
          const isOpen = expandedJobs.has(job.id)
          const analyzed = cands.filter(c => c.analysis_result).length
          const avgScore = analyzed > 0
            ? Math.round(cands.filter(c => c.analysis_result).reduce((s, c) => s + c.overall_score, 0) / analyzed)
            : 0
          const perfectMatches = cands.filter(c => c.analysis_result?.best_match?.job_id === c.job_id).length
          const mandatoryMetCount = cands.filter(c => c.mandatory_requirements_met).length
          const jobRubric = rubricMap.get(job.id)  // đồng bộ JobsPage

          return (
            <div key={job.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* Job header */}
              <button
                onClick={() => toggleJob(job.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors
                  ${isOpen ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm
                  ${isOpen ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                  {job.title.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold text-base ${isOpen ? 'text-white' : 'text-gray-900'}`}>{job.title}</h3>
                    <Badge variant="outline" className={`text-[10px] ${isOpen ? 'border-white/40 text-white/80' : 'border-gray-200 text-gray-500'}`}>
                      {job.level}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${isOpen ? 'border-white/40 text-white/80' : 'border-gray-200 text-gray-500'}`}>
                      {job.department}
                    </Badge>
                    {/* Đồng bộ JobsPage: badge bảng tiêu chí */}
                    {jobRubric && (
                      <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${isOpen ? 'border-white/40 text-white/80' : 'border-indigo-200 text-indigo-600'}`}>
                        <BarChart2 className="h-2.5 w-2.5" />Có bảng tiêu chí (≥{jobRubric.passing_score})
                      </Badge>
                    )}
                  </div>
                  <div className={`flex items-center gap-4 mt-1 text-xs ${isOpen ? 'text-blue-100' : 'text-gray-500'}`}>
                    <span>{cands.length} ứng viên</span>
                    <span>{analyzed} đã phân tích</span>
                    {analyzed > 0 && <span>TB: <strong>{avgScore}</strong> điểm</span>}
                    {perfectMatches > 0 && <span className={isOpen ? 'text-green-200' : 'text-green-600'}>✓ {perfectMatches} phù hợp</span>}
                    {/* Đồng bộ CandidatesPage: đáp ứng yêu cầu bắt buộc */}
                    {mandatoryMetCount > 0 && (
                      <span className={isOpen ? 'text-indigo-200' : 'text-indigo-600'}>
                        ✓ {mandatoryMetCount} đáp ứng YC
                      </span>
                    )}
                  </div>
                </div>
                {/* Mini score bars for top 3 */}
                <div className="hidden sm:flex items-center gap-1.5 mr-3 flex-shrink-0">
                  {cands.slice(0, 3).filter(c => c.analysis_result).map((c) => (
                    <div key={c.id} className="flex flex-col items-center gap-0.5">
                      <span className={`text-[10px] font-bold ${isOpen ? 'text-white' : getScoreColor(c.overall_score)}`}>{c.overall_score}</span>
                      <div className={`w-4 rounded-t-sm ${isOpen ? 'bg-white/60' : getScoreBarColor(c.overall_score)}`}
                        style={{ height: `${Math.max(4, Math.round((c.overall_score / 100) * 28))}px` }} />
                    </div>
                  ))}
                </div>
                <div className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                  <ChevronDown className={`h-5 w-5 ${isOpen ? 'text-white' : 'text-gray-400'}`} />
                </div>
              </button>

              {/* Candidate list */}
              {isOpen && (
                <div className="divide-y divide-gray-100 bg-white">
                  {cands.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">
                      Không có ứng viên nào khớp với bộ lọc
                    </div>
                  ) : cands.map((c, idx) => {
                    const rank = idx + 1
                    const st = getStatusLabel(c.status)
                    const isPerfect = c.analysis_result?.best_match?.job_id === c.job_id
                    return (
                      <div key={c.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors
                        ${rank <= 3 ? 'bg-gradient-to-r from-amber-50/30 to-transparent' : ''}`}>
                        {/* Rank within job */}
                        <div className="flex-shrink-0">
                          <RankMedal rank={rank} />
                        </div>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0
                          ${c.overall_score >= 85 ? 'bg-green-500' : c.overall_score >= 70 ? 'bg-blue-500' : c.overall_score >= 50 ? 'bg-yellow-500' : 'bg-gray-400'}`}>
                          {c.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-900 truncate">{c.full_name}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st.className}`}>{st.label}</Badge>
                            {isPerfect && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                                ✓ Đúng vị trí
                              </Badge>
                            )}
                            {!isPerfect && c.analysis_result?.best_match && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                → {c.analysis_result.best_match.job_title}
                              </Badge>
                            )}
                            {/* Đồng bộ CandidatesPage: mandatory badge */}
                            {c.mandatory_requirements_met !== undefined && (
                              <MandatoryBadge met={c.mandatory_requirements_met} />
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {c.email}
                            {c.source && <span className="ml-2 text-gray-300">· {c.source}</span>}
                          </p>
                        </div>
                        {/* Score */}
                        <div className="flex-shrink-0 text-right mr-2">
                          {c.analysis_result ? (
                            <div>
                              <span className={`text-lg font-bold ${getScoreColor(c.overall_score)}`}>{c.overall_score}</span>
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1">
                                <div className={`h-full rounded-full ${getScoreBarColor(c.overall_score)}`} style={{ width: `${c.overall_score}%` }} />
                              </div>
                              {/* Cảnh báo điểm dưới passing_score của rubric */}
                              {jobRubric && c.overall_score < jobRubric.passing_score && (
                                <p className="text-[10px] text-red-400 mt-0.5">↓ Dưới mức đạt</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 italic">—</span>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {c.analysis_result ? (
                            <>
                              <button onClick={() => onViewDetail(c)} title="Chi tiết"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button onClick={() => onReanalyze(c)} disabled={reanalyzingId === c.id} title="Phân tích lại"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                                <RotateCcw className={`h-4 w-4 ${reanalyzingId === c.id ? 'animate-spin' : ''}`} />
                              </button>
                              <button onClick={() => onCreateInterview(c)} title="Tạo lịch phỏng vấn"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                                <Calendar className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => onAnalyzeOne(c)} disabled={analyzing}
                              className="px-2.5 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1">
                              <Brain className="h-3.5 w-3.5" />Phân tích
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {byJob.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
            <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Chưa có dữ liệu ứng viên</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================
export default function PotentialCandidatesPage() {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading,       setLoading]       = React.useState(true)
  const [analyzing,     setAnalyzing]     = React.useState(false)
  const [reanalyzingId, setReanalyzingId] = React.useState<string | null>(null)
  const [candidates,    setCandidates]    = React.useState<any[]>([])
  const [jobs,          setJobs]          = React.useState<any[]>([])
  const [selectedJob,   setSelectedJob]   = React.useState<string>("all")
  const [matchFilter,   setMatchFilter]   = React.useState<string>("all")
  const [showDetail,    setShowDetail]    = React.useState(false)
  const [selectedCandidate, setSelectedCandidate] = React.useState<any>(null)
  const [mainTab, setMainTab] = React.useState<'cards' | 'ranking' | 'byjob'>('cards')

  // ── Đồng bộ JobsPage: rubric map (job_id → rubric) ──
  const [rubricMap, setRubricMap] = React.useState<Map<string, any>>(new Map())

  React.useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase.from("cv_jobs").select("*").order("title")
      if (jobsError) throw jobsError
      setJobs(jobsData || [])

      // ── Đồng bộ JobsPage: fetch rubrics ──
      const { data: rubricData } = await supabase
        .from('cv_job_scoring_rubrics')
        .select('job_id, criteria, passing_score, notes, total_weight')
      if (rubricData) {
        const map = new Map<string, any>()
        rubricData.forEach((r: any) => map.set(r.job_id, r))
        setRubricMap(map)
      }

      // ── Đồng bộ CandidatesPage: thêm mandatory_requirements_met, mandatory_requirements_notes, source ──
      const { data: candidatesData, error: candidatesError } = await supabase
        .from("cv_candidates")
        .select(`
          *,
          cv_jobs(id,title,level,department,description,requirements,benefits,mandatory_requirements,job_type,work_location,location),
          cv_candidate_skills(cv_skills(id,name,category))
        `)
        .not("cv_parsed_data", "is", null)
        .order("created_at", { ascending: false })
      if (candidatesError) throw candidatesError

      const parsedCandidates = (candidatesData || []).map((c: any) => {
        const analysisResult = c.cv_parsed_data?.analysis_result || null
        // overall_score = điểm match với job đã apply (giữ nguyên logic cũ)
        let appliedJobScore = 0
        if (analysisResult?.all_matches && c.job_id) {
          const match = analysisResult.all_matches.find((m: any) => m.job_id === c.job_id)
          appliedJobScore = match?.match_score || 0
        }
        return {
          ...c,
          analysis_result: analysisResult,
          overall_score: appliedJobScore,
          // Đảm bảo các field CandidatesPage có mặt đều được map đúng
          mandatory_requirements_met: c.mandatory_requirements_met ?? undefined,
          mandatory_requirements_notes: c.mandatory_requirements_notes ?? undefined,
          source: c.source ?? null,
        }
      })
      setCandidates(parsedCandidates)
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu", duration: 3000 })
    } finally { setLoading(false) }
  }

  const handleAnalyzeAll = async () => {
    try {
      setAnalyzing(true)
      const toAnalyze = candidates.filter(c => !c.analysis_result && c.cv_parsed_data)
      if (!toAnalyze.length) { toast({ title: "Thông báo", description: "Tất cả CV đã được phân tích", duration: 3000 }); return }
      let success = 0
      for (const candidate of toAnalyze) {
        try {
          const result = await analyzeWithGPT4o(
            candidate.cv_parsed_data?.fullText || '',
            { full_name: candidate.full_name, email: candidate.email, phone_number: candidate.phone_number, address: candidate.address, university: candidate.university, education: candidate.education, experience: candidate.experience },
            jobs,
            candidate.job_id
          )
          // ── Đồng bộ CandidatesPage: status flow Mới → Sàng lọc ──
          const newStatus = candidate.status === 'Mới' ? 'Sàng lọc' : candidate.status
          await supabase.from("cv_candidates").update({
            cv_parsed_data: { ...candidate.cv_parsed_data, analysis_result: result },
            status: newStatus,
          }).eq("id", candidate.id)
          success++
        } catch (e) { console.error(e) }
      }
      toast({ title: "Hoàn thành", description: `Phân tích ${success}/${toAnalyze.length} CV thành công`, duration: 3000 })
      await fetchData()
    } catch (e) { toast({ title: "Lỗi", description: "Có lỗi xảy ra khi phân tích", duration: 3000 }) }
    finally { setAnalyzing(false) }
  }

  const handleAnalyzeOne = async (candidate: any) => {
    if (!candidate.cv_parsed_data) return
    setAnalyzing(true)
    try {
      const result = await analyzeWithGPT4o(
        candidate.cv_parsed_data?.fullText || '',
        { full_name: candidate.full_name, email: candidate.email, phone_number: candidate.phone_number, address: candidate.address, university: candidate.university, education: candidate.education, experience: candidate.experience },
        jobs,
        candidate.job_id
      )
      const newStatus = candidate.status === 'Mới' ? 'Sàng lọc' : candidate.status
      await supabase.from("cv_candidates").update({
        cv_parsed_data: { ...candidate.cv_parsed_data, analysis_result: result },
        status: newStatus,
      }).eq("id", candidate.id)
      toast({ title: "Thành công", description: "Phân tích CV hoàn tất", duration: 3000 })
      await fetchData()
    } catch (e: any) { toast({ title: "Lỗi", description: e.message, duration: 3000 }) }
    finally { setAnalyzing(false) }
  }

  const handleReanalyze = async (candidate: any) => {
    if (!candidate.cv_parsed_data) return
    setReanalyzingId(candidate.id)
    try {
      const result = await analyzeWithGPT4o(
        candidate.cv_parsed_data?.fullText || '',
        { full_name: candidate.full_name, email: candidate.email, phone_number: candidate.phone_number, address: candidate.address, university: candidate.university, education: candidate.education, experience: candidate.experience },
        jobs,
        candidate.job_id
      )
      const newStatus = candidate.status === 'Mới' ? 'Sàng lọc' : candidate.status
      await supabase.from("cv_candidates").update({
        cv_parsed_data: { ...candidate.cv_parsed_data, analysis_result: result },
        status: newStatus,
      }).eq("id", candidate.id)
      toast({ title: "Phân tích lại thành công", description: `${candidate.full_name} - Điểm mới: ${result.overall_score}`, duration: 3000 })
      await fetchData()
    } catch (e: any) { toast({ title: "Lỗi phân tích lại", description: e.message, duration: 3000 }) }
    finally { setReanalyzingId(null) }
  }

  const handleViewDetail = (candidate: any) => { setSelectedCandidate(candidate); setShowDetail(true) }
  const handleCreateInterview = (candidate: any) => { navigate(`/phong-van?create=true&candidateId=${candidate.id}`) }

  // ── Cards tab filter (giữ nguyên logic cũ + thêm source) ──
  const filteredCandidates = React.useMemo(() => {
    return candidates.filter(c => {
      if (selectedJob !== "all" && c.job_id !== selectedJob) return false
      if (matchFilter === "perfect") return c.analysis_result?.best_match?.job_id === c.cv_jobs?.id
      if (matchFilter === "mismatch") return c.analysis_result && c.analysis_result.best_match?.job_id !== c.cv_jobs?.id
      if (matchFilter === "not-analyzed") return !c.analysis_result
      // Đồng bộ CandidatesPage: lọc đáp ứng yêu cầu bắt buộc
      if (matchFilter === "mandatory-met") return c.mandatory_requirements_met === true
      return true
    })
  }, [candidates, selectedJob, matchFilter])

  const stats = React.useMemo(() => {
    const total = filteredCandidates.length
    const analyzed = filteredCandidates.filter(c => c.analysis_result).length
    const excellent = filteredCandidates.filter(c => c.overall_score >= 85).length
    const perfectMatch = filteredCandidates.filter(c => c.analysis_result?.best_match?.job_id === c.cv_jobs?.id).length
    const avgScore = analyzed > 0 ? Math.round(filteredCandidates.filter(c => c.analysis_result).reduce((s, c) => s + c.overall_score, 0) / analyzed) : 0
    // Đồng bộ CandidatesPage
    const mandatoryMet = filteredCandidates.filter(c => c.mandatory_requirements_met === true).length
    // Đồng bộ JobsPage
    const withRubric = new Set(candidates.map(c => c.job_id).filter(id => id && rubricMap.has(id))).size
    return { total, analyzed, excellent, avgScore, perfectMatch, perfectMatchRate: analyzed > 0 ? Math.round((perfectMatch / analyzed) * 100) : 0, mandatoryMet, withRubric }
  }, [filteredCandidates, candidates, rubricMap])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
        <p className="text-gray-600">Đang tải dữ liệu...</p>
      </div>
    </div>
  )

  // Shared props for sub-components
  const sharedProps = {
    candidates, jobs, rubricMap,
    onViewDetail: handleViewDetail,
    onCreateInterview: handleCreateInterview,
    onReanalyze: handleReanalyze,
    reanalyzingId, analyzing,
    onAnalyzeOne: handleAnalyzeOne,
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
            <span>Ứng viên tiềm năng</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Phân tích và đánh giá độ phù hợp của CV với các vị trí tuyển dụng
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Button variant="outline" onClick={fetchData} disabled={analyzing} size="sm">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${analyzing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
          <Button onClick={handleAnalyzeAll} disabled={analyzing} size="sm">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">{analyzing ? "Đang phân tích..." : "Phân tích tất cả"}</span>
          </Button>
        </div>
      </div>

      {/* Stats — đồng bộ thêm mandatoryMet và withRubric */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: 'Tổng số CV',         value: stats.total,              color: 'text-blue-600',   border: 'border-blue-100' },
          { label: 'Đã phân tích',       value: stats.analyzed,           color: 'text-green-600',  border: 'border-green-100' },
          { label: 'Điểm TB',            value: stats.avgScore,           color: 'text-yellow-600', border: 'border-yellow-100' },
          { label: 'Xuất sắc (≥85)',     value: stats.excellent,          color: 'text-purple-600', border: 'border-purple-100' },
          { label: 'Đáp ứng YC bắt buộc', value: stats.mandatoryMet,    color: 'text-indigo-600', border: 'border-indigo-100' },
          { label: 'Apply đúng vị trí',  value: `${stats.perfectMatchRate}%`, color: 'text-rose-600', border: 'border-rose-100', sub: `(${stats.perfectMatch}/${stats.analyzed})` },
        ].map(s => (
          <Card key={s.label} className={`border-2 ${s.border}`}>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-xl sm:text-2xl lg:text-3xl font-bold ${s.color}`}>{s.value}</span>
                {(s as any).sub && <span className="text-xs text-gray-400">{(s as any).sub}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {[
            { id: 'cards'   as const, label: 'Thẻ ứng viên',  icon: <LayoutGrid className="h-4 w-4" /> },
            { id: 'ranking' as const, label: 'Xếp hạng',      icon: <Trophy className="h-4 w-4" /> },
            { id: 'byjob'   as const, label: 'Theo vị trí',   icon: <Layers className="h-4 w-4" /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px
                ${mainTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>
              {tab.icon}{tab.label}
              {tab.id === 'ranking' && candidates.filter(c => c.analysis_result).length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                  {candidates.filter(c => c.analysis_result).length}
                </span>
              )}
              {tab.id === 'byjob' && (
                <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                  {new Set(candidates.map(c => c.job_id).filter(Boolean)).size} vị trí
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cards tab ── */}
      {mainTab === 'cards' && (
        <>
          <Card>
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5" />Lọc theo vị trí
                  </label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>
                    <option value="all">Tất cả vị trí</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title} - {j.level}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5" />Lọc theo độ phù hợp
                  </label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={matchFilter} onChange={e => setMatchFilter(e.target.value)}>
                    <option value="all">Tất cả trạng thái</option>
                    <option value="perfect">✅ Apply đúng vị trí phù hợp nhất</option>
                    <option value="mismatch">⚠️ Nên chuyển vị trí khác</option>
                    <option value="not-analyzed">⏳ Chưa phân tích</option>
                    {/* Đồng bộ CandidatesPage */}
                    <option value="mandatory-met">✓ Đáp ứng yêu cầu bắt buộc</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredCandidates.map(candidate => {
              const jobRubric = candidate.job_id ? rubricMap.get(candidate.job_id) : null
              return (
                <Card key={candidate.id}
                  className={`hover:shadow-lg transition-all ${candidate.analysis_result ? getScoreBg(candidate.overall_score) : "bg-gray-50"}`}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1 truncate">{candidate.full_name}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{candidate.email}</p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                          {candidate.cv_jobs && <Badge variant="outline" className="text-[10px] sm:text-xs">{candidate.cv_jobs.title}</Badge>}
                          {candidate.status === 'Sàng lọc' && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px] sm:text-xs">Sàng lọc</Badge>}
                          {/* Đồng bộ CandidatesPage */}
                          {candidate.mandatory_requirements_met !== undefined && (
                            <MandatoryBadge met={candidate.mandatory_requirements_met} />
                          )}
                          {/* Đồng bộ JobsPage: badge bảng tiêu chí */}
                          {jobRubric && <RubricBadge hasRubric={true} passingScore={jobRubric.passing_score} />}
                          {candidate.source && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">{candidate.source}</span>
                          )}
                        </div>
                      </div>
                      {candidate.analysis_result && (
                        <div className="shrink-0 ml-2 text-right">
                          <span className={`text-xl sm:text-2xl font-bold ${getScoreColor(candidate.overall_score)}`}>
                            {candidate.overall_score}
                          </span>
                          {/* Cảnh báo dưới passing_score */}
                          {jobRubric && candidate.overall_score < jobRubric.passing_score && (
                            <p className="text-[10px] text-red-500 flex items-center gap-0.5 justify-end mt-0.5">
                              <AlertTriangle className="h-3 w-3" />Dưới {jobRubric.passing_score}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {candidate.analysis_result?.best_match && (
                      <div className={`rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4 border-2 ${
                        candidate.cv_jobs?.id === candidate.analysis_result.best_match.job_id
                          ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-300'
                          : 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-300'
                      }`}>
                        <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            {candidate.cv_jobs?.id === candidate.analysis_result.best_match.job_id
                              ? <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
                              : <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />}
                            <p className="text-[10px] sm:text-xs font-semibold text-gray-700">
                              {candidate.cv_jobs?.id === candidate.analysis_result.best_match.job_id ? 'Vị trí phù hợp nhất' : 'Gợi ý vị trí phù hợp hơn'}
                            </p>
                          </div>
                          <Badge className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 ${
                            candidate.cv_jobs?.id === candidate.analysis_result.best_match.job_id
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                            {candidate.analysis_result.best_match.match_score}%
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2 truncate">
                          {candidate.analysis_result.best_match.job_title}
                        </p>
                        {candidate.cv_jobs?.id === candidate.analysis_result.best_match.job_id ? (
                          <div className="bg-white/60 rounded px-2 py-1">
                            <p className="text-[10px] sm:text-xs text-emerald-700 font-medium">✅ Ứng viên đã apply đúng vị trí</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="bg-white/60 rounded px-2 py-1">
                              <p className="text-[10px] sm:text-xs text-gray-600">Đã apply: <span className="font-medium">{candidate.cv_jobs?.title}</span></p>
                            </div>
                            <p className="text-[10px] sm:text-xs text-amber-700 font-medium flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />Nên xem xét chuyển vị trí
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {!candidate.analysis_result ? (
                        <Button size="sm" variant="ghost" onClick={() => handleAnalyzeOne(candidate)} disabled={analyzing}
                          className="w-full h-10 sm:h-9 text-xs sm:text-sm text-gray-900 hover:bg-gray-100">
                          <Brain className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />Phân tích
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleViewDetail(candidate)} className="w-full h-10 sm:h-9 text-xs sm:text-sm">
                            <Eye className="h-3.5 w-3.5 mr-1.5" />Xem chi tiết
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleReanalyze(candidate)} disabled={reanalyzingId === candidate.id} className="w-full h-10 sm:h-9 text-xs sm:text-sm">
                            {reanalyzingId === candidate.id
                              ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Đang phân tích...</>
                              : <><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Phân tích lại</>}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleCreateInterview(candidate)}
                            className="w-full h-10 sm:h-9 text-xs sm:text-sm border-blue-200 text-blue-700 hover:bg-blue-50">
                            <Calendar className="h-3.5 w-3.5 mr-1.5" />Tạo lịch phỏng vấn
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredCandidates.length === 0 && (
            <Card><CardContent className="p-8 sm:p-12 text-center">
              <Users className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1.5 sm:mb-2">Không tìm thấy ứng viên</h3>
              <p className="text-xs sm:text-sm text-gray-600">Thử điều chỉnh bộ lọc để xem thêm ứng viên</p>
            </CardContent></Card>
          )}
        </>
      )}

      {/* ── Ranking tab ── */}
      {mainTab === 'ranking' && <RankingTable {...sharedProps} />}

      {/* ── By-Job tab ── */}
      {mainTab === 'byjob' && <ByJobView {...sharedProps} />}

      {/* ── Detail Dialog (giữ nguyên + bổ sung mandatory & rubric info) ── */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{selectedCandidate?.full_name}</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">{selectedCandidate?.email}</p>
            </DialogTitle>
          </DialogHeader>

          {selectedCandidate && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 lg:p-5 rounded-xl border border-blue-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base text-blue-900 flex items-center gap-2">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5" />Điểm phù hợp vị trí đã apply
                    </h4>
                    <p className="text-xs sm:text-sm text-blue-700 mt-1">{selectedCandidate?.cv_jobs?.title}</p>
                    {/* Đồng bộ JobsPage: hiển thị passing score nếu có rubric */}
                    {selectedCandidate?.job_id && rubricMap.has(selectedCandidate.job_id) && (
                      <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
                        <BarChart2 className="h-3.5 w-3.5" />
                        Điểm đạt yêu cầu: {rubricMap.get(selectedCandidate.job_id)?.passing_score}/100
                        {selectedCandidate.overall_score >= rubricMap.get(selectedCandidate.job_id)?.passing_score
                          ? <span className="text-green-600 font-medium ml-1">✓ Đạt</span>
                          : <span className="text-red-500 font-medium ml-1">✗ Chưa đạt</span>
                        }
                      </p>
                    )}
                  </div>
                  <span className={`text-xl sm:text-2xl font-bold ${getScoreColor(selectedCandidate.overall_score || 0)}`}>
                    {selectedCandidate.overall_score || 0}/100
                  </span>
                </div>
                <Progress value={selectedCandidate.overall_score || 0} className="h-2 sm:h-3" />
              </div>

              {/* Đồng bộ CandidatesPage: mandatory requirements block */}
              {(selectedCandidate.mandatory_requirements_met !== undefined || selectedCandidate.cv_jobs?.mandatory_requirements) && (
                <div className={`rounded-xl p-3 sm:p-4 border-2 ${
                  selectedCandidate.mandatory_requirements_met
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {selectedCandidate.mandatory_requirements_met
                      ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    }
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${selectedCandidate.mandatory_requirements_met ? 'text-green-800' : 'text-amber-800'}`}>
                        {selectedCandidate.mandatory_requirements_met
                          ? 'Ứng viên đáp ứng yêu cầu bắt buộc'
                          : 'Chưa xác nhận yêu cầu bắt buộc'}
                      </p>
                      {selectedCandidate.cv_jobs?.mandatory_requirements && (
                        <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{selectedCandidate.cv_jobs.mandatory_requirements}</p>
                      )}
                      {selectedCandidate.mandatory_requirements_notes && (
                        <p className="text-xs text-gray-700 mt-2 p-2 bg-white/60 rounded-lg border border-current/20">
                          <strong>Ghi chú:</strong> {selectedCandidate.mandatory_requirements_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedCandidate.analysis_result?.best_match && (
                <div className={`rounded-xl p-3 sm:p-4 lg:p-5 border-2 ${
                  selectedCandidate.cv_jobs?.id === selectedCandidate.analysis_result.best_match.job_id
                    ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-300'
                    : 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-300'
                }`}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    {selectedCandidate.cv_jobs?.id === selectedCandidate.analysis_result.best_match.job_id
                      ? <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                      : <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />}
                    <h4 className={`font-semibold text-sm sm:text-base sm:text-lg ${
                      selectedCandidate.cv_jobs?.id === selectedCandidate.analysis_result.best_match.job_id ? 'text-emerald-900' : 'text-amber-900'}`}>
                      {selectedCandidate.cv_jobs?.id === selectedCandidate.analysis_result.best_match.job_id ? 'Vị trí Apply là phù hợp nhất' : 'Gợi ý vị trí phù hợp hơn'}
                    </h4>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 bg-white/70 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Vị trí phù hợp nhất:</p>
                        <p className="font-semibold text-sm sm:text-base sm:text-lg text-gray-900 truncate">{selectedCandidate.analysis_result.best_match.job_title}</p>
                      </div>
                      <Badge className={`text-xs sm:text-sm sm:text-base font-bold px-2 sm:px-3 py-1 mt-2 sm:mt-0 ${
                        selectedCandidate.cv_jobs?.id === selectedCandidate.analysis_result.best_match.job_id
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                        {selectedCandidate.analysis_result.best_match.match_score}%
                      </Badge>
                    </div>
                    {selectedCandidate.cv_jobs?.id === selectedCandidate.analysis_result.best_match.job_id ? (
                      <div className="bg-emerald-100/50 rounded-lg p-3 sm:p-4 border border-emerald-200">
                        <p className="text-xs sm:text-sm text-emerald-800 font-medium flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />Ứng viên đã apply đúng vị trí có độ phù hợp cao nhất
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        <div className="bg-white/70 rounded-lg p-2 sm:p-3 border border-gray-200">
                          <p className="text-[10px] sm:text-xs text-gray-600 mb-1">Vị trí đã apply:</p>
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900 truncate">{selectedCandidate.cv_jobs?.title}</p>
                            {(() => {
                              const m = selectedCandidate.analysis_result.all_matches?.find((x: any) => x.job_id === selectedCandidate.cv_jobs?.id)
                              return m ? <Badge variant="outline" className="text-[10px] sm:text-xs">{m.match_score}% match</Badge> : null
                            })()}
                          </div>
                        </div>
                        <div className="bg-amber-100/50 rounded-lg p-3 sm:p-4 border border-amber-200">
                          <p className="text-xs sm:text-sm text-amber-800 font-medium flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />Khuyến nghị
                          </p>
                          <p className="text-xs sm:text-sm text-amber-700">
                            Xem xét chuyển sang vị trí <span className="font-semibold">{selectedCandidate.analysis_result.best_match.job_title}</span>
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="bg-white/70 rounded-lg p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{selectedCandidate.analysis_result.best_match.recommendation}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedCandidate.analysis_result?.all_matches && (
                <Tabs defaultValue="strengths" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="strengths" className="text-xs sm:text-sm">Điểm mạnh</TabsTrigger>
                    <TabsTrigger value="weaknesses" className="text-xs sm:text-sm">Điểm yếu</TabsTrigger>
                    <TabsTrigger value="matches" className="text-xs sm:text-sm">Gợi ý khác</TabsTrigger>
                  </TabsList>
                  <TabsContent value="strengths" className="space-y-3">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-3 sm:p-4 lg:p-5 rounded-xl border border-emerald-200">
                      <h4 className="font-semibold text-sm sm:text-base text-emerald-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />Điểm mạnh
                      </h4>
                      <ul className="space-y-1.5 sm:space-y-2">
                        {selectedCandidate.analysis_result.best_match?.strengths?.map((s: string, i: number) => (
                          <li key={i} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2 text-emerald-800">
                            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 mt-0.5 shrink-0" />{s}
                          </li>
                        ))}
                        {!selectedCandidate.analysis_result.best_match?.strengths?.length && <p className="text-xs sm:text-sm text-gray-500">Không có thông tin</p>}
                      </ul>
                    </div>
                  </TabsContent>
                  <TabsContent value="weaknesses" className="space-y-3">
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 sm:p-4 lg:p-5 rounded-xl border border-amber-200">
                      <h4 className="font-semibold text-sm sm:text-base text-amber-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />Điểm yếu
                      </h4>
                      <ul className="space-y-1.5 sm:space-y-2">
                        {selectedCandidate.analysis_result.best_match?.weaknesses?.map((w: string, i: number) => (
                          <li key={i} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2 text-amber-800">
                            <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 mt-0.5 shrink-0" />{w}
                          </li>
                        ))}
                        {!selectedCandidate.analysis_result.best_match?.weaknesses?.length && <p className="text-xs sm:text-sm text-gray-500">Không có thông tin</p>}
                      </ul>
                    </div>
                  </TabsContent>
                  <TabsContent value="matches" className="space-y-3">
                    {(() => {
                      const suggested = selectedCandidate.analysis_result.all_matches
                        .filter((m: any) => m.job_id !== selectedCandidate.cv_jobs?.id).slice(0, 3)
                      return suggested.length > 0 ? (
                        <>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4">
                            <p className="text-xs sm:text-sm text-blue-800"><span className="font-semibold">💡 Gợi ý {suggested.length} vị trí phù hợp khác:</span></p>
                          </div>
                          {suggested.map((match: any, index: number) => (
                            <Card key={index} className={`${getScoreBg(match.match_score)} border-2`}>
                              <CardContent className="p-3 sm:p-4">
                                <div className="flex items-center justify-between mb-2 sm:mb-3">
                                  <h5 className="font-semibold text-sm sm:text-base text-gray-900 truncate">{match.job_title}</h5>
                                  <Badge className={`${getScoreBg(match.match_score)} text-xs sm:text-sm px-2 sm:px-3 py-1`}>
                                    <span className={`font-bold text-xs sm:text-sm ${getScoreColor(match.match_score)}`}>{match.match_score}%</span>
                                  </Badge>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">{match.recommendation}</p>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                  <div>
                                    <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-1.5 sm:mb-2">Điểm mạnh:</p>
                                    <ul className="space-y-1">
                                      {match.strengths?.slice(0, 3).map((s: string, i: number) => (
                                        <li key={i} className="text-[10px] sm:text-xs text-gray-700 flex items-start gap-1">
                                          <CheckCircle className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />{s}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-1.5 sm:mb-2">Điểm yếu:</p>
                                    <ul className="space-y-1">
                                      {match.weaknesses?.slice(0, 2).map((w: string, i: number) => (
                                        <li key={i} className="text-[10px] sm:text-xs text-gray-700 flex items-start gap-1">
                                          <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />{w}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </>
                      ) : (
                        <div className="text-center py-6 sm:py-8">
                          <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-400 mx-auto mb-2 sm:mb-3" />
                          <p className="text-sm sm:text-base text-gray-600 font-medium">Không có gợi ý vị trí nào khác phù hợp hơn</p>
                          <p className="text-xs sm:text-sm text-gray-500 mt-1">Vị trí hiện tại là lựa chọn tốt nhất</p>
                        </div>
                      )
                    })()}
                  </TabsContent>
                </Tabs>
              )}

              {/* Info grid — đồng bộ CandidatesPage: thêm source */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5 bg-gray-50 rounded-xl border border-gray-200">
                {[
                  ['Trường', selectedCandidate.university],
                  ['Học vấn', selectedCandidate.education],
                  ['Kinh nghiệm', selectedCandidate.experience],
                  ['Địa chỉ', selectedCandidate.address],
                  ['Nguồn ứng tuyển', selectedCandidate.source],       // đồng bộ CandidatesPage
                  ['Số điện thoại', selectedCandidate.phone_number],    // đồng bộ CandidatesPage
                ].map(([l, v]) => (
                  <div key={l}><p className="text-[10px] sm:text-xs text-gray-500 mb-1">{l}</p><p className="text-xs sm:text-sm font-medium text-gray-900">{v || 'N/A'}</p></div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={() => setShowDetail(false)} className="w-full sm:w-auto">Đóng</Button>
                {selectedCandidate.cv_url && (
                  <Button onClick={() => window.open(selectedCandidate.cv_url, "_blank")} className="w-full sm:w-auto gap-2">
                    <Download className="h-4 w-4" />Tải CV gốc
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}