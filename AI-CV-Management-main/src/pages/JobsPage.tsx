"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Search, Plus, MoreHorizontal, FileText, CheckCircle, Users, Eye, Edit, Trash2,
  Share2, Copy, Sparkles, PenTool, X, Tag,
  // ── NEW: Scoring Rubric icons
  BarChart2, GripVertical, ChevronDown, ChevronUp, Info, AlertTriangle,
  CheckCircle2, Sliders, Award, Percent,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import { CategoryManagerDialog } from "@/components/jobs/CategoryManagerDialog"

// ─────────────────────────────────────────────────────────────────────────────
// SCORING RUBRIC — Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

export type ScoringLevel = string // Dynamic levels from categories

export interface RubricCriterion {
  id: string
  name: string            // e.g. "Kỹ năng kỹ thuật"
  description: string     // guidance for AI
  weight: number          // 1-100, must sum to 100 across all criteria
  level: ScoringLevel     // required / important / nice-to-have
  max_score: number       // max points this criterion can contribute (derived from weight)
  scoring_guide: {        // what each score means
    excellent: string     // 85-100%
    good: string          // 70-84%
    average: string       // 50-69%
    poor: string          // 0-49%
  }
}

export interface ScoringRubric {
  id?: string
  job_id: string
  criteria: RubricCriterion[]
  total_weight: number        // sum of all weights (must = 100)
  passing_score: number       // min score to pass (0-100)
  notes: string               // general instructions to AI
  created_at?: string
  updated_at?: string
}

// Dynamic level meta based on categories
const DEFAULT_RUBRIC_LEVELS: CategoryItem[] = [
  {
    value: 'required',
    label: 'Bắt buộc',
    metadata: {
      color: '#ef4444',
      priority: 3,
      description: 'Nếu không có sẽ bị loại',
      default_weight: 35,
    },
  },
  {
    value: 'important',
    label: 'Quan trọng',
    metadata: {
      color: '#3b82f6',
      priority: 2,
      description: 'Tiêu chí quan trọng, ảnh hưởng lớn đến quyết định',
      default_weight: 20,
    },
  },
  {
    value: 'nice_to_have',
    label: 'Cộng điểm',
    metadata: {
      color: '#10b981',
      priority: 1,
      description: 'Không bắt buộc, nếu có được cộng điểm',
      default_weight: 8,
    },
  },
]

const getRubricLevels = (_jobCategories: Record<string, CategoryItem[]>) => DEFAULT_RUBRIC_LEVELS

const getLevelMeta = (level: string, jobCategories: Record<string, CategoryItem[]>) => {
  const rubricLevels = getRubricLevels(jobCategories)
  const item = rubricLevels.find(l => l.value === level)

  const fallbackMap: Record<string, Partial<CategoryItem>> = {
    required: DEFAULT_RUBRIC_LEVELS[0],
    important: DEFAULT_RUBRIC_LEVELS[1],
    nice_to_have: DEFAULT_RUBRIC_LEVELS[2],
  }

  const fallback = fallbackMap[level]
  const selected = item || fallback
  if (!selected) return { label: level, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', style: {} }

  const metadata = (selected as any).metadata || {}
  const color = metadata.color || '#3b82f6'
  
  const colorMap: Record<string, { color: string; bg: string }> = {
    '#ef4444': { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    '#3b82f6': { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    '#10b981': { color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    '#f59e0b': { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
    '#8b5cf6': { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  }

  const colorSet = colorMap[color] || { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' }

  return { 
    label: selected.label, 
    ...colorSet,
    style: { borderColor: `${color}33`, backgroundColor: `${color}1a` },
    priority: metadata.priority || 1,
    description: metadata.description || '',
    default_weight: metadata.default_weight || 0,
  }
}

const DEFAULT_CRITERIA: Omit<RubricCriterion, 'id'>[] = [
  {
    name: 'Kỹ năng kỹ thuật',
    description: 'Đánh giá các kỹ năng chuyên môn, công nghệ, công cụ liên quan đến vị trí',
    weight: 35,
    level: 'required',
    max_score: 35,
    scoring_guide: {
      excellent: 'Có đầy đủ hoặc vượt yêu cầu kỹ thuật, có dự án thực tế minh chứng',
      good: 'Đáp ứng đa số yêu cầu kỹ thuật, có một số kinh nghiệm thực tế',
      average: 'Đáp ứng một phần yêu cầu, cần đào tạo thêm',
      poor: 'Thiếu nhiều kỹ năng cần thiết',
    },
  },
  {
    name: 'Kinh nghiệm làm việc',
    description: 'Số năm kinh nghiệm, độ phù hợp ngành nghề, sự tiến bộ trong sự nghiệp',
    weight: 25,
    level: 'required',
    max_score: 25,
    scoring_guide: {
      excellent: 'Kinh nghiệm phong phú, vượt yêu cầu, đúng lĩnh vực',
      good: 'Đủ kinh nghiệm, phần lớn liên quan đến vị trí',
      average: 'Kinh nghiệm ít hơn yêu cầu hoặc khác ngành',
      poor: 'Thiếu kinh nghiệm đáng kể',
    },
  },
  {
    name: 'Học vấn & Bằng cấp',
    description: 'Trình độ học vấn, chuyên ngành, trường đại học, các chứng chỉ liên quan',
    weight: 20,
    level: 'important',
    max_score: 20,
    scoring_guide: {
      excellent: 'Bằng cấp đúng chuyên ngành từ trường uy tín, có chứng chỉ nổi bật',
      good: 'Bằng cấp phù hợp, chuyên ngành liên quan',
      average: 'Bằng cấp không hoàn toàn phù hợp hoặc trường ít tên tuổi',
      poor: 'Không đáp ứng yêu cầu học vấn tối thiểu',
    },
  },
  {
    name: 'Kỹ năng mềm',
    description: 'Giao tiếp, làm việc nhóm, quản lý thời gian, tư duy giải quyết vấn đề',
    weight: 12,
    level: 'important',
    max_score: 12,
    scoring_guide: {
      excellent: 'CV thể hiện rõ kỹ năng lãnh đạo, teamwork, giao tiếp xuất sắc',
      good: 'Có dẫn chứng về kỹ năng mềm tốt',
      average: 'Ít thông tin về kỹ năng mềm',
      poor: 'Không có thông tin hoặc dấu hiệu kỹ năng mềm kém',
    },
  },
  {
    name: 'Điểm cộng & Thành tích',
    description: 'Giải thưởng, dự án nổi bật, đóng góp cộng đồng, chứng chỉ thêm',
    weight: 8,
    level: 'nice_to_have',
    max_score: 8,
    scoring_guide: {
      excellent: 'Có nhiều thành tích nổi bật, giải thưởng hoặc đóng góp đáng kể',
      good: 'Có một vài điểm cộng đáng chú ý',
      average: 'Ít điểm cộng',
      poor: 'Không có điểm cộng',
    },
  },
]

const genId = () => Math.random().toString(36).slice(2, 9)

// ─────────────────────────────────────────────────────────────────────────────
// SCORING RUBRIC — Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface WeightBarProps { weight: number; total: number }
function WeightBar({ weight, total }: WeightBarProps) {
  const pct = total > 0 ? Math.round((weight / total) * 100) : 0
  const color = weight > 40 ? 'bg-red-500' : weight > 25 ? 'bg-blue-500' : weight > 15 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold text-gray-600 w-8 text-right">{weight}%</span>
    </div>
  )
}

interface CriterionRowProps {
  criterion: RubricCriterion
  totalWeight: number
  jobCategories: Record<string, CategoryItem[]>
  onUpdate: (id: string, patch: Partial<RubricCriterion>) => void
  onDelete: (id: string) => void
  isExpanded: boolean
  onToggleExpand: (id: string) => void
}

function CriterionRow({ criterion, totalWeight, jobCategories, onUpdate, onDelete, isExpanded, onToggleExpand }: CriterionRowProps) {
  const lm = getLevelMeta(criterion.level, jobCategories)
  return (
    <div className={`border rounded-xl overflow-hidden transition-shadow hover:shadow-sm ${lm.bg}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0 cursor-grab" />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <Input
            value={criterion.name}
            onChange={e => onUpdate(criterion.id, { name: e.target.value })}
            className="font-semibold text-sm border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Tên tiêu chí..."
          />
        </div>

        {/* Level badge */}
        <Select value={criterion.level} onValueChange={v => onUpdate(criterion.id, { level: v })}>
          <SelectTrigger className={`w-32 h-7 text-xs border ${lm.bg} ${lm.color} focus:ring-0`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white z-[70]">
            {getRubricLevels(jobCategories).map((level) => (
              <SelectItem key={level.value} value={level.value} className="text-xs">{level.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Weight input */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Input
            type="number" min={1} max={100} value={criterion.weight}
            onChange={e => onUpdate(criterion.id, { weight: Math.max(1, Math.min(100, Number(e.target.value))) })}
            className="w-16 h-7 text-xs text-center font-mono border-gray-300"
          />
          <Percent className="h-3.5 w-3.5 text-gray-400" />
        </div>

        {/* Actions */}
        <button onClick={() => onToggleExpand(criterion.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button onClick={() => onDelete(criterion.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Weight bar */}
      <div className="px-4 pb-2">
        <WeightBar weight={criterion.weight} total={totalWeight} />
      </div>

      {/* Expanded: description + scoring guide */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/60 pt-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Mô tả tiêu chí <span className="text-gray-400">(hướng dẫn cho AI)</span>
            </label>
            <Textarea
              value={criterion.description}
              onChange={e => onUpdate(criterion.id, { description: e.target.value })}
              placeholder="Mô tả chi tiết AI nên đánh giá điều gì trong tiêu chí này..."
              className="min-h-[60px] resize-none text-sm bg-white/70"
            />
          </div>

          {/* Scoring guide */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" />Thang điểm chi tiết
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { key: 'excellent', label: 'Xuất sắc (85-100%)', color: 'border-l-green-500 bg-green-50/50' },
                { key: 'good',      label: 'Tốt (70-84%)',       color: 'border-l-blue-500 bg-blue-50/50' },
                { key: 'average',   label: 'Trung bình (50-69%)', color: 'border-l-yellow-500 bg-yellow-50/50' },
                { key: 'poor',      label: 'Yếu (0-49%)',        color: 'border-l-red-500 bg-red-50/50' },
              ] as const).map(({ key, label, color }) => (
                <div key={key} className={`border-l-2 pl-2 rounded-r-lg p-2 ${color}`}>
                  <p className="text-[10px] font-semibold text-gray-500 mb-0.5">{label}</p>
                  <Textarea
                    value={criterion.scoring_guide[key]}
                    onChange={e => onUpdate(criterion.id, {
                      scoring_guide: { ...criterion.scoring_guide, [key]: e.target.value }
                    })}
                    placeholder={`Mô tả mức ${label.toLowerCase()}...`}
                    className="min-h-[48px] resize-none text-xs bg-white/70 p-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING RUBRIC DIALOG
// ─────────────────────────────────────────────────────────────────────────────

interface ScoringRubricDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  job: Job | null
  jobCategories: Record<string, CategoryItem[]>
}

function ScoringRubricDialog({ open, onOpenChange, job, jobCategories }: ScoringRubricDialogProps) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>([])
  const [passingScore, setPassingScore] = useState(70)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [rubricId, setRubricId] = useState<string | undefined>()

  // Load existing rubric when dialog opens
  useEffect(() => {
    if (open && job) loadRubric()
  }, [open, job])

  const loadRubric = async () => {
    if (!job) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cv_job_scoring_rubrics')
        .select('*')
        .eq('job_id', job.id)
        .maybeSingle()

      if (data) {
        setRubricId(data.id)
        setCriteria(data.criteria || [])
        setPassingScore(data.passing_score ?? 70)
        setNotes(data.notes || '')
      } else {
        // No rubric yet — load defaults pre-populated from job requirements
        setRubricId(undefined)
        setCriteria(DEFAULT_CRITERIA.map(c => ({ ...c, id: genId() })))
        setPassingScore(70)
        setNotes('')
      }
    } catch (err) {
      console.error('loadRubric error:', err)
      setCriteria(DEFAULT_CRITERIA.map(c => ({ ...c, id: genId() })))
    } finally {
      setLoading(false)
    }
  }

  const totalWeight = criteria
    .filter(c => c.level !== 'nice_to_have')
    .reduce((s, c) => s + c.weight, 0)
  const bonusWeight = criteria
    .filter(c => c.level === 'nice_to_have')
    .reduce((s, c) => s + c.weight, 0)
  const weightOk = totalWeight === 100

  const updateCriterion = (id: string, patch: Partial<RubricCriterion>) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const deleteCriterion = (id: string) => {
    setCriteria(prev => prev.filter(c => c.id !== id))
    setExpandedIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const addCriterion = () => {
    const newC: RubricCriterion = {
      id: genId(),
      name: 'Tiêu chí mới',
      description: '',
      weight: 10,
      level: 'important',
      max_score: 10,
      scoring_guide: { excellent: '', good: '', average: '', poor: '' },
    }
    setCriteria(prev => [...prev, newC])
    setExpandedIds(prev => new Set([...prev, newC.id]))
  }

  const autoBalance = () => {
    if (!criteria.length) return
    const base = Math.floor(100 / criteria.length)
    const rem = 100 - base * criteria.length
    setCriteria(prev => prev.map((c, i) => ({ ...c, weight: base + (i === 0 ? rem : 0) })))
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const expandAll = () => setExpandedIds(new Set(criteria.map(c => c.id)))
  const collapseAll = () => setExpandedIds(new Set())

  const loadPreset = () => {
    const rubricLevels = getRubricLevels(jobCategories)
    const presetCriteria = rubricLevels.map(level => {
      const meta = getLevelMeta(level.value, jobCategories) as any
      return {
        id: genId(),
        name: `Tiêu chí ${level.label}`,
        description: meta.description || `Đánh giá theo mức ${level.label}`,
        weight: meta.default_weight || 10,
        level: level.value,
        max_score: meta.default_weight || 10,
        scoring_guide: {
          excellent: 'Xuất sắc',
          good: 'Tốt',
          average: 'Trung bình',
          poor: 'Yếu',
        },
      }
    })
    setCriteria(presetCriteria)
    setPassingScore(70)
  }

  const handleSave = async () => {
    if (!job) return
    if (!weightOk) { toast.warning('Tổng trọng số phải bằng 100%. Hiện tại: ' + totalWeight + '%'); return }
    if (!criteria.length) { toast.warning('Vui lòng thêm ít nhất 1 tiêu chí'); return }

    // Update max_score based on weight
    const finalCriteria = criteria.map(c => ({ ...c, max_score: c.weight }))

    setSaving(true)
    try {
      const payload = {
        job_id: job.id,
        criteria: finalCriteria,
        total_weight: totalWeight,
        passing_score: passingScore,
        notes,
        updated_at: new Date().toISOString(),
      }

      let error
      if (rubricId) {
        ;({ error } = await supabase.from('cv_job_scoring_rubrics').update(payload).eq('id', rubricId))
      } else {
        const { data, error: insertErr } = await supabase
          .from('cv_job_scoring_rubrics').insert([payload]).select('id').single()
        error = insertErr
        if (data) setRubricId(data.id)
      }

      if (error) throw error

      setSaveSuccess(true)
      setTimeout(() => { setSaveSuccess(false); onOpenChange(false) }, 1200)
    } catch (err: any) {
      toast.error('Lỗi khi lưu rubric: ' + (err.message || 'Không xác định'))
    } finally {
      setSaving(false)
    }
  }

  // Generate a rubric using job data + AI (optional enhancement)
  const generateFromJobAI = async () => {
    if (!job) return
    setSaving(true)
    try {
      const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API_URL}/api/generate-scoring-rubric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: job.title,
          department: job.department,
          level: job.level,
          job_type: job.job_type,
          description: job.description,
          requirements: job.requirements,
        }),
      })
      if (!res.ok) {
        let errMessage = `Backend error: ${res.status}`;
        try {
          const errData = await res.json();
          errMessage = `Backend error: ${errData.detail || res.status}`;
        } catch(e) {
          errMessage = `Backend error: ${res.status}`;
        }
        throw new Error(errMessage);
      }
      const data = await res.json()
      if (data.success && data.data?.criteria) {
        setCriteria(data.data.criteria.map((c: any) => ({ ...c, id: genId() })))
        if (data.data.passing_score) setPassingScore(data.data.passing_score)
        if (data.data.notes) setNotes(data.data.notes)
        toast.success('AI đã tạo bảng tiêu chí phù hợp với JD!')
      }
    } catch (err: any) {
      // Fallback to default if AI endpoint fails
      loadPreset()
      console.warn('AI rubric generation failed, using defaults:', err.message)
      toast.error(`Lỗi tạo tiêu chí bằng AI: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-4xl max-h-[93vh] overflow-hidden flex flex-col p-0">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <BarChart2 className="h-5 w-5 text-indigo-600" />
              Bảng tiêu chí chấm điểm
            </DialogTitle>
          </DialogHeader>
          {job && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="font-medium text-gray-900 text-sm">{job.title}</span>
              <Badge variant="outline" className="text-xs">{job.department}</Badge>
              <Badge variant="outline" className="text-xs">{job.level}</Badge>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1.5">
            Thiết lập các tiêu chí và trọng số — AI sẽ dựa vào đây để chấm điểm và xếp hạng ứng viên
          </p>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <>
              {/* ── Quick actions bar ────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={expandAll} className="text-xs text-indigo-600 hover:underline">Mở tất cả</button>
                  <span className="text-gray-300 text-xs">|</span>
                  <button onClick={collapseAll} className="text-xs text-gray-500 hover:underline">Thu gọn</button>
                  <span className="text-gray-300 text-xs">|</span>
                  <button onClick={autoBalance} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Sliders className="h-3 w-3" />Tự cân bằng trọng số
                  </button>
                  <span className="text-gray-300 text-xs">|</span>
                  <button onClick={loadPreset} className="text-xs text-gray-500 hover:underline">Tải mẫu mặc định</button>
                </div>
                <Button size="sm" variant="outline"
                  onClick={generateFromJobAI} disabled={saving}
                  className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  {saving ? 'Đang tạo...' : 'AI tạo tiêu chí từ JD'}
                </Button>
              </div>

              {/* ── Weight summary banner ─────────────────────────────────── */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                weightOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {weightOk
                  ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  : <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${weightOk ? 'text-green-800' : 'text-red-800'}`}>
                    Tổng trọng số: <strong>{totalWeight}%</strong>
                    {weightOk ? ' ✓ Hợp lệ' : ` — cần điều chỉnh thêm ${totalWeight > 100 ? `−${totalWeight - 100}` : `+${100 - totalWeight}`}%`}
                  </p>
                  {/* Mini stacked bar */}
                  <div className="flex h-2 rounded-full overflow-hidden mt-1.5 gap-px">
                    {criteria.filter(c => c.level !== 'nice_to_have').map(c => (
                      <div key={c.id} title={`${c.name}: ${c.weight}%`}
                        className={`h-full transition-all ${
                          c.level === 'required' ? 'bg-red-400' : 'bg-blue-400'
                        }`}
                        style={{ width: `${(c.weight / Math.max(totalWeight, 100)) * 100}%` }}
                      />
                    ))}
                    {totalWeight < 100 && (
                      <div className="h-full flex-1 bg-gray-200" />
                    )}
                    {bonusWeight > 0 && (
                      <div className="h-full bg-green-400 opacity-60" title={`Bonus: ${bonusWeight}%`}
                        style={{ width: `${(bonusWeight / 100) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-[10px] font-medium ${totalWeight === 100 ? 'text-green-700' : 'text-red-700'}`}>
                      Base: {totalWeight}% {totalWeight === 100 ? '✓' : '(chưa hợp lệ)'}
                    </span>
                    {criteria.filter(c => c.level === 'required').length > 0 && (
                      <span className="text-[10px] font-medium text-red-700">
                        Bắt buộc: {criteria.filter(c => c.level === 'required').reduce((s, c) => s + c.weight, 0)}%
                      </span>
                    )}
                    {criteria.filter(c => c.level === 'important').length > 0 && (
                      <span className="text-[10px] font-medium text-blue-700">
                        Quan trọng: {criteria.filter(c => c.level === 'important').reduce((s, c) => s + c.weight, 0)}%
                      </span>
                    )}
                    {bonusWeight > 0 && (
                      <span className="text-[10px] font-medium text-green-700 opacity-70">
                        Bonus: +{bonusWeight}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Criteria list ─────────────────────────────────────────── */}
              <div className="space-y-2.5">
                {criteria.map(c => (
                  <CriterionRow
                    key={c.id}
                    criterion={c}
                    totalWeight={totalWeight}
                    jobCategories={jobCategories}
                    onUpdate={updateCriterion}
                    onDelete={deleteCriterion}
                    isExpanded={expandedIds.has(c.id)}
                    onToggleExpand={toggleExpand}
                  />
                ))}
                {criteria.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    <BarChart2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Chưa có tiêu chí nào. Thêm tiêu chí hoặc tải mẫu.</p>
                  </div>
                )}
              </div>

              {/* ── Add criterion ─────────────────────────────────────────── */}
              <Button variant="outline" onClick={addCriterion}
                className="w-full border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50">
                <Plus className="h-4 w-4 mr-1.5" />Thêm tiêu chí
              </Button>

              {/* ── Global settings ────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Điểm đạt tối thiểu (0–100)
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={100} step={5} value={passingScore}
                      onChange={e => setPassingScore(Number(e.target.value))}
                      className="flex-1 accent-indigo-600" />
                    <span className="text-lg font-bold text-indigo-700 w-12 text-right">{passingScore}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Ứng viên đạt từ <strong>{passingScore} điểm</strong> trở lên được coi là đạt yêu cầu
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-blue-500" />
                    Ghi chú thêm cho AI
                  </label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Ví dụ: Ưu tiên ứng viên có kinh nghiệm startup, không yêu cầu bằng thạc sĩ..."
                    className="min-h-[72px] resize-none text-sm"
                  />
                </div>
              </div>

              {/* ── Legend ─────────────────────────────────────────────────── */}
              <div className="space-y-2.5 text-xs p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="font-medium text-amber-900">📋 Cách thức chấm điểm:</div>
                <div className="space-y-1.5 text-amber-800">
                  <div className="flex items-start gap-2">
                    <span className="inline-block w-3 h-3 bg-red-400 rounded-full flex-shrink-0 mt-1"></span>
                    <div><strong>Bắt buộc</strong>: Nếu thiếu → Loại ứng viên. Bao gồm trong tổng điểm base (0–100%)</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-block w-3 h-3 bg-blue-400 rounded-full flex-shrink-0 mt-1"></span>
                    <div><strong>Quan trọng</strong>: Thông thường, bao gồm trong tổng điểm base (0–100%)</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-block w-3 h-3 bg-green-400 rounded-full flex-shrink-0 mt-1"></span>
                    <div><strong>Cộng điểm</strong>: Không bắt buộc. Chỉ cộng thêm (bonus) nếu ứng viên có. <strong>Không tính vào base 100%</strong></div>
                  </div>
                </div>
                <div className="text-amber-700 mt-1 pt-1.5 border-t border-amber-200">
                  💡 Ứng viên đạt base 100% (tất cả bắt buộc + quan trọng) có thể đạt tối đa 100% + bonus điểm
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-gray-500">
            {criteria.length} tiêu chí · Điểm đạt: {passingScore}%
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !weightOk || loading}
              className={`min-w-[120px] ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
            >
              {saving ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Đang lưu...</>
              ) : saveSuccess ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Đã lưu!</>
              ) : (
                <><BarChart2 className="h-4 w-4 mr-2" />Lưu bảng điểm</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Đã đăng":
      return <Badge className="bg-blue-600 text-white hover:bg-blue-700 border-0">{status}</Badge>
    case "Bản nháp":
      return <Badge className="bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300">{status}</Badge>
    case "Đã đóng":
      return <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-200">{status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface Job {
  id: string; created_at: string; title: string; department: string
  status: string; level: string; job_type?: string; location?: string
  work_location?: string; description?: string; requirements?: string
  benefits?: string
  cv_candidates: { count: number }[]
}

interface CategoryItem { 
  value: string; 
  label: string;
  metadata?: {
    color?: string;
    priority?: number;
    description?: string;
    default_weight?: number;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI SERVICE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function generateJobDescriptionAI(data: {
  title: string; level: string; department: string
  work_location?: string; job_type?: string; language: string; keywords?: string
}) {
  const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
  const response = await fetch(`${API_URL}/api/generate-job-description`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error((e as any).detail || `Backend error: ${response.status}`)
  }
  const result = await response.json()
  if (result.success && result.data) return result.data
  throw new Error('Backend không trả về dữ liệu hợp lệ')
}

async function generateInterviewQuestionsAI(data: {
  job_id: string; job_title: string; department: string; level: string
  job_type?: string; work_location?: string; description?: string
  requirements?: string; language: string
}) {
  const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
  const response = await fetch(`${API_URL}/api/generate-interview-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error((e as any).detail || `Backend error: ${response.status}`)
  }
  const result = await response.json()
  if (result.success && result.data) return result.data
  throw new Error('Backend không trả về dữ liệu hợp lệ')
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function JobsPage() {
  const { t } = useTranslation()

  // ── State ──────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<Job[]>([])
  const [totalCandidatesCount, setTotalCandidatesCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [jobCategories, setJobCategories] = useState<Record<string, CategoryItem[]>>({})
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAIQuestionsDialogOpen, setIsAIQuestionsDialogOpen] = useState(false)
  const [isCandidatesDialogOpen, setIsCandidatesDialogOpen] = useState(false)
  // ── NEW: Scoring Rubric dialog
  const [isRubricDialogOpen, setIsRubricDialogOpen] = useState(false)
  const [rubricJob, setRubricJob] = useState<Job | null>(null)
  // Track which jobs have a rubric set (for badge indicator)
  const [jobsWithRubric, setJobsWithRubric] = useState<Set<string>>(new Set())

  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('manual')
  const [formData, setFormData] = useState({
    title: '', department: '', location: '', work_location: '',
    level: 'Mid-level', job_type: 'Full-time', status: 'Bản nháp',
    description: '', requirements: '', benefits: '',
    posted_date: new Date().toISOString().split('T')[0]
  })
  const [editFormData, setEditFormData] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiLanguage, setAiLanguage] = useState('vietnamese')

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [jobCandidates, setJobCandidates] = useState<any[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  const [aiQuestions, setAiQuestions] = useState('')
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [aiQuestionLanguage, setAiQuestionLanguage] = useState<'vietnamese' | 'english'>('vietnamese')

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchJobs()
    fetchJobCategories()
  }, [])

  // ── Data fetching ──────────────────────────────────────────────────────────
  async function fetchJobCategories() {
    const { data, error } = await supabase
      .from('cv_job_categories').select('*').order('sort_order', { ascending: true })
    if (error) { console.error(error); return }
    if (data) {
      const grouped: Record<string, CategoryItem[]> = {}
      data.forEach((item: any) => {
        if (item.type === 'rubric_level') return
        if (!grouped[item.type]) grouped[item.type] = []
        grouped[item.type].push({ value: item.value, label: item.label })
      })
      setJobCategories(grouped)
    }
  }

  async function fetchJobs() {
    setLoading(true)
    const { data: jobsData, error: jobsError } = await supabase
      .from('cv_jobs').select('*, cv_candidates(count)').order('created_at', { ascending: false })
    if (jobsData) setJobs(jobsData as Job[])
    if (jobsError) console.error(jobsError)

    const { count } = await supabase.from('cv_candidates').select('*', { count: 'exact', head: true })
    if (count !== null) setTotalCandidatesCount(count)

    // ── NEW: fetch which jobs have a rubric ─────────────────────────────────
    const { data: rubricData } = await supabase
      .from('cv_job_scoring_rubrics').select('job_id')
    if (rubricData) setJobsWithRubric(new Set(rubricData.map((r: any) => r.job_id)))

    setLoading(false)
  }

  async function fetchJobCandidates(jobId: string) {
    setLoadingCandidates(true)
    try {
      const { data, error } = await supabase
        .from('cv_candidates')
        .select(`id, full_name, email, phone_number, status, created_at,
          address, experience, education, university, cv_url, cv_file_name,
          cv_candidate_skills(cv_skills(id,name,category))`)
        .eq('job_id', jobId).order('created_at', { ascending: false })
      if (data) setJobCandidates(data)
      if (error) toast.error('Không thể tải danh sách ứng viên')
    } catch { toast.error('Có lỗi xảy ra khi tải danh sách ứng viên') }
    finally { setLoadingCandidates(false) }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCategoryItems = (type: string, fallback: CategoryItem[]): CategoryItem[] =>
    jobCategories[type]?.length ? jobCategories[type] : fallback

  const FALLBACK: Record<string, CategoryItem[]> = {
    title: [
      { value: 'Software Engineer', label: 'Software Engineer' },
      { value: 'Frontend Developer', label: 'Frontend Developer' },
      { value: 'Backend Developer', label: 'Backend Developer' },
      { value: 'UI/UX Designer', label: 'UI/UX Designer' },
      { value: 'Product Manager', label: 'Product Manager' },
    ],
    department: [
      { value: 'Engineering', label: 'Engineering' },
      { value: 'Design', label: 'Design' },
      { value: 'Product', label: 'Product' },
      { value: 'Marketing', label: 'Marketing' },
      { value: 'Sales', label: 'Sales' },
    ],
    level: [
      { value: 'Intern', label: 'Intern' },
      { value: 'Junior', label: 'Junior' },
      { value: 'Mid-level', label: 'Mid-level' },
      { value: 'Senior', label: 'Senior' },
      { value: 'Lead', label: 'Lead' },
    ],
    work_location: [
      { value: 'Remote', label: 'Remote' },
      { value: 'Ho Chi Minh City', label: 'Ho Chi Minh City' },
      { value: 'Ha Noi', label: 'Hà Nội' },
      { value: 'Da Nang', label: 'Đà Nẵng' },
    ],
    job_type: [
      { value: 'Full-time', label: 'Full-time' },
      { value: 'Part-time', label: 'Part-time' },
      { value: 'Contract', label: 'Contract' },
      { value: 'Internship', label: 'Internship' },
    ],
    status: [
      { value: 'Bản nháp', label: 'Bản nháp' },
      { value: 'Đã đăng', label: 'Đã đăng' },
      { value: 'Đã đóng', label: 'Đã đóng' },
    ],
    rubric_level: [
      { 
        value: 'required', 
        label: 'Bắt buộc',
        metadata: { color: '#ef4444', priority: 3, description: 'Tiêu chí bắt buộc phải đáp ứng', default_weight: 35 }
      },
      { 
        value: 'important', 
        label: 'Quan trọng',
        metadata: { color: '#3b82f6', priority: 2, description: 'Tiêu chí quan trọng, ảnh hưởng lớn đến quyết định', default_weight: 20 }
      },
      { 
        value: 'nice_to_have', 
        label: 'Cộng điểm',
        metadata: { color: '#10b981', priority: 1, description: 'Tiêu chí cộng điểm, không bắt buộc', default_weight: 8 }
      },
    ],
  }

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleInputChange = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }))

  const handleEditInputChange = (field: string, value: string) =>
    setEditFormData((prev: any) => ({ ...prev, [field]: value }))

  const handleReset = () => {
    setFormData({
      title: '', department: '', location: '', work_location: '',
      level: 'Mid-level', job_type: 'Full-time', status: 'Bản nháp',
      description: '', requirements: '', benefits: '',
      posted_date: new Date().toISOString().split('T')[0]
    })
  }

  // ── AI handlers ────────────────────────────────────────────────────────────
  const handleAIGenerate = async () => {
    if (!formData.title || !formData.department) { toast.warning('Vui lòng điền đầy đủ: Tiêu đề vị trí và Phòng ban'); return }
    setGeneratingAI(true)
    try {
      const generated = await generateJobDescriptionAI({
        title: formData.title, level: formData.level, department: formData.department,
        work_location: formData.work_location || 'Remote',
        job_type: formData.job_type || 'Full-time',
        language: aiLanguage, keywords: formData.requirements
      })
      setFormData(prev => ({
        ...prev, description: generated.description, requirements: generated.requirements,
        benefits: generated.benefits
      }))
      setActiveTab('manual')
      toast.success('Đã tạo gợi ý JD với AI thành công!')
    } catch (e: any) { toast.error(`Lỗi khi tạo JD với AI: ${e.message}`) }
    finally { setGeneratingAI(false) }
  }

  const handleGenerateAIQuestions = async (job: Job) => {
    setSelectedJob(job); setIsAIQuestionsDialogOpen(true); setGeneratingQuestions(true); setAiQuestions('')
    try {
      const result = await generateInterviewQuestionsAI({
        job_id: job.id, job_title: job.title, department: job.department,
        level: job.level, job_type: job.job_type || 'Full-time',
        work_location: job.work_location || job.location || 'Remote',
        description: job.description || undefined,
        requirements: job.requirements || undefined,
        language: aiQuestionLanguage
      })
      setAiQuestions(result.questions)
    } catch (e: any) {
      setAiQuestions(`# ❌ Lỗi tạo câu hỏi\n\nKhông thể tạo câu hỏi: ${e.message}`)
    } finally { setGeneratingQuestions(false) }
  }

  const handleCopyAIQuestions = () => {
    if (!aiQuestions) { toast.warning('Không có câu hỏi để sao chép'); return }
    navigator.clipboard.writeText(aiQuestions)
      .then(() => toast.success('Đã sao chép câu hỏi vào clipboard!'))
      .catch(() => toast.error('Không thể sao chép. Vui lòng thử lại.'))
  }

  // ── NEW: Open Scoring Rubric ────────────────────────────────────────────────
  const handleOpenRubric = (job: Job) => {
    setRubricJob(job)
    setIsRubricDialogOpen(true)
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formData.title || !formData.department) {
      toast.warning('Vui lòng điền đầy đủ thông tin bắt buộc: Tiêu đề vị trí và Phòng ban'); return
    }
    if (activeTab === 'manual' && (!formData.description || !formData.requirements || !formData.benefits)) {
      toast.warning('Vui lòng điền đầy đủ: Mô tả công việc, Yêu cầu công việc và Quyền lợi'); return
    }
    setIsSubmitting(true)
    const { error } = await supabase.from('cv_jobs').insert([{
      title: formData.title, department: formData.department,
      location: formData.location || null, work_location: formData.work_location || null,
      level: formData.level, job_type: formData.job_type, status: formData.status,
      description: formData.description || null, requirements: formData.requirements || null,
      benefits: formData.benefits || null,
      posted_date: formData.posted_date
    }]).select()
    if (error) { toast.error(`Có lỗi xảy ra khi tạo JD: ${error.message}`) }
    else { toast.success('Tạo JD thành công!'); setIsDialogOpen(false); handleReset(); fetchJobs() }
    setIsSubmitting(false)
  }

  const handleViewDetails = (job: Job) => { setSelectedJob(job); setIsViewDialogOpen(true) }

  const handleViewCandidates = async (job: Job) => {
    setSelectedJob(job); setIsCandidatesDialogOpen(true); await fetchJobCandidates(job.id)
  }

  const handleEdit = (job: Job) => {
    setSelectedJob(job)
    setEditFormData({
      id: job.id, title: job.title, department: job.department,
      location: job.location || '', work_location: job.work_location || '',
      level: job.level, job_type: job.job_type || 'Full-time', status: job.status,
      description: job.description || '', requirements: job.requirements || '',
      benefits: job.benefits || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateJob = async () => {
    if (!editFormData.title || !editFormData.department) { toast.warning('Vui lòng điền đầy đủ thông tin bắt buộc'); return }
    setIsSubmitting(true)
    const { error } = await supabase.from('cv_jobs').update({
      title: editFormData.title, department: editFormData.department,
      location: editFormData.location || null, work_location: editFormData.work_location || null,
      level: editFormData.level, job_type: editFormData.job_type, status: editFormData.status,
      description: editFormData.description || null, requirements: editFormData.requirements || null,
      benefits: editFormData.benefits || null
    }).eq('id', editFormData.id)
    if (error) { toast.error(`Lỗi: ${error.message}`) }
    else { toast.success('Đã cập nhật Job Description thành công!'); setIsEditDialogOpen(false); setEditFormData(null); fetchJobs() }
    setIsSubmitting(false)
  }

  const handleCopy = async (job: Job) => {
    const { error } = await supabase.from('cv_jobs').insert([{
      title: `${job.title} (Copy)`, department: job.department,
      location: job.location || null, work_location: job.work_location || null,
      level: job.level, job_type: job.job_type || 'Full-time', status: 'Bản nháp',
      description: job.description || null, requirements: job.requirements || null,
      benefits: job.benefits || null,
      posted_date: new Date().toISOString().split('T')[0]
    }])
    if (error) toast.error(`Lỗi khi sao chép: ${error.message}`)
    else { toast.success('Đã sao chép Job Description thành công!'); fetchJobs() }
  }

  const handleShare = (job: Job) => {
    navigator.clipboard.writeText(`${window.location.origin}/jobs/${job.id}`)
    toast.success('Đã sao chép link chia sẻ vào clipboard!')
  }

  const handleDelete = (job: Job) => { setSelectedJob(job); setIsDeleteDialogOpen(true) }

  const confirmDelete = async () => {
    if (!selectedJob) return
    setIsDeleting(true)
    
    try {
      // 1. Lấy danh sách ID của các lịch phỏng vấn liên quan
      const { data: ivs } = await supabase.from('cv_interviews').select('id').eq('job_id', selectedJob.id)
      if (ivs && ivs.length > 0) {
        const ivIds = ivs.map(i => i.id)
        // 2. Xóa các đánh giá (reviews) của những lịch phỏng vấn này trước
        await supabase.from('cv_interview_reviews').delete().in('interview_id', ivIds)
      }
      
      // 3. Xóa các lịch phỏng vấn liên quan
      await supabase.from('cv_interviews').delete().eq('job_id', selectedJob.id)
      
      // 4. Xóa bảng tiêu chí chấm điểm (rubrics) liên quan nếu có
      await supabase.from('cv_job_scoring_rubrics').delete().eq('job_id', selectedJob.id)
      
      // 5. Cuối cùng mới xóa Job
      const { error } = await supabase.from('cv_jobs').delete().eq('id', selectedJob.id)
      
      if (error) {
        toast.error(`Lỗi khi xóa: ${error.message}`)
      } else {
        toast.success('Đã xóa Job Description thành công!')
        setIsDeleteDialogOpen(false)
        setSelectedJob(null)
        fetchJobs()
      }
    } catch (err: any) {
      toast.error(`Lỗi hệ thống khi xóa: ${err.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredJobs = jobs.filter(job => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      job.title.toLowerCase().includes(q) || job.department.toLowerCase().includes(q) ||
      (job.level || '').toLowerCase().includes(q) || (job.job_type || '').toLowerCase().includes(q) ||
      (job.work_location || '').toLowerCase().includes(q) || (job.location || '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesDepartment = departmentFilter === 'all' || job.department === departmentFilter
    return matchesSearch && matchesStatus && matchesDepartment
  })

  const totalJobs = jobs.length
  const openJobs = jobs.filter(j => j.status === 'Đã đăng' || j.status === 'Published').length

  const renderSelectItems = (type: string) =>
    getCategoryItems(type, FALLBACK[type] || []).map(item => (
      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
    ))

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/50 p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Mô tả công việc</h1>
          <p className="text-xs sm:text-sm text-gray-500">Quản lý và tạo mô tả công việc</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline"
            className="hidden sm:flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={() => setIsCategoryManagerOpen(true)}>
            <Tag className="w-4 h-4" />Danh mục
          </Button>
          <Button variant="outline" size="icon"
            className="sm:hidden border-blue-200 text-blue-600"
            onClick={() => setIsCategoryManagerOpen(true)}>
            <Tag className="w-4 h-4" />
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />{t('jobs.createNew')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
        <Card className="border-blue-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Tổng JDs</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-gray-900">{totalJobs}</div></CardContent>
        </Card>
        <Card className="border-green-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">JDs đang mở</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-gray-900">{openJobs}</div></CardContent>
        </Card>
        <Card className="border-purple-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Tổng ứng viên</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-gray-900">{totalCandidatesCount}</div></CardContent>
        </Card>
        {/* ── NEW stat: jobs with rubric ─────────────────────────────────── */}
        <Card className="border-indigo-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Có bảng điểm</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <BarChart2 className="h-5 w-5 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{jobsWithRubric.size}</div>
            <p className="text-xs text-gray-400 mt-0.5">JD đã cài tiêu chí AI</p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900">Danh sách JD ({filteredJobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Tìm kiếm theo tiêu đề, phòng ban, vị trí..." className="pl-10 border-gray-300 text-sm"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] sm:w-[160px] border-gray-300 text-sm"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
                <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                  <SelectItem value="all">Tất cả</SelectItem>
                  {renderSelectItems('status')}
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[140px] sm:w-[160px] border-gray-300 text-sm"><SelectValue placeholder="Phòng ban" /></SelectTrigger>
                <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                  <SelectItem value="all">Tất cả phòng ban</SelectItem>
                  {renderSelectItems('department')}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block border rounded-lg border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-gray-700 font-medium">Vị trí</TableHead>
                  <TableHead className="text-gray-700 font-medium">Phòng ban</TableHead>
                  <TableHead className="text-gray-700 font-medium">Địa điểm</TableHead>
                  <TableHead className="text-gray-700 font-medium">Trạng thái</TableHead>
                  <TableHead className="text-gray-700 font-medium">Bảng điểm</TableHead>
                  <TableHead className="text-gray-700 font-medium">Ứng viên</TableHead>
                  <TableHead className="text-gray-700 font-medium">Ngày tạo</TableHead>
                  <TableHead className="text-right text-gray-700 font-medium">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center h-24 text-gray-500">Đang tải dữ liệu...</TableCell></TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center h-24 text-gray-500">Chưa có JD nào. Hãy tạo JD đầu tiên!</TableCell></TableRow>
                ) : (
                  filteredJobs.map(job => (
                    <TableRow key={job.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium text-gray-900">{job.title}</div>
                        <div className="text-sm text-gray-500">{job.level} • {job.job_type || 'Full-time'}</div>
                      </TableCell>
                      <TableCell className="text-gray-700">{job.department}</TableCell>
                      <TableCell className="text-gray-700">{job.work_location || job.location || '-'}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      {/* ── NEW: Rubric badge ───────────────────────────────── */}
                      <TableCell>
                        {jobsWithRubric.has(job.id) ? (
                          <button onClick={() => handleOpenRubric(job)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
                            <BarChart2 className="h-3.5 w-3.5" />Đã cài
                          </button>
                        ) : (
                          <button onClick={() => handleOpenRubric(job)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <Plus className="h-3.5 w-3.5" />Thiết lập
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-700">{job.cv_candidates[0]?.count || 0}</TableCell>
                      <TableCell className="text-gray-700">{new Date(job.created_at).toLocaleDateString('vi-VN')}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                              <MoreHorizontal className="h-4 w-4 text-gray-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="top" className="w-52 bg-white z-50 shadow-lg border border-gray-200">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleViewDetails(job)}>
                              <Eye className="mr-2 h-4 w-4 text-gray-600" /><span>Xem chi tiết</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleViewCandidates(job)}>
                              <Users className="mr-2 h-4 w-4 text-blue-600" />
                              <span>Xem ứng viên ({job.cv_candidates[0]?.count || 0})</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleEdit(job)}>
                              <Edit className="mr-2 h-4 w-4 text-gray-600" /><span>Chỉnh sửa</span>
                            </DropdownMenuItem>
                            {/* ── NEW: Rubric menu item ───────────────────── */}
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleOpenRubric(job)}>
                              <BarChart2 className="mr-2 h-4 w-4 text-indigo-600" />
                              <span>
                                {jobsWithRubric.has(job.id) ? 'Sửa bảng tiêu chí' : 'Thiết lập bảng tiêu chí'}
                              </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleGenerateAIQuestions(job)}>
                              <Sparkles className="mr-2 h-4 w-4 text-purple-600" /><span>Tạo câu hỏi AI</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleCopy(job)}>
                              <Copy className="mr-2 h-4 w-4 text-gray-600" /><span>Sao chép</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleShare(job)}>
                              <Share2 className="mr-2 h-4 w-4 text-gray-600" /><span>Chia sẻ</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer" onClick={() => handleDelete(job)}>
                              <Trash2 className="mr-2 h-4 w-4" /><span>Xóa</span>
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

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">Đang tải dữ liệu...</div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Chưa có JD nào. Hãy tạo JD đầu tiên!</div>
            ) : (
              filteredJobs.map(job => (
                <div key={job.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base truncate">{job.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{job.level} • {job.job_type || 'Full-time'}</p>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex gap-2"><span className="text-gray-500">Phòng ban:</span><span>{job.department}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500">Địa điểm:</span><span>{job.work_location || job.location || '-'}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500">Ứng viên:</span><span className="font-medium">{job.cv_candidates[0]?.count || 0}</span></div>
                    {/* ── NEW: rubric badge in mobile card ─────────────── */}
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-500">Bảng điểm:</span>
                      {jobsWithRubric.has(job.id)
                        ? <span className="text-xs font-medium text-indigo-600 flex items-center gap-1"><BarChart2 className="h-3.5 w-3.5" />Đã cài</span>
                        : <span className="text-xs text-gray-400">Chưa thiết lập</span>}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(job)}>
                      <Eye className="h-4 w-4 mr-1" />Xem
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleViewCandidates(job)} className="text-blue-700 border-blue-200">
                      <Users className="h-4 w-4 mr-1" />Ứng viên
                    </Button>
                    {/* ── NEW: mobile rubric button ────────────────────── */}
                    <Button variant="outline" size="sm" onClick={() => handleOpenRubric(job)} className="text-indigo-700 border-indigo-200">
                      <BarChart2 className="h-4 w-4 mr-1" />Tiêu chí
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-white z-50 shadow-lg border border-gray-200">
                        <DropdownMenuItem onClick={() => handleEdit(job)}><Edit className="mr-2 h-4 w-4" />Chỉnh sửa</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopy(job)}><Copy className="mr-2 h-4 w-4" />Sao chép</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleGenerateAIQuestions(job)}><Sparkles className="mr-2 h-4 w-4 text-purple-600" />Tạo câu hỏi AI</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(job)}><Trash2 className="mr-2 h-4 w-4" />Xóa</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ══ DIALOG TẠO JD MỚI ══════════════════════════════════════════════════ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold">Tạo mô tả công việc mới</DialogTitle>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Sử dụng AI để tạo JD hoặc tạo thủ công</p>
          </DialogHeader>

          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveTab('ai')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'ai' ? 'bg-blue-50 text-blue-600 border-2 border-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Sparkles className="w-4 h-4" />AI Generate
            </button>
            <button onClick={() => setActiveTab('manual')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'manual' ? 'bg-blue-50 text-blue-600 border-2 border-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <PenTool className="w-4 h-4" />Manual
            </button>
          </div>

          <div className="space-y-4 mt-4">
            {activeTab === 'ai' ? (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Tạo JD tự động với AI</p>
                      <p className="text-xs text-blue-700 mt-1">AI sẽ giúp bạn tạo mô tả công việc chuyên nghiệp dựa trên các thông tin cơ bản</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Tiêu đề vị trí <span className="text-red-500">*</span></label>
                    <Select value={formData.title} onValueChange={v => handleInputChange('title', v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Chọn vị trí" /></SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">{renderSelectItems('title')}</SelectContent>
                    </Select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Phòng ban <span className="text-red-500">*</span></label>
                    <Select value={formData.department} onValueChange={v => handleInputChange('department', v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">{renderSelectItems('department')}</SelectContent>
                    </Select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Cấp độ</label>
                    <Select value={formData.level} onValueChange={v => handleInputChange('level', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">{renderSelectItems('level')}</SelectContent>
                    </Select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Ngôn ngữ JD</label>
                    <Select value={aiLanguage} onValueChange={setAiLanguage}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                        <SelectItem value="vietnamese">Tiếng Việt</SelectItem>
                        <SelectItem value="english">English</SelectItem>
                      </SelectContent>
                    </Select></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Kỹ năng cần thiết (tùy chọn)</label>
                  <Textarea placeholder="Ví dụ: React, Node.js, TypeScript, Git..." className="min-h-[80px] resize-none" value={formData.requirements} onChange={e => handleInputChange('requirements', e.target.value)} /></div>
                <div className="flex gap-3 pt-4 border-t">
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAIGenerate} disabled={generatingAI}>
                    {generatingAI ? <><div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang tạo với AI...</> : <><Sparkles className="w-4 h-4 mr-2" />Tạo gợi ý với AI</>}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { field: 'title', label: 'Tiêu đề vị trí', type: 'title', req: true },
                    { field: 'department', label: 'Phòng ban', type: 'department', req: true },
                    { field: 'work_location', label: 'Địa điểm', type: 'work_location' },
                    { field: 'job_type', label: 'Loại hình', type: 'job_type' },
                    { field: 'level', label: 'Cấp độ', type: 'level' },
                    { field: 'status', label: 'Trạng thái', type: 'status' },
                  ].map(({ field, label, type, req }) => (
                    <div key={field}><label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{req && <span className="text-red-500"> *</span>}</label>
                      <Select value={(formData as any)[field]} onValueChange={v => handleInputChange(field, v)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder={`Chọn ${label.toLowerCase()}`} /></SelectTrigger>
                        <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">{renderSelectItems(type)}</SelectContent>
                      </Select></div>
                  ))}
                </div>
                {[
                  { field: 'description', label: 'Mô tả công việc', req: true },
                  { field: 'requirements', label: 'Yêu cầu công việc', req: true },
                  { field: 'benefits', label: 'Quyền lợi', req: true },
                ].map(({ field, label, req }) => (
                  <div key={field}><label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{req && <span className="text-red-500"> *</span>}</label>
                    <Textarea placeholder={`Nhập ${label.toLowerCase()}...`} className="min-h-[100px] resize-none"
                      value={(formData as any)[field]} onChange={e => handleInputChange(field, e.target.value)} /></div>
                ))}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
                  <Button variant="outline" className="w-full sm:w-auto px-6" onClick={handleReset}><X className="w-4 h-4 mr-2" />Reset</Button>
                  <Button variant="outline" className="w-full sm:w-auto px-6" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
                  <Button className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmit} disabled={isSubmitting}>
                    <Plus className="w-4 h-4 mr-2" />{isSubmitting ? 'Đang tạo...' : 'Tạo JD'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG XEM CHI TIẾT ════════════════════════════════════════════════ */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold">{selectedJob?.title}</DialogTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedJob && getStatusBadge(selectedJob.status)}
              <Badge variant="outline">{selectedJob?.department}</Badge>
              <Badge variant="outline">{selectedJob?.level}</Badge>
              {selectedJob && jobsWithRubric.has(selectedJob.id) && (
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 gap-1">
                  <BarChart2 className="h-3 w-3" />Có bảng tiêu chí AI
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div><p className="text-sm text-gray-600">Loại hình</p><p className="font-medium">{selectedJob?.job_type || 'N/A'}</p></div>
              <div><p className="text-sm text-gray-600">Địa điểm</p><p className="font-medium">{selectedJob?.work_location || 'N/A'}</p></div>
              <div><p className="text-sm text-gray-600">Ngày tạo</p><p className="font-medium">{selectedJob && new Date(selectedJob.created_at).toLocaleDateString('vi-VN')}</p></div>
              <div><p className="text-sm text-gray-600">Ứng viên</p><p className="font-medium">{selectedJob?.cv_candidates[0]?.count || 0}</p></div>
            </div>
            {selectedJob?.description && <div><h3 className="font-semibold mb-2">Mô tả công việc</h3><div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{selectedJob.description}</div></div>}
            {selectedJob?.requirements && <div><h3 className="font-semibold mb-2">Yêu cầu công việc</h3><div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{selectedJob.requirements}</div></div>}
            {selectedJob?.benefits && <div><h3 className="font-semibold mb-2">Quyền lợi</h3><div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{selectedJob.benefits}</div></div>}
            {/* ── NEW: quick rubric link in view dialog ────────────────────── */}
            {selectedJob && (
              <div className={`flex items-center justify-between p-3 rounded-xl border ${jobsWithRubric.has(selectedJob.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <BarChart2 className={`h-4 w-4 ${jobsWithRubric.has(selectedJob.id) ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${jobsWithRubric.has(selectedJob.id) ? 'text-indigo-900' : 'text-gray-600'}`}>
                      {jobsWithRubric.has(selectedJob.id) ? 'Bảng tiêu chí AI đã được thiết lập' : 'Chưa có bảng tiêu chí AI'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">AI sẽ dùng tiêu chí này để chấm điểm ứng viên</p>
                  </div>
                </div>
                <Button size="sm" variant="outline"
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => { setIsViewDialogOpen(false); handleOpenRubric(selectedJob) }}>
                  <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                  {jobsWithRubric.has(selectedJob.id) ? 'Xem/Sửa' : 'Thiết lập'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG DANH SÁCH ỨNG VIÊN ═════════════════════════════════════════ */}
      <Dialog open={isCandidatesDialogOpen} onOpenChange={setIsCandidatesDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />Danh sách ứng viên
                </DialogTitle>
                {selectedJob && <p className="text-xs sm:text-sm text-gray-600 mt-1">{selectedJob.title} • {selectedJob.department} • {selectedJob.level}</p>}
              </div>
              <Badge className="bg-blue-100 text-blue-700 text-base px-3 py-1">{jobCandidates.length} ứng viên</Badge>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {loadingCandidates ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-gray-600 mt-6 font-medium">Đang tải danh sách ứng viên...</p>
              </div>
            ) : jobCandidates.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có ứng viên nào</h3>
              </div>
            ) : (
              <div className="space-y-3">
                {jobCandidates.map(candidate => (
                  <div key={candidate.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 border-2 border-blue-200 shrink-0">
                        <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                          {candidate.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 truncate">{candidate.full_name}</h3>
                          <Badge className={candidate.status === 'Chấp nhận' ? 'bg-green-100 text-green-700' : candidate.status === 'Từ chối' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                            {candidate.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{candidate.email}</p>
                        {candidate.cv_candidate_skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {candidate.cv_candidate_skills.slice(0, 4).map((item: any, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">{item.cv_skills.name}</Badge>
                            ))}
                            {candidate.cv_candidate_skills.length > 4 && (
                              <Badge variant="secondary" className="text-xs">+{candidate.cv_candidate_skills.length - 4}</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {candidate.cv_url && (
                        <Button variant="outline" size="sm" onClick={() => window.open(candidate.cv_url, '_blank')}>
                          <FileText className="w-4 h-4 mr-1" />CV
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-sm text-gray-600">Tổng cộng: <span className="font-semibold">{jobCandidates.length}</span> ứng viên</span>
              <Button variant="outline" onClick={() => { setIsCandidatesDialogOpen(false); setJobCandidates([]) }}>Đóng</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG CHỈNH SỬA ══════════════════════════════════════════════════ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold">Chỉnh sửa Job Description</DialogTitle>
          </DialogHeader>
          {editFormData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { field: 'title', label: 'Tiêu đề vị trí', type: 'title', req: true },
                  { field: 'department', label: 'Phòng ban', type: 'department', req: true },
                  { field: 'work_location', label: 'Địa điểm', type: 'work_location' },
                  { field: 'job_type', label: 'Loại hình', type: 'job_type' },
                  { field: 'level', label: 'Cấp độ', type: 'level' },
                  { field: 'status', label: 'Trạng thái', type: 'status' },
                ].map(({ field, label, type, req }) => (
                  <div key={field}><label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{req && <span className="text-red-500"> *</span>}</label>
                    <Select value={editFormData[field] || ''} onValueChange={v => handleEditInputChange(field, v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">{renderSelectItems(type)}</SelectContent>
                    </Select></div>
                ))}
              </div>
              {['description', 'requirements', 'benefits'].map(field => (
                <div key={field}><label className="block text-sm font-medium text-gray-700 mb-1.5 capitalize">{
                  field === 'description' ? 'Mô tả công việc' : field === 'requirements' ? 'Yêu cầu công việc' : 'Quyền lợi'
                }</label>
                  <Textarea className="min-h-[100px] resize-none" value={editFormData[field] || ''}
                    onChange={e => handleEditInputChange(field, e.target.value)} /></div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
                <Button variant="outline" className="w-full sm:w-auto px-6" onClick={() => setIsEditDialogOpen(false)}>Hủy</Button>
                <Button className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleUpdateJob} disabled={isSubmitting}>
                  <Edit className="w-4 h-4 mr-2" />{isSubmitting ? 'Đang cập nhật...' : 'Cập nhật'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG AI QUESTIONS ════════════════════════════════════════════════ */}
      <Dialog open={isAIQuestionsDialogOpen} onOpenChange={setIsAIQuestionsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />Câu hỏi phỏng vấn AI
                </DialogTitle>
                {selectedJob && <p className="text-sm text-gray-600 mt-1 truncate">{selectedJob.title} • {selectedJob.department} • {selectedJob.level}</p>}
              </div>
              {!generatingQuestions && !aiQuestions && (
                <Select value={aiQuestionLanguage} onValueChange={v => setAiQuestionLanguage(v as 'vietnamese' | 'english')}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="vietnamese">Tiếng Việt</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {generatingQuestions ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                <p className="text-gray-600 mt-6 font-medium">Đang tạo câu hỏi với AI...</p>
                <div className="flex gap-2 mt-4">
                  {[0, 150, 300].map(delay => (
                    <div key={delay} className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            ) : aiQuestions ? (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-purple-900">Câu hỏi được tạo tự động bởi AI. Vui lòng xem xét và điều chỉnh cho phù hợp.</p>
                  </div>
                </div>
                <div className="border rounded-lg bg-white overflow-hidden">
                  <div className="p-6 max-h-[500px] overflow-y-auto">
                    <div className="prose prose-sm max-w-none">
                      {aiQuestions.split('\n').map((line, index) => {
                        if (line.startsWith('# ')) return <h1 key={index} className="text-2xl font-bold mt-6 mb-4 text-gray-900 first:mt-0">{line.replace('# ', '')}</h1>
                        if (line.startsWith('## ')) return <h2 key={index} className="text-lg font-bold mt-6 mb-3 text-gray-900">{line.replace('## ', '')}</h2>
                        if (line.startsWith('### ')) return <h3 key={index} className="text-base font-semibold mt-4 mb-2 text-gray-800">{line.replace('### ', '')}</h3>
                        if (line.trim().startsWith('- ')) return <li key={index} className="ml-6 mb-2 text-gray-700">{line.trim().replace('- ', '')}</li>
                        if (/^\d+\.\s/.test(line.trim())) return <li key={index} className="ml-6 mb-2 text-gray-700 list-decimal">{line.trim().replace(/^\d+\.\s/, '')}</li>
                        if (line.trim() === '') return <div key={index} className="h-2" />
                        return <p key={index} className="mb-2 text-gray-700">{line}</p>
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <Button variant="outline" className="flex-1" onClick={handleCopyAIQuestions}><Copy className="w-4 h-4 mr-2" />Sao chép câu hỏi</Button>
                  <Button variant="outline" onClick={() => { setAiQuestions(''); if (selectedJob) handleGenerateAIQuestions(selectedJob) }}><Sparkles className="w-4 h-4 mr-2" />Tạo lại</Button>
                  <Button variant="outline" onClick={() => { setIsAIQuestionsDialogOpen(false); setAiQuestions('') }}>Đóng</Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">Không có câu hỏi nào được tạo</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG XÁC NHẬN XÓA ══════════════════════════════════════════════ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa Job Description</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa JD <strong>{selectedJob?.title}</strong> không? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="w-full sm:w-auto bg-red-600 hover:bg-red-700">
              {isDeleting ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══ NEW: SCORING RUBRIC DIALOG ════════════════════════════════════════ */}
      <ScoringRubricDialog
        open={isRubricDialogOpen}
        onOpenChange={(v) => {
          setIsRubricDialogOpen(v)
          if (!v) fetchJobs()   // refresh rubric badges after close
        }}
        job={rubricJob}
        jobCategories={jobCategories}
      />

      {/* ══ CATEGORY MANAGER ══════════════════════════════════════════════════ */}
      <CategoryManagerDialog
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        onCategoriesUpdated={fetchJobCategories}
      />
    </div>
  )
}

export default JobsPage