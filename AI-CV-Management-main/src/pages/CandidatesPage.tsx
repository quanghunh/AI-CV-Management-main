"use client"
import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import {
  Search, Plus, Eye, Edit, Trash2, Users, UserCheck, TrendingUp,
  Filter, Download, FileText, Brain, X, AlertTriangle, CheckCircle2,
  Info, MoreHorizontal, Tag, Upload, AlertCircle, ChevronDown,
  CheckCircle, XCircle, Loader2, Table2, RefreshCw, History
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { saveCandidateSkills } from "@/utils/skillsHelper"
import { SkillsInput } from "@/components/ui/skills-input"
import { Input } from "@/components/ui/input"
import { ActivityLogger } from '@/lib/activityLogger'
import { CandidateCategoryDialog } from "@/components/candidates/CandidateCategoryDialog"

// ── Extend HTMLInputElement to support webkitdirectory (folder picker) ────────
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string
    mozdirectory?: string
    directory?: string
  }
}

const Checkbox = ({ id, checked, onCheckedChange, className }: {
  id?: string; checked: boolean
  onCheckedChange: (checked: boolean) => void; className?: string
}) => (
  <input type="checkbox" id={id} checked={checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
    className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${className || ''}`}
  />
)

import {
  Select, SelectContent, SelectTrigger, SelectValue, SelectItem
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import { parseCV, validateCVFile, type ParsedCV } from "@/utils/cvParser"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  id: string; created_at: string; full_name: string; email: string
  phone_number?: string; status: string; source: string; address?: string
  university?: string; experience?: string; education?: string
  cv_url?: string; cv_file_name?: string; cv_parsed_data?: any
  source_note?: string | null
  cv_jobs: { title: string; level: string } | null
  cv_candidate_skills?: { cv_skills: { id: string; name: string; category?: string } }[]
}

interface Job {
  id: string; title: string; level: string; department: string
  description: string; requirements: string; benefits: string
  job_type: string; work_location: string; location: string
}

interface SourceItem { value: string; label: string }

// ── CSV Import types ──────────────────────────────────────────────────────────

interface CsvRow {
  full_name: string; email: string; phone_number?: string
  address?: string; university?: string; experience?: string
  education?: string; job_title?: string
  cv_file_name?: string
  _rowIndex: number
  _valid: boolean
  _errors: string[]
  _jobId?: string
  _cvFile?: File
  _cvParseStatus?: 'pending' | 'parsing' | 'done' | 'error'
  _cvParsed?: any
  _cvUrl?: string
}

// ── Duplicate handling mode ───────────────────────────────────────────────────
type DuplicateMode = 'smart' | 'skip' | 'overwrite' | 'allow'

type ImportStatus = 'idle' | 'previewing' | 'importing' | 'done'

interface ImportResult {
  success: number; skipped: number; failed: number
  details: { row: number; name: string; status: 'success' | 'skip' | 'fail'; reason?: string }[]
}

// ── Existing candidate record for duplicate check ─────────────────────────────
interface ExistingRecord {
  id: string
  created_at: string
  job_id: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_SOURCES: SourceItem[] = [
  { value: 'Website', label: 'Website' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'TopCV', label: 'TopCV' },
  { value: 'Giới thiệu', label: 'Giới thiệu' },
  { value: 'Khác', label: 'Khác' },
]

const COL_MAP: Record<string, string> = {
  'họ tên': 'full_name', 'ho ten': 'full_name', 'full name': 'full_name',
  'fullname': 'full_name', 'tên': 'full_name', 'name': 'full_name',
  'email': 'email', 'e-mail': 'email',
  'sdt': 'phone_number', 'điện thoại': 'phone_number', 'phone': 'phone_number',
  'số điện thoại': 'phone_number', 'phone number': 'phone_number',
  'địa chỉ': 'address', 'address': 'address', 'dia chi': 'address',
  'trường': 'university', 'truong': 'university', 'university': 'university',
  'school': 'university', 'trường học': 'university',
  'kinh nghiệm': 'experience', 'experience': 'experience', 'kinh nghiem': 'experience',
  'học vấn': 'education', 'education': 'education', 'hoc van': 'education',
  'vị trí': 'job_title', 'vi tri': 'job_title', 'position': 'job_title',
  'job': 'job_title', 'job title': 'job_title', 'chức vụ': 'job_title',
  'cv': 'cv_file_name', 'cv file': 'cv_file_name', 'file cv': 'cv_file_name',
  'tên file cv': 'cv_file_name', 'ten file cv': 'cv_file_name',
}

// ── Duplicate mode config ─────────────────────────────────────────────────────
const DUPLICATE_MODES: { value: DuplicateMode; label: string; description: string; color: string }[] = [
  {
    value: 'smart',
    label: '✨ Thông minh (khuyến nghị)',
    description: 'Cho phép nộp lại nếu cách lần trước ≥ 30 ngày hoặc ứng tuyển vị trí khác. Tự động gắn nhãn "Re-apply" / "Multi-apply".',
    color: 'blue',
  },
  {
    value: 'skip',
    label: '🚫 Bỏ qua trùng email + vị trí',
    description: 'Bỏ qua nếu email và vị trí đã tồn tại. Cho phép cùng email ứng tuyển vị trí khác.',
    color: 'yellow',
  },
  {
    value: 'overwrite',
    label: '🔄 Ghi đè CV mới nhất',
    description: 'Cập nhật thông tin bằng dữ liệu mới nhất khi email + vị trí đã tồn tại.',
    color: 'orange',
  },
  {
    value: 'allow',
    label: '✅ Cho phép tất cả',
    description: 'Không lọc trùng lặp, tạo bản ghi mới cho mọi dòng hợp lệ.',
    color: 'green',
  },
]

// ── Re-apply cooldown in days ─────────────────────────────────────────────────
const REAPPLY_COOLDOWN_DAYS = 30

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusBadge = (status: string) => {
  const map: Record<string, JSX.Element> = {
    'Mới':     <Badge variant="outline" className="text-blue-600 border-blue-600 bg-blue-50">Mới</Badge>,
    'Sàng lọc':<Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">Sàng lọc</Badge>,
    'Phỏng vấn':<Badge variant="outline" className="text-purple-600 border-purple-600 bg-purple-50">Phỏng vấn</Badge>,
    'Chấp nhận':<Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">Chấp nhận</Badge>,
    'Từ chối': <Badge variant="outline" className="text-red-600 border-red-600 bg-red-50">Từ chối</Badge>,
  }
  return map[status] || <Badge variant="secondary">{status}</Badge>
}

/**
 * Badge hiển thị nhãn Re-apply / Multi-apply trong bảng ứng viên.
 * Trả về null nếu không có source_note.
 */
const getSourceNoteBadge = (sourceNote?: string | null) => {
  if (!sourceNote) return null
  if (sourceNote === 'Re-apply') return (
    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50 flex items-center gap-1 w-fit">
      <RefreshCw className="h-2.5 w-2.5" />Re-apply
    </Badge>
  )
  if (sourceNote === 'Multi-apply') return (
    <Badge variant="outline" className="text-xs text-purple-600 border-purple-300 bg-purple-50 flex items-center gap-1 w-fit">
      <History className="h-2.5 w-2.5" />Multi-apply
    </Badge>
  )
  return (
    <Badge variant="outline" className="text-xs text-gray-500 border-gray-300 bg-gray-50 w-fit">
      {sourceNote}
    </Badge>
  )
}

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim())
    return result
  }

  const rawHeaders = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const cells = parseLine(line)
    const obj: Record<string, string> = {}
    rawHeaders.forEach((h, i) => { obj[h] = cells[i] || '' })
    return obj
  }).filter(row => Object.values(row).some(v => v.trim()))

  return { headers: rawHeaders, rows }
}

function mapHeaders(rawHeaders: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  rawHeaders.forEach(h => {
    const key = h.toLowerCase().trim()
    const field = COL_MAP[key]
    if (field) map[h] = field
  })
  return map
}

function validateRow(
  rawRow: Record<string, string>,
  headerMap: Record<string, string>,
  idx: number,
  jobs: Job[]
): CsvRow {
  const row: CsvRow = {
    full_name: '', email: '', _rowIndex: idx, _valid: true, _errors: []
  }

  Object.entries(headerMap).forEach(([rawHeader, field]) => {
    const val = (rawRow[rawHeader] || '').trim()
    ;(row as any)[field] = val
  })

  if (!row.full_name) { row._errors.push('Thiếu họ tên'); row._valid = false }
  if (!row.email) { row._errors.push('Thiếu email'); row._valid = false }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    row._errors.push('Email không hợp lệ'); row._valid = false
  }

  if (row.job_title) {
    const match = jobs.find(j =>
      j.title.toLowerCase().trim() === row.job_title!.toLowerCase().trim()
    )
    if (match) row._jobId = match.id
    else row._errors.push(`Không tìm thấy vị trí "${row.job_title}"`)
  }

  return row
}

// ─── ImportCsvDialog ──────────────────────────────────────────────────────────

interface ImportCsvDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobs: Job[]
  sources: SourceItem[]
  onImportDone: () => void
}

function ImportCsvDialog({ open, onOpenChange, jobs, sources, onImportDone }: ImportCsvDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [selectedSource, setSelectedSource] = useState('')
  const [defaultJobId, setDefaultJobId] = useState('')
  // ── Duplicate mode (replaces old skipDuplicates boolean) ──────────────────
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('smart')
  const [fileName, setFileName] = useState('')

  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({})
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [parseError, setParseError] = useState('')

  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importDetail, setImportDetail] = useState('')

  // ── CV folder state ───────────────────────────────────────────────────────
  const cvFolderRef = useRef<HTMLInputElement>(null)
  const [cvFileMap, setCvFileMap] = useState<Map<string, File>>(new Map())
  const [cvUniqueFiles, setCvUniqueFiles] = useState<File[]>([])
  const [enableCvUpload, setEnableCvUpload] = useState(false)
  const [parseAllCv, setParseAllCv] = useState(false)

  const validRows = csvRows.filter(r => r._valid)
  const invalidRows = csvRows.filter(r => !r._valid)

  const reset = () => {
    setStep(1); setSelectedSource(''); setDefaultJobId(''); setDuplicateMode('smart')
    setFileName(''); setCsvRows([]); setHeaderMap({}); setRawHeaders([])
    setParseError(''); setResult(null); setImportProgress(0); setImportDetail('')
    setCvFileMap(new Map()); setCvUniqueFiles([]); setEnableCvUpload(false); setParseAllCv(false)
    if (fileRef.current) fileRef.current.value = ''
    if (cvFolderRef.current) cvFolderRef.current.value = ''
  }

  const handleClose = () => { reset(); onOpenChange(false) }

  // ── File CSV selected ──────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCsvText(text)
      if (!headers.length) { setParseError('File CSV trống hoặc không hợp lệ.'); return }

      const hMap = mapHeaders(headers)
      setRawHeaders(headers)
      setHeaderMap(hMap)

      const mapped = rows.map((r, i) => validateRow(r, hMap, i + 2, jobs))
      if (cvFileMap.size > 0) {
        setCsvRows(mapped.map(row => ({ ...row, _cvFile: matchCvFile(row, cvFileMap) })))
      } else {
        setCsvRows(mapped)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  // ── CV folder selected ────────────────────────────────────────────────────
  const handleCvFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const cvFiles = files.filter(f =>
      /\.(pdf|docx|doc|txt)$/i.test(f.name) && !f.name.startsWith('.')
    )

    if (cvFiles.length === 0) {
      toast.warning('Không tìm thấy file CV hợp lệ (PDF, DOCX, DOC, TXT) trong thư mục đã chọn')
      return
    }

    const map = new Map<string, File>()
    cvFiles.forEach(f => {
      map.set(f.name, f)
      map.set(f.name.toLowerCase(), f)
    })

    setCvFileMap(map)
    setCvUniqueFiles(cvFiles)

    if (csvRows.length > 0) {
      setCsvRows(prev => prev.map(row => ({
        ...row,
        _cvFile: row._cvFile || matchCvFile(row, map)
      })))
    }

    const skipped = files.length - cvFiles.length
    toast.success(
      `Đã nhận ${cvFiles.length} file CV` +
      (skipped > 0 ? ` (bỏ qua ${skipped} file không hợp lệ)` : '')
    )
  }

  const matchCvFile = (row: CsvRow, map: Map<string, File>): File | undefined => {
    if (row.cv_file_name) {
      const f = map.get(row.cv_file_name) || map.get(row.cv_file_name.toLowerCase())
      if (f) return f
    }
    const emailBase = row.email.replace(/[@.]/g, '').toLowerCase()
    for (const [key, file] of Array.from(map.entries())) {
      if (key.toLowerCase().includes(row.email.toLowerCase()) ||
          key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(emailBase)) {
        return file
      }
    }
    const lastName = row.full_name.trim().split(/\s+/).pop()?.toLowerCase() || ''
    const firstName = row.full_name.trim().split(/\s+/)[0]?.toLowerCase() || ''
    for (const [key, file] of Array.from(map.entries())) {
      const kl = key.toLowerCase()
      if (lastName.length > 1 && kl.includes(lastName) && kl.includes(firstName)) {
        return file
      }
    }
    return undefined
  }

  const handleNextToPreview = () => {
    if (!selectedSource) { toast.warning('Vui lòng chọn nguồn ứng viên'); return }
    if (!csvRows.length) { toast.warning('Vui lòng chọn file CSV'); return }
    if (cvFileMap.size > 0) {
      setCsvRows(prev => prev.map(row => ({
        ...row,
        _cvFile: row._cvFile || matchCvFile(row, cvFileMap)
      })))
    }
    setStep(2)
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true)
    setStep(3)
    setImportProgress(0)
    setImportDetail('')

    const res: ImportResult = { success: 0, skipped: 0, failed: 0, details: [] }
    const rows = validRows

    // ── Build existing records map keyed by "email::job_id" ──────────────────
    // Fetch with pagination to handle DB > 1000 rows safely
    type ExistingRecord = { id: string; email: string; job_id: string | null; created_at: string }
    let allExisting: ExistingRecord[] = []

    if (duplicateMode !== 'allow') {
      setImportDetail('Đang kiểm tra dữ liệu trùng lặp...')
      let from = 0
      const PAGE = 1000
      while (true) {
        const { data, error } = await supabase
          .from('cv_candidates')
          .select('id, email, job_id, created_at')
          .range(from, from + PAGE - 1)

        if (error) {
          toast.error('Không thể kiểm tra dữ liệu trùng lặp. Vui lòng thử lại.')
          setImporting(false)
          setStep(2)
          return
        }
        if (!data || data.length === 0) break
        allExisting.push(...(data as ExistingRecord[]))
        if (data.length < PAGE) break
        from += PAGE
      }
    }

    // existingMap: "email_lower::job_id_or_empty" → array of records
    const existingMap = new Map<string, ExistingRecord[]>()
    for (const r of allExisting) {
      const key = `${r.email.toLowerCase()}::${r.job_id || ''}`
      if (!existingMap.has(key)) existingMap.set(key, [])
      existingMap.get(key)!.push(r)
    }

    // emailJobIds: Set of all "email::job_id" keys that exist (for multi-apply detection)
    const allEmailKeys = new Set(allExisting.map(r => r.email.toLowerCase()))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      setImportProgress(Math.round(((i + 1) / rows.length) * 100))
      setImportDetail(`Đang xử lý: ${row.full_name}`)

      const jobId = row._jobId || (defaultJobId && defaultJobId !== 'none' ? defaultJobId : null)
      const emailLower = row.email.toLowerCase()
      const dupKey = `${emailLower}::${jobId || ''}`
      const existingRecords = existingMap.get(dupKey) || []

      // ── Determine source_note ─────────────────────────────────────────────
      let sourceNote: string | null = null
      const emailExistsAnyJob = allEmailKeys.has(emailLower)
      const sameJobExists = existingRecords.length > 0

      if (emailExistsAnyJob && !sameJobExists) {
        // Cùng email nhưng khác job → Multi-apply
        sourceNote = 'Multi-apply'
      }

      // ── Apply duplicate mode logic ────────────────────────────────────────
      if (duplicateMode === 'skip' && sameJobExists) {
        res.skipped++
        res.details.push({ row: row._rowIndex, name: row.full_name, status: 'skip', reason: 'Email + vị trí đã tồn tại' })
        continue
      }

      if (duplicateMode === 'smart' && sameJobExists) {
        const latest = [...existingRecords].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        const daysSince = (Date.now() - new Date(latest.created_at).getTime()) / 86_400_000

        if (daysSince < REAPPLY_COOLDOWN_DAYS) {
          res.skipped++
          res.details.push({
            row: row._rowIndex, name: row.full_name, status: 'skip',
            reason: `Nộp lại quá sớm (${Math.round(daysSince)} ngày, tối thiểu ${REAPPLY_COOLDOWN_DAYS} ngày)`
          })
          continue
        }
        // Re-apply hợp lệ
        sourceNote = 'Re-apply'
      }

      if (duplicateMode === 'overwrite' && sameJobExists) {
        // Update record cũ thay vì tạo mới
        const latest = [...existingRecords].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        setImportDetail(`Đang ghi đè: ${row.full_name}`)
        try {
          let cvUrl: string | null = null
          let cvFileName: string | null = null
          let cvParsedData: any = null
          const cvFile = row._cvFile

          if (cvFile && enableCvUpload) {
            const storageName = `${Date.now()}_${cvFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
            const { error: upErr } = await supabase.storage.from('cv-files').upload(storageName, cvFile)
            if (!upErr) {
              cvUrl = supabase.storage.from('cv-files').getPublicUrl(storageName).data.publicUrl
              cvFileName = cvFile.name
              if (parseAllCv) {
                try {
                  const { parseCV } = await import('@/utils/cvParser')
                  cvParsedData = await parseCV(cvFile)
                } catch { /* parse failed, continue without parsed data */ }
              }
            }
          }

          const updatePayload: any = {
            full_name: row.full_name,
            email: row.email,
            phone_number: row.phone_number || null,
            address: row.address || null,
            university: row.university || null,
            experience: row.experience || null,
            education: row.education || null,
            source: selectedSource,
            source_note: 'Re-apply',
          }
          if (cvUrl) { updatePayload.cv_url = cvUrl; updatePayload.cv_file_name = cvFileName }
          if (cvParsedData) updatePayload.cv_parsed_data = cvParsedData

          const { error } = await supabase.from('cv_candidates').update(updatePayload).eq('id', latest.id)
          if (error) throw error

          res.success++
          res.details.push({ row: row._rowIndex, name: row.full_name, status: 'success', reason: 'Ghi đè thành công' })
        } catch (err: any) {
          res.failed++
          res.details.push({ row: row._rowIndex, name: row.full_name, status: 'fail', reason: err.message || 'Lỗi ghi đè' })
        }
        continue
      }

      // ── Default: INSERT new record ────────────────────────────────────────
      try {
        let cvUrl: string | null = null
        let cvFileName: string | null = null
        let cvParsedData: any = null
        const cvFile = row._cvFile

        if (cvFile && enableCvUpload) {
          setImportDetail(`Đang tải CV: ${cvFile.name}`)
          try {
            const storageName = `${Date.now()}_${cvFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
            const { error: upErr } = await supabase.storage.from('cv-files').upload(storageName, cvFile)
            if (upErr) throw upErr

            cvUrl = supabase.storage.from('cv-files').getPublicUrl(storageName).data.publicUrl
            cvFileName = cvFile.name

            if (parseAllCv) {
              setImportDetail(`Đang phân tích CV: ${cvFile.name}`)
              try {
                const { parseCV } = await import('@/utils/cvParser')
                cvParsedData = await parseCV(cvFile)
              } catch { /* parse failed, continue */ }
            }
          } catch (uploadErr: any) {
            console.warn('CV upload failed for', cvFile.name, uploadErr)
          }
        }

        setImportDetail(`Đang lưu: ${row.full_name}`)
        const { data, error } = await supabase
          .from('cv_candidates')
          .insert({
            full_name: row.full_name,
            email: row.email,
            phone_number: row.phone_number || null,
            address: row.address || (cvParsedData?.address || null),
            university: row.university || (cvParsedData?.university || null),
            experience: row.experience || (cvParsedData?.experience || null),
            education: row.education || (cvParsedData?.education || null),
            job_id: jobId,
            source: selectedSource,
            status: 'Mới',
            source_note: sourceNote,
            cv_url: cvUrl,
            cv_file_name: cvFileName,
            cv_parsed_data: cvParsedData || null,
          })
          .select('id')
          .single()

        if (error) throw error

        // Update lookup sets so within-batch duplicates are also caught
        allEmailKeys.add(emailLower)
        const newRec: ExistingRecord = { id: data.id, email: row.email, job_id: jobId, created_at: new Date().toISOString() }
        if (!existingMap.has(dupKey)) existingMap.set(dupKey, [])
        existingMap.get(dupKey)!.push(newRec)

        try {
          await ActivityLogger.logCVSubmitted(row.full_name, data.id, undefined)
        } catch (_) {}

        res.success++
        const hasCv = !!cvUrl
        const noteLabel = sourceNote ? ` [${sourceNote}]` : ''
        res.details.push({
          row: row._rowIndex, name: row.full_name, status: 'success',
          reason: hasCv ? (cvParsedData ? `CV đã tải + phân tích${noteLabel}` : `CV đã tải lên${noteLabel}`) : (noteLabel || undefined)
        })
      } catch (err: any) {
        res.failed++
        res.details.push({
          row: row._rowIndex, name: row.full_name, status: 'fail',
          reason: err.message?.includes('duplicate') ? 'Email trùng lặp (DB constraint)' : (err.message || 'Lỗi không xác định')
        })
      }
    }

    setImportDetail('')
    setResult(res)
    setImporting(false)
    if (res.success > 0) onImportDone()
  }

  // ── Template download ──────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const header = 'Họ tên,Email,Số điện thoại,Địa chỉ,Trường học,Kinh nghiệm,Học vấn,Vị trí,CV'
    const sample = 'Nguyễn Văn A,nguyenvana@email.com,0901234567,TP.HCM,ĐH Bách Khoa,3 năm Frontend,Cử nhân CNTT,Frontend Developer,nguyen_van_a_cv.pdf'
    const notes = [
      '# Hướng dẫn cột "CV": điền tên file CV (VD: nguyen_van_a.pdf)',
      '# Hệ thống cũng tự ghép theo email hoặc tên nếu cột CV để trống',
    ].join('\n')
    const blob = new Blob([notes + '\n' + header + '\n' + sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'template_import_ung_vien.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const matchedCount = csvRows.filter(r => r._valid && r._cvFile).length
  const unmatchedCount = validRows.length - matchedCount

  const activeModeConfig = DUPLICATE_MODES.find(m => m.value === duplicateMode)!

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">

        {/* Header */}
        <div className="px-6 py-4 border-b bg-linear-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Upload className="h-5 w-5 text-blue-600" />
              Import ứng viên từ CSV
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {[
              { n: 1, label: 'Cấu hình' },
              { n: 2, label: 'Xem trước' },
              { n: 3, label: 'Kết quả' },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  step === s.n
                    ? 'bg-blue-600 text-white'
                    : step > s.n
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {step > s.n
                    ? <CheckCircle className="h-3.5 w-3.5" />
                    : <span className="w-4 h-4 flex items-center justify-center rounded-full bg-white/30 text-[10px]">{s.n}</span>
                  }
                  {s.label}
                </div>
                {i < 2 && <div className={`h-px w-6 ${step > s.n ? 'bg-green-300' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEP 1: Config ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">

              {/* Format guide */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Định dạng file CSV</p>
                    <p className="text-xs text-blue-700 mb-2">
                      File CSV cần có các cột (không phân biệt hoa thường):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Họ tên *', 'Email *', 'Số điện thoại', 'Địa chỉ', 'Trường học', 'Kinh nghiệm', 'Học vấn', 'Vị trí', 'CV'].map(col => (
                        <code key={col} className={`text-[10px] px-2 py-0.5 rounded ${col.includes('*') ? 'bg-blue-200 text-blue-900 font-semibold' : col === 'CV' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-white text-blue-700 border border-blue-200'}`}>
                          {col}
                        </code>
                      ))}
                    </div>
                    <button onClick={downloadTemplate}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      Tải file mẫu CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Source selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-blue-500" />
                  Nguồn ứng viên <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500">
                  Chọn nguồn áp dụng cho tất cả ứng viên trong file CSV này.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {sources.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSelectedSource(s.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        selectedSource === s.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {selectedSource === s.value
                        ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        : <div className="h-4 w-4 rounded-full border-2 border-current opacity-30 flex-shrink-0" />
                      }
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default job */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-gray-500" />
                  Vị trí mặc định (tuỳ chọn)
                </label>
                <p className="text-xs text-gray-500">
                  Áp dụng khi CSV không có cột "Vị trí" hoặc tên vị trí không khớp.
                </p>
                <Select value={defaultJobId} onValueChange={setDefaultJobId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Không chọn (bỏ qua)" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 shadow-lg border border-gray-200 max-h-60">
                    <SelectItem value="none">Không chọn</SelectItem>
                    {jobs.map(j => (
                      <SelectItem key={j.id} value={j.id}>{j.title} – {j.level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── Duplicate handling mode ────────────────────────────────── */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Xử lý ứng viên trùng lặp
                </label>
                <p className="text-xs text-gray-500">
                  Quy tắc áp dụng khi phát hiện email đã tồn tại trong hệ thống.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {DUPLICATE_MODES.map(mode => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setDuplicateMode(mode.value)}
                      className={`text-left px-3 py-3 rounded-lg border-2 transition-all ${
                        duplicateMode === mode.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-0.5 ${duplicateMode === mode.value ? 'text-blue-800' : 'text-gray-800'}`}>
                        {mode.label}
                      </p>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{mode.description}</p>
                    </button>
                  ))}
                </div>

                {/* Active mode explanation banner */}
                <div className={`flex items-start gap-2 p-3 rounded-lg border mt-1 ${
                  duplicateMode === 'smart' ? 'bg-blue-50 border-blue-200' :
                  duplicateMode === 'skip' ? 'bg-yellow-50 border-yellow-200' :
                  duplicateMode === 'overwrite' ? 'bg-orange-50 border-orange-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                    duplicateMode === 'smart' ? 'text-blue-500' :
                    duplicateMode === 'skip' ? 'text-yellow-600' :
                    duplicateMode === 'overwrite' ? 'text-orange-500' :
                    'text-green-600'
                  }`} />
                  <div className="text-xs leading-relaxed">
                    {duplicateMode === 'smart' && (
                      <span className="text-blue-800">
                        <strong>Chế độ thông minh:</strong> Hệ thống tự phân biệt{' '}
                        <strong>spam</strong> (nộp lại &lt; {REAPPLY_COOLDOWN_DAYS} ngày, cùng vị trí → bỏ qua),{' '}
                        <strong>Re-apply</strong> (nộp lại ≥ {REAPPLY_COOLDOWN_DAYS} ngày → cho phép + gắn nhãn),{' '}
                        và <strong>Multi-apply</strong> (cùng email, khác vị trí → luôn cho phép + gắn nhãn).
                      </span>
                    )}
                    {duplicateMode === 'skip' && (
                      <span className="text-yellow-800">
                        <strong>Chế độ bảo thủ:</strong> Bỏ qua nếu email + vị trí đã tồn tại. Cùng email nhưng khác vị trí vẫn được tạo mới.
                      </span>
                    )}
                    {duplicateMode === 'overwrite' && (
                      <span className="text-orange-800">
                        <strong>Chế độ ghi đè:</strong> Cập nhật thông tin của bản ghi cũ nhất khi email + vị trí trùng. Tự động gắn nhãn "Re-apply".
                      </span>
                    )}
                    {duplicateMode === 'allow' && (
                      <span className="text-green-800">
                        <strong>Không lọc:</strong> Tạo bản ghi mới cho mọi dòng hợp lệ, kể cả email và vị trí hoàn toàn trùng nhau.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── CV folder upload ──────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <Checkbox
                    id="enable-cv"
                    checked={enableCvUpload}
                    onCheckedChange={setEnableCvUpload}
                  />
                  <div className="flex-1">
                    <label htmlFor="enable-cv" className="text-sm font-medium text-purple-900 cursor-pointer flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-purple-600" />
                      Đính kèm file CV từ thư mục (PDF / DOCX)
                    </label>
                    <p className="text-xs text-purple-600 mt-0.5">
                      Chọn <strong>cả thư mục</strong> — hệ thống tự ghép CV với ứng viên theo email hoặc tên.
                    </p>
                  </div>
                </div>

                {enableCvUpload && (
                  <div className="pl-3 space-y-3 border-l-2 border-purple-200">
                    <div>
                      <input
                        ref={cvFolderRef}
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        multiple
                        webkitdirectory=""
                        mozdirectory=""
                        directory=""
                        className="hidden"
                        onChange={handleCvFolderChange}
                      />

                      <div
                        onClick={() => cvFolderRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                          cvUniqueFiles.length > 0
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/30'
                        }`}
                      >
                        {cvUniqueFiles.length > 0 ? (
                          <div className="space-y-2">
                            <CheckCircle2 className="h-8 w-8 mx-auto text-purple-500" />
                            <p className="font-medium text-purple-700 text-sm">
                              Đã tải {cvUniqueFiles.length} file CV
                            </p>
                            {csvRows.length > 0 && (
                              <div className="flex items-center justify-center gap-3 text-xs">
                                <span className="flex items-center gap-1 text-green-600 font-semibold">
                                  <CheckCircle className="h-3.5 w-3.5" />{matchedCount} ghép được
                                </span>
                                {unmatchedCount > 0 && (
                                  <span className="flex items-center gap-1 text-orange-500">
                                    <AlertCircle className="h-3.5 w-3.5" />{unmatchedCount} chưa ghép
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="mt-2 text-left max-h-28 overflow-y-auto space-y-1 px-1">
                              {cvUniqueFiles.slice(0, 5).map((f, idx) => {
                                const isMatched = csvRows.some(r => r._cvFile?.name === f.name)
                                return (
                                  <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600">
                                    <FileText className="h-3 w-3 text-purple-400 flex-shrink-0" />
                                    <span className="truncate flex-1">{f.name}</span>
                                    {csvRows.length > 0 && (
                                      isMatched
                                        ? <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                        : <span className="h-3 w-3 rounded-full border border-gray-300 flex-shrink-0" />
                                    )}
                                  </div>
                                )
                              })}
                              {cvUniqueFiles.length > 5 && (
                                <p className="text-xs text-gray-400 pl-4">... và {cvUniqueFiles.length - 5} file khác</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                setCvFileMap(new Map()); setCvUniqueFiles([])
                                if (cvFolderRef.current) cvFolderRef.current.value = ''
                                setCsvRows(prev => prev.map(r => ({ ...r, _cvFile: undefined })))
                              }}
                              className="text-xs text-gray-400 hover:text-red-500 underline"
                            >
                              Xóa & chọn lại
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <Upload className="h-8 w-8 mx-auto text-purple-300" />
                            <p className="text-sm text-gray-600 font-medium">Click để chọn thư mục CV</p>
                            <p className="text-xs text-gray-400">Chọn cả thư mục — tự động đọc toàn bộ file bên trong</p>
                            <p className="text-xs text-purple-400">PDF · DOCX · DOC · TXT</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 space-y-0.5">
                        <p className="font-medium text-gray-600">Quy tắc ghép tự động:</p>
                        <p>① Cột <code className="bg-gray-200 px-1 rounded">CV</code> trong CSV (tên file chính xác)</p>
                        <p>② Email ứng viên có trong tên file</p>
                        <p>③ Họ + tên ứng viên cùng có trong tên file</p>
                        <p className="text-orange-500">⚠ Có thể ghép thủ công trong bước Xem trước</p>
                      </div>
                    </div>

                    {/* Parse CV option */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <Checkbox id="parse-cv" checked={parseAllCv} onCheckedChange={setParseAllCv} />
                      <div>
                        <label htmlFor="parse-cv" className="text-sm font-medium text-gray-800 cursor-pointer flex items-center gap-1.5">
                          <Brain className="h-4 w-4 text-orange-500" />
                          Tự động phân tích CV bằng AI
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Trích xuất thêm thông tin từ CV để bổ sung vào hồ sơ ứng viên (chậm hơn).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* File CSV upload */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  File CSV <span className="text-red-500">*</span>
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    fileName
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
                  }`}
                >
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                  {fileName ? (
                    <div className="space-y-2">
                      <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
                      <p className="font-medium text-green-700">{fileName}</p>
                      {csvRows.length > 0 && (
                        <p className="text-sm text-gray-600">
                          Tìm thấy <strong>{csvRows.length}</strong> dòng dữ liệu
                          {' '}(<span className="text-green-600">{validRows.length} hợp lệ</span>
                          {invalidRows.length > 0 && <span className="text-red-500">, {invalidRows.length} lỗi</span>})
                        </p>
                      )}
                      <button
                        type="button"
                        className="text-xs text-gray-400 hover:text-red-500 underline"
                        onClick={e => { e.stopPropagation(); setFileName(''); setCsvRows([]); if (fileRef.current) fileRef.current.value = '' }}
                      >
                        Chọn file khác
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 mx-auto text-gray-300" />
                      <p className="text-sm text-gray-600">Click để chọn file CSV</p>
                      <p className="text-xs text-gray-400">Chỉ hỗ trợ định dạng .csv</p>
                    </div>
                  )}
                </div>
                {parseError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />{parseError}
                  </p>
                )}
              </div>

              {/* Unmapped columns warning */}
              {rawHeaders.length > 0 && (() => {
                const unmapped = rawHeaders.filter(h => !headerMap[h])
                return unmapped.length > 0 ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs font-medium text-yellow-800 flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Cột không nhận dạng được (sẽ bỏ qua):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {unmapped.map(h => (
                        <code key={h} className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">{h}</code>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* ── STEP 2: Preview ─────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`grid gap-3 ${enableCvUpload ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {[
                  { label: 'Tổng dòng', value: csvRows.length, color: 'text-gray-900', bg: 'bg-gray-50' },
                  { label: 'Hợp lệ', value: validRows.length, color: 'text-green-700', bg: 'bg-green-50' },
                  { label: 'Có lỗi', value: invalidRows.length, color: 'text-red-600', bg: 'bg-red-50' },
                  ...(enableCvUpload ? [{ label: 'Có CV', value: matchedCount, color: 'text-purple-700', bg: 'bg-purple-50' }] : []),
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center border`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Source + job + mode recap */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-600">Nguồn:</span>
                  <Badge className="bg-blue-600 text-white text-xs">{selectedSource}</Badge>
                </div>
                {(defaultJobId && defaultJobId !== 'none') && (
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-gray-600">Vị trí mặc định:</span>
                    <span className="font-medium">{jobs.find(j => j.id === defaultJobId)?.title}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-gray-600">Trùng lặp:</span>
                  <Badge className={`text-xs ${
                    duplicateMode === 'smart' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    duplicateMode === 'skip' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                    duplicateMode === 'overwrite' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                    'bg-green-100 text-green-700 border-green-200'
                  }`}>
                    {activeModeConfig.label}
                  </Badge>
                </div>
                {enableCvUpload && (
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span className="text-gray-600">CV:</span>
                    <span className="text-purple-700 font-medium">{matchedCount} ghép được</span>
                    {parseAllCv && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">AI parse</Badge>}
                  </div>
                )}
              </div>

              {/* Table preview */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-10">#</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Họ tên</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">SĐT</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Vị trí</th>
                        {enableCvUpload && <th className="px-3 py-2 text-left text-xs font-semibold text-purple-600 w-36">File CV</th>}
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-28">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {csvRows.map(row => (
                        <tr key={row._rowIndex}
                          className={`${row._valid ? 'hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'} transition-colors`}>
                          <td className="px-3 py-2 text-xs text-gray-400">{row._rowIndex}</td>
                          <td className="px-3 py-2 font-medium text-gray-900 max-w-[140px] truncate">{row.full_name || '—'}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate">{row.email || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.phone_number || '—'}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">
                            {row._jobId
                              ? <span className="text-green-700">{jobs.find(j => j.id === row._jobId)?.title || row.job_title}</span>
                              : row.job_title
                              ? <span className="text-orange-500">{row.job_title} (?)</span>
                              : defaultJobId && defaultJobId !== 'none'
                              ? <span className="text-blue-600 italic">{jobs.find(j => j.id === defaultJobId)?.title}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          {enableCvUpload && (
                            <td className="px-3 py-2 w-36">
                              {row._cvFile ? (
                                <div className="flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                                  <span className="text-xs text-purple-700 truncate max-w-[100px]" title={row._cvFile.name}>
                                    {row._cvFile.name}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <label className="text-[10px] text-gray-400 cursor-pointer hover:text-purple-600 flex items-center gap-0.5">
                                    <Upload className="h-3 w-3" />
                                    <span>Chọn</span>
                                    <input
                                      type="file"
                                      accept=".pdf,.docx,.doc,.txt"
                                      className="hidden"
                                      onChange={(e: any) => {
                                        const f = e.target.files?.[0]
                                        if (f) setCsvRows(prev => prev.map(r =>
                                          r._rowIndex === row._rowIndex ? { ...r, _cvFile: f } : r
                                        ))
                                      }}
                                    />
                                  </label>
                                </div>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            {row._valid ? (
                              <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                                <CheckCircle className="h-3 w-3 mr-1" />Hợp lệ
                              </Badge>
                            ) : (
                              <div className="space-y-0.5">
                                <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
                                  <XCircle className="h-3 w-3 mr-1" />Lỗi
                                </Badge>
                                {row._errors.map((e, i) => (
                                  <p key={i} className="text-[10px] text-red-600">{e}</p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {validRows.length === 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                  <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-red-700">Không có dòng nào hợp lệ để import.</p>
                  <p className="text-xs text-red-500 mt-1">Vui lòng kiểm tra lại file CSV.</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Result ─────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              {importing ? (
                <div className="text-center py-12 space-y-4">
                  <div className="relative w-20 h-20 mx-auto">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#3b82f6" strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={`${2 * Math.PI * 34 * (1 - importProgress / 100)}`}
                        className="transition-all duration-300" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-blue-600">
                      {importProgress}%
                    </span>
                  </div>
                  <p className="text-gray-700 font-medium">Đang import ứng viên...</p>
                  {importDetail && (
                    <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full inline-block max-w-xs truncate">
                      {importDetail}
                    </p>
                  )}
                  <p className="text-sm text-gray-400">Vui lòng không đóng cửa sổ này</p>
                  {enableCvUpload && (
                    <p className="text-xs text-purple-600 flex items-center gap-1 justify-center">
                      <FileText className="h-3.5 w-3.5" />
                      Đang tải CV lên Supabase Storage{parseAllCv ? ' và phân tích bằng AI' : ''}
                    </p>
                  )}
                </div>
              ) : result ? (
                <>
                  {/* Result summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Thành công', value: result.success, icon: <CheckCircle2 className="h-6 w-6" />, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
                      { label: 'Bỏ qua', value: result.skipped, icon: <AlertCircle className="h-6 w-6" />, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                      { label: 'Thất bại', value: result.failed, icon: <XCircle className="h-6 w-6" />, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-4 text-center`}>
                        <div className={`${s.color} flex justify-center mb-1`}>{s.icon}</div>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Re-apply / Multi-apply stats */}
                  {(() => {
                    const reapplyCount  = result.details.filter(d => d.status === 'success' && d.reason?.includes('Re-apply')).length
                    const multiCount    = result.details.filter(d => d.status === 'success' && d.reason?.includes('Multi-apply')).length
                    const overwriteCount = result.details.filter(d => d.status === 'success' && d.reason?.includes('Ghi đè')).length
                    if (!reapplyCount && !multiCount && !overwriteCount) return null
                    return (
                      <div className="flex flex-wrap gap-2">
                        {reapplyCount > 0 && (
                          <div className="flex items-center gap-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg text-xs">
                            <RefreshCw className="h-4 w-4 text-orange-500" />
                            <span className="text-orange-800 font-medium">{reapplyCount} Re-apply được chấp nhận</span>
                          </div>
                        )}
                        {multiCount > 0 && (
                          <div className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-xs">
                            <History className="h-4 w-4 text-purple-500" />
                            <span className="text-purple-800 font-medium">{multiCount} Multi-apply (vị trí mới)</span>
                          </div>
                        )}
                        {overwriteCount > 0 && (
                          <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                            <RefreshCw className="h-4 w-4 text-blue-500" />
                            <span className="text-blue-800 font-medium">{overwriteCount} bản ghi được ghi đè</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* CV upload stats */}
                  {enableCvUpload && (() => {
                    const withCv  = result.details.filter(d => d.status === 'success' && d.reason?.includes('CV')).length
                    const parsed  = result.details.filter(d => d.status === 'success' && d.reason?.includes('phân tích')).length
                    return withCv > 0 ? (
                      <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm">
                        <FileText className="h-5 w-5 text-purple-600 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-purple-900">CV đã tải lên: <strong>{withCv}</strong> file</p>
                          {parseAllCv && (
                            <p className="text-xs text-purple-600 mt-0.5">Phân tích AI thành công: {parsed}/{withCv} file</p>
                          )}
                        </div>
                      </div>
                    ) : null
                  })()}

                  {/* Detail log */}
                  {result.details.length > 0 && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">
                        Chi tiết ({result.details.length} dòng)
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                        {result.details.map((d, i) => (
                          <div key={i} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                            d.status === 'success' ? 'bg-white' : d.status === 'skip' ? 'bg-yellow-50' : 'bg-red-50'
                          }`}>
                            {d.status === 'success'
                              ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              : d.status === 'skip'
                              ? <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                              : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            }
                            <span className="text-gray-400 text-xs w-8 flex-shrink-0">#{d.row}</span>
                            <span className="font-medium text-gray-800 flex-1 truncate">{d.name}</span>
                            {d.reason && <span className="text-xs text-gray-400 flex-shrink-0">{d.reason}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500">
            {step === 2 && validRows.length > 0 && `Sẽ import ${validRows.length} ứng viên`}
          </div>
          <div className="flex gap-2">
            {step === 1 && (
              <>
                <Button variant="outline" onClick={handleClose}>Hủy</Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleNextToPreview}
                  disabled={!csvRows.length || !selectedSource}
                >
                  Xem trước →
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>← Quay lại</Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import {validRows.length} ứng viên
                </Button>
              </>
            )}
            {step === 3 && !importing && (
              <>
                <Button variant="outline" onClick={handleClose}>Đóng</Button>
                {result && result.success > 0 && (
                  <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleClose}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />Hoàn thành
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentTab, setCurrentTab] = useState<'basic' | 'cv' | 'requirements'>('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedCV | null>(null)
  const [sources, setSources] = useState<SourceItem[]>(FALLBACK_SOURCES)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null)
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Candidate | null>(null)
  const [viewCVCandidate, setViewCVCandidate] = useState<Candidate | null>(null)
  const [analyzeCVCandidate, setAnalyzeCVCandidate] = useState<Candidate | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPosition, setFilterPosition] = useState('all')
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [tempFilterStatus, setTempFilterStatus] = useState('all')
  const [tempFilterPosition, setTempFilterPosition] = useState('all')
  const [tempFilterLevel, setTempFilterLevel] = useState('all')
  const [tempFilterSource, setTempFilterSource] = useState('all')

  const [isLoadingView, setIsLoadingView] = useState(false)
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [isLoadingCV, setIsLoadingCV] = useState(false)
  const [isLoadingAnalyze, setIsLoadingAnalyze] = useState(false)

  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  const [formData, setFormData] = useState({
    full_name: '', email: '', phone_number: '', job_id: '', address: '',
    experience: '', education: '', university: '', status: 'Mới', source: '',
    skills: [] as string[]
  })

  useEffect(() => { fetchCandidates(); fetchSources() }, [])

  useEffect(() => {
    supabase.from('cv_jobs')
      .select('id, title, level, department, description, requirements, benefits, job_type, work_location, location')
      .order('title')
      .then(({ data }: any) => { if (data) setJobs(data) })
  }, [])

  useEffect(() => {
    if (formData.job_id) {
      const job = jobs.find(j => j.id === formData.job_id)
      setSelectedJob(job || null)
    } else {
      setSelectedJob(null)
    }
  }, [formData.job_id, jobs])

  const fetchSources = async () => {
    try {
      const { data } = await supabase.from('cv_candidate_categories')
        .select('value, label').eq('type', 'source').order('sort_order', { ascending: true })
      if (data && data.length > 0) setSources(data as SourceItem[])
    } catch { /* keep fallback */ }
  }

  const renderSourceItems = () => sources.map(item => (
    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
  ))

  const fetchCandidates = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('cv_candidates')
      .select(`*, cv_jobs(title,level), cv_candidate_skills(cv_skills(id,name,category))`)
      .order('created_at', { ascending: false })
    if (data) setCandidates(data as Candidate[])
    if (error) console.error(error)
    setLoading(false)
  }

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({ full_name:'', email:'', phone_number:'', job_id:'', address:'', experience:'', education:'', university:'', status:'Mới', source:'', skills:[] })
    setCurrentTab('basic'); setSelectedFile(null); setParsedData(null)
    setSelectedJob(null)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const validation = validateCVFile(file)
    if (!validation.valid) { toast.error(validation.error || 'File CV không hợp lệ'); event.target.value = ''; return }
    setSelectedFile(file)
    try {
      setIsUploading(true)
      const parsed = await parseCV(file)
      setParsedData(parsed)
      if (parsed.fullName) handleInputChange('full_name', parsed.fullName)
      if (parsed.email) handleInputChange('email', parsed.email)
      if (parsed.phone) handleInputChange('phone_number', parsed.phone)
      if (parsed.address) handleInputChange('address', parsed.address)
      if (parsed.university) handleInputChange('university', parsed.university)
      if (parsed.education) handleInputChange('education', parsed.education)
      if (parsed.experience) handleInputChange('experience', parsed.experience)
      if (parsed.skills?.length) handleInputChange('skills', parsed.skills)
      toast.success('Phân tích CV thành công! Thông tin đã được điền tự động.')
      setTimeout(() => setCurrentTab('basic'), 300)
    } catch (err: any) {
      toast.error('Không thể phân tích CV: ' + (err.message || 'Lỗi không xác định'))
    } finally { setIsUploading(false) }
  }

  const sanitizeStr = (s: string | null | undefined): string | null => {
    if (!s) return null
    return s.replace(/\u0000/g, '').replace(/\x00/g, '')
  }
  const sanitizeObj = (obj: any): any => {
    if (!obj) return obj
    if (typeof obj === 'string') return sanitizeStr(obj)
    if (Array.isArray(obj)) return obj.map(sanitizeObj)
    if (typeof obj === 'object') {
      const result: any = {}
      for (const key of Object.keys(obj)) result[key] = sanitizeObj(obj[key])
      return result
    }
    return obj
  }

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email || !formData.job_id) {
      toast.warning('Vui lòng điền đầy đủ thông tin bắt buộc (Họ tên, Email, Vị trí ứng tuyển)'); return
    }
    setIsSaving(true)
    try {
      let cvUrl = null, cvFileName = null, parsedCV = null
      if (selectedFile) {
        const fName = `${Date.now()}_${selectedFile.name}`
        const { error: uploadError } = await supabase.storage.from('cv-files').upload(fName, selectedFile)
        if (uploadError) throw uploadError
        cvUrl = supabase.storage.from('cv-files').getPublicUrl(fName).data.publicUrl
        cvFileName = selectedFile.name; parsedCV = sanitizeObj(parsedData)
      }
      const { data, error } = await supabase.from('cv_candidates').insert({
        full_name: sanitizeStr(formData.full_name), email: sanitizeStr(formData.email),
        phone_number: sanitizeStr(formData.phone_number) || null, job_id: formData.job_id,
        address: sanitizeStr(formData.address) || null, experience: sanitizeStr(formData.experience) || null,
        education: sanitizeStr(formData.education) || null, university: sanitizeStr(formData.university) || null,
        status: 'Mới', source: formData.source || null,
        cv_url: cvUrl, cv_file_name: cvFileName, cv_parsed_data: parsedCV,
      }).select().single()
      if (error) throw error
      await saveCandidateSkills(data.id, formData.skills)
      try { await ActivityLogger.logCVSubmitted(formData.full_name, data.id, jobs.find(j => j.id === formData.job_id)?.title) } catch (_) {}
      const { data: fullData } = await supabase.from('cv_candidates')
        .select(`*, cv_jobs(title,level), cv_candidate_skills(cv_skills(id,name,category))`).eq('id', data.id).single()
      if (fullData) { setCandidates(prev => [fullData as Candidate, ...prev]); setIsDialogOpen(false); resetForm(); toast.success('Thêm ứng viên thành công!') }
    } catch (err: any) { toast.error('Lỗi: ' + (err.message || 'Không thể thêm ứng viên')) }
    finally { setIsSaving(false) }
  }

  const handleUpdateCandidate = async () => {
    if (!editCandidate) return
    setIsSaving(true)
    try {
      await supabase.from('cv_candidates').update({
        full_name: formData.full_name, email: formData.email,
        phone_number: formData.phone_number || null, address: formData.address || null,
        experience: formData.experience || null, education: formData.education || null,
        university: formData.university || null, source: formData.source || null,
      }).eq('id', editCandidate.id)
      await saveCandidateSkills(editCandidate.id, formData.skills)
      const { data } = await supabase.from('cv_candidates')
        .select(`*, cv_jobs(title,level), cv_candidate_skills(cv_skills(id,name,category))`).eq('id', editCandidate.id).single()
      if (data) {
        setCandidates(prev => prev.map(c => c.id === editCandidate.id ? data as Candidate : c))
        setEditCandidate(null); resetForm(); toast.success('Cập nhật thông tin ứng viên thành công!')
      }
    } catch (err: any) { toast.error('Lỗi: ' + (err.message || 'Không thể cập nhật')) }
    finally { setIsSaving(false) }
  }

  const handleViewCandidate = (candidate: Candidate) => { setViewCandidate(candidate) }

  const handleEditCandidate = (candidate: Candidate) => {
    const skills = candidate.cv_candidate_skills?.map(item => item.cv_skills.name) || []
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
    })
    setEditCandidate(candidate)
  }

  const handleViewCV = async (candidate: Candidate) => {
    setIsLoadingCV(true)
    try {
      const { data } = await supabase.from('cv_candidates').select('id,full_name,cv_url,cv_file_name,created_at').eq('id', candidate.id).single()
      if (data) {
        if (!data.cv_url) { toast.warning('Ứng viên chưa có CV'); return }
        setViewCVCandidate(data as Candidate)
      }
    } finally { setIsLoadingCV(false) }
  }

  const handleAnalyzeCV = async (candidate: Candidate) => {
    setIsLoadingAnalyze(true)
    try {
      const { data } = await supabase.from('cv_candidates')
        .select('id,full_name,cv_url,cv_parsed_data,status,cv_candidate_skills(cv_skills(id,name,category))')
        .eq('id', candidate.id).single()
      if (data) {
        if (!data.cv_parsed_data && !data.cv_url) { toast.warning('Ứng viên chưa có CV để phân tích'); return }
        setAnalyzeCVCandidate(data as unknown as Candidate)
      }
    } finally { setIsLoadingAnalyze(false) }
  }

  const confirmDelete = async () => {
    if (!deleteCandidate) return
    try {
      if (deleteCandidate.cv_url) {
        const fn = deleteCandidate.cv_url.split('/').pop()
        if (fn) await supabase.storage.from('cv-files').remove([fn])
      }
      const { error } = await supabase.from('cv_candidates').delete().eq('id', deleteCandidate.id)
      if (error) throw error
      try { await ActivityLogger.logCVDeleted(deleteCandidate.full_name) } catch (_) {}
      setCandidates(prev => prev.filter(c => c.id !== deleteCandidate.id))
      setDeleteCandidate(null); toast.success('Đã xóa ứng viên thành công!')
    } catch (err: any) { toast.error('Lỗi khi xóa: ' + (err.message || 'Không xác định')) }
  }

  const exportCSV = () => {
    const headers = ['ID','Full Name','Email','Phone','Status','Source','Source Note','Position','Level']
    const blob = new Blob([
      [headers.join(','), ...filteredCandidates.map(c => [
        c.id, `"${c.full_name.replace(/"/g,'""')}"`, c.email,
        c.phone_number||'', c.status, c.source, c.source_note||'',
        c.cv_jobs?.title||'', c.cv_jobs?.level||''
      ].join(','))].join('\n')
    ], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'candidates.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success(`Đã xuất ${filteredCandidates.length} ứng viên ra file CSV`)
  }

  const uniquePositions = Array.from(new Set(candidates.map(c => c.cv_jobs?.title).filter((v): v is string => !!v)))
  const uniqueLevels = Array.from(new Set(candidates.map(c => c.cv_jobs?.level).filter((v): v is string => !!v)))
  const uniqueStatuses = ['Mới','Sàng lọc','Phỏng vấn','Chấp nhận','Từ chối']

  const filteredCandidates = candidates.filter(c => {
    const q = searchQuery.toLowerCase()
    return (
      (!q || c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.cv_jobs?.title||'').toLowerCase().includes(q)) &&
      (filterStatus === 'all' || c.status === filterStatus) &&
      (filterPosition === 'all' || c.cv_jobs?.title === filterPosition) &&
      (filterLevel === 'all' || c.cv_jobs?.level === filterLevel) &&
      (filterSource === 'all' || c.source === filterSource)
    )
  }).slice(0, 100)

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Quản lý ứng viên</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">Quản lý và theo dõi tất cả ứng viên</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={() => setIsCategoryDialogOpen(true)}>
            <Tag className="w-4 h-4" />Danh mục
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCandidates} className="hidden sm:flex">Làm mới</Button>

          {/* Import CSV button */}
          <Button variant="outline" size="sm"
            className="hidden sm:flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
            onClick={() => setIsImportOpen(true)}>
            <Upload className="w-4 h-4" />Import CSV
          </Button>
          <Button variant="outline" size="icon" className="sm:hidden border-green-200 text-green-700"
            onClick={() => setIsImportOpen(true)}>
            <Upload className="w-4 h-4" />
          </Button>

          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0 text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9"
            onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Thêm ứng viên</span>
            <span className="sm:hidden">Thêm</span>
          </Button>
        </div>
      </div>

      {/* Import CSV Dialog */}
      <ImportCsvDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        jobs={jobs}
        sources={sources}
        onImportDone={fetchCandidates}
      />

      {/* Dialog Thêm ứng viên */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold">Thêm ứng viên mới</DialogTitle>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Các trường có dấu (*) là bắt buộc.</p>
          </DialogHeader>

          <div className="flex flex-row w-full gap-1.5 sm:gap-2 mt-3 sm:mt-4">
            {(['basic','cv'] as const).map(tab => (
              <button key={tab}
                className={`flex-1 min-w-0 px-1 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-medium transition-colors rounded-lg ${
                  currentTab === tab ? 'bg-blue-50 text-blue-600 border-2 border-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                onClick={() => setCurrentTab(tab)}>
                {tab === 'basic' ? 'Thông tin cơ bản' : 'CV & Tài liệu'}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3 sm:space-y-4">
            {currentTab === 'basic' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                    <Input placeholder="Nhập họ tên đầy đủ" value={formData.full_name} onChange={(e: any) => handleInputChange('full_name', e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
                    <Input type="email" placeholder="example@email.com" value={formData.email} onChange={(e: any) => handleInputChange('email', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label>
                    <Input placeholder="0123456789" value={formData.phone_number} onChange={(e: any) => handleInputChange('phone_number', e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Vị trí ứng tuyển <span className="text-red-500">*</span></label>
                    <Select value={formData.job_id} onValueChange={(v: any) => handleInputChange('job_id', v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Chọn vị trí" /></SelectTrigger>
                      <SelectContent className="bg-white z-[60] shadow-lg border border-gray-200 max-h-[300px]">
                        {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title} - {j.level}</SelectItem>)}
                      </SelectContent>
                    </Select></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Địa chỉ</label>
                  <Input placeholder="Nhập địa chỉ" value={formData.address} onChange={(e: any) => handleInputChange('address', e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Trường học</label>
                  <Input placeholder="VD: Đại học Bách Khoa TP.HCM" value={formData.university} onChange={(e: any) => handleInputChange('university', e.target.value)} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Kinh nghiệm</label>
                    <Textarea className="min-h-20 resize-none" value={formData.experience} onChange={(e: any) => handleInputChange('experience', e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Học vấn</label>
                    <Textarea className="min-h-20 resize-none" value={formData.education} onChange={(e: any) => handleInputChange('education', e.target.value)} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">Nguồn ứng tuyển</label>
                    <button type="button" className="text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={() => setIsCategoryDialogOpen(true)}>
                      <Tag className="w-3 h-3" />Quản lý nguồn
                    </button>
                  </div>
                  <Select value={formData.source} onValueChange={(v: any) => handleInputChange('source', v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Chọn nguồn" /></SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">{renderSourceItems()}</SelectContent>
                  </Select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Kỹ năng</label>
                  <SkillsInput value={formData.skills} onChange={(v: any) => handleInputChange('skills', v)} placeholder="Nhập kỹ năng và nhấn Enter" /></div>
              </>
            )}

            {currentTab === 'cv' && (
              <div className="space-y-3">
                <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400'}`}>
                  <input type="file" id="cv-upload" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileSelect} disabled={isUploading} />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600" />
                      <p className="text-sm font-medium text-blue-700">Đang phân tích CV...</p>
                    </div>
                  ) : selectedFile ? (
                    <div className="space-y-2">
                      <FileText className="h-12 w-12 mx-auto text-green-600" />
                      <p className="text-sm font-medium text-green-700">✓ {selectedFile.name}</p>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedFile(null); setParsedData(null) }}>Xóa file</Button>
                    </div>
                  ) : (
                    <label htmlFor="cv-upload" className="cursor-pointer block">
                      <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 mb-2">Click để chọn file CV</p>
                      <Button variant="outline" size="sm" type="button">Chọn file</Button>
                      <p className="text-xs text-gray-500 mt-2">Hỗ trợ: PDF, DOCX, TXT (tối đa 5MB)</p>
                    </label>
                  )}
                </div>
                {parsedData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-700 space-y-1">
                    <p className="font-medium text-blue-900">✓ Đã phân tích CV thành công</p>
                    {parsedData.email && <p>• Email: {parsedData.email}</p>}
                    {parsedData.phone && <p>• SĐT: {parsedData.phone}</p>}
                    {parsedData.university && <p>• Trường: {parsedData.university}</p>}
                    {(parsedData.skills?.length ?? 0) > 0 && <p>• Skills: {parsedData.skills?.join(', ')}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-2" />Reset</Button>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }} disabled={isSaving}>Hủy</Button>
            <Button className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmit} disabled={isSaving}>
              <Plus className="w-4 h-4 mr-2" />{isSaving ? 'Đang lưu...' : 'Thêm ứng viên'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Xem thông tin */}
      <Dialog open={!!viewCandidate} onOpenChange={() => setViewCandidate(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader><DialogTitle>Thông tin ứng viên</DialogTitle></DialogHeader>
          {viewCandidate && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-14 w-14 border-2 border-blue-200">
                  <AvatarFallback className="text-xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                    {viewCandidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-bold">{viewCandidate.full_name}</h3>
                  <p className="text-sm text-gray-500">{viewCandidate.cv_jobs?.title || 'N/A'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(viewCandidate.status)}
                    {getSourceNoteBadge(viewCandidate.source_note)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[['Email', viewCandidate.email], ['SĐT', viewCandidate.phone_number||'N/A'],
                  ['Địa chỉ', viewCandidate.address||'N/A'], ['Trường', viewCandidate.university||'N/A'],
                  ['Cấp độ', viewCandidate.cv_jobs?.level||'N/A'], ['Nguồn', viewCandidate.source||'N/A']
                ].map(([l, v]) => (
                  <div key={l}><label className="text-xs font-medium text-gray-500">{l}</label><p className="text-sm text-gray-900 break-all">{v}</p></div>
                ))}
              </div>
              <div><label className="text-xs font-medium text-gray-500">Kinh nghiệm</label><p className="text-sm mt-1">{viewCandidate.experience||'Chưa có'}</p></div>
              <div><label className="text-xs font-medium text-gray-500">Học vấn</label><p className="text-sm mt-1">{viewCandidate.education||'Chưa có'}</p></div>
              <div>
                <label className="text-xs font-medium text-gray-500">Kỹ năng</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(viewCandidate.cv_candidate_skills?.length ?? 0) > 0
                    ? viewCandidate.cv_candidate_skills?.map((item, i) => (
                        <Badge key={i} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{item.cv_skills.name}</Badge>
                      ))
                    : <p className="text-sm text-gray-500">Chưa có</p>}
                </div>
              </div>
              <div><label className="text-xs font-medium text-gray-500">Ngày ứng tuyển</label>
                <p className="text-sm">{new Date(viewCandidate.created_at).toLocaleDateString('vi-VN')}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Chỉnh sửa */}
      <Dialog open={!!editCandidate} onOpenChange={() => { setEditCandidate(null); resetForm() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Chỉnh sửa thông tin ứng viên</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium mb-1.5">Họ và tên *</label>
                <Input value={formData.full_name} onChange={(e: any) => handleInputChange('full_name', e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1.5">Email *</label>
                <Input type="email" value={formData.email} onChange={(e: any) => handleInputChange('email', e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1.5">Số điện thoại</label>
                <Input value={formData.phone_number} onChange={(e: any) => handleInputChange('phone_number', e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1.5">Địa chỉ</label>
                <Input value={formData.address} onChange={(e: any) => handleInputChange('address', e.target.value)} /></div>
            </div>
            <div><label className="block text-sm font-medium mb-1.5">Trường học</label>
              <Input value={formData.university} onChange={(e: any) => handleInputChange('university', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium mb-1.5">Kinh nghiệm</label>
                <Textarea className="min-h-20 resize-none" value={formData.experience} onChange={(e: any) => handleInputChange('experience', e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1.5">Học vấn</label>
                <Textarea className="min-h-20 resize-none" value={formData.education} onChange={(e: any) => handleInputChange('education', e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium">Nguồn</label>
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setIsCategoryDialogOpen(true)}>Quản lý</button>
              </div>
              <Select value={formData.source} onValueChange={(v: any) => handleInputChange('source', v)}>
                <SelectTrigger><SelectValue placeholder="Chọn nguồn" /></SelectTrigger>
                <SelectContent className="bg-white z-50 border border-gray-200">{renderSourceItems()}</SelectContent>
              </Select>
            </div>
            <div><label className="block text-sm font-medium mb-1.5">Kỹ năng</label>
              <SkillsInput value={formData.skills} onChange={(v: any) => handleInputChange('skills', v)} placeholder="Nhập kỹ năng và nhấn Enter" /></div>
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setEditCandidate(null); resetForm() }}>Hủy</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleUpdateCandidate} disabled={isSaving}>
                {isSaving ? 'Đang lưu...' : 'Cập nhật'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Xem CV */}
      <Dialog open={!!viewCVCandidate || isLoadingCV} onOpenChange={() => setViewCVCandidate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader><DialogTitle>CV - {viewCVCandidate?.full_name}</DialogTitle></DialogHeader>
          {isLoadingCV ? (
            <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" /></div>
          ) : viewCVCandidate?.cv_url ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div><p className="font-medium">{viewCVCandidate.cv_file_name}</p></div>
                <a href={viewCVCandidate.cv_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Download className="w-4 h-4" />Tải xuống
                </a>
              </div>
              <iframe src={viewCVCandidate.cv_url} className="w-full h-[600px] border rounded-lg" title="CV" />
            </div>
          ) : (
            <div className="text-center py-12"><FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" /><p className="text-gray-500">Ứng viên chưa upload CV</p></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Phân tích CV */}
      <Dialog open={!!analyzeCVCandidate || isLoadingAnalyze} onOpenChange={() => setAnalyzeCVCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader><DialogTitle>Phân tích CV - {analyzeCVCandidate?.full_name}</DialogTitle></DialogHeader>
          {isLoadingAnalyze ? (
            <div className="text-center py-8 sm:py-12">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-3 sm:mt-4 text-xs sm:text-sm">Đang tải dữ liệu phân tích...</p>
            </div>
          ) : analyzeCVCandidate?.cv_parsed_data ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Thông tin trích xuất từ CV</h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  {analyzeCVCandidate.cv_parsed_data.email && <div><span className="font-medium">Email:</span> {analyzeCVCandidate.cv_parsed_data.email}</div>}
                  {analyzeCVCandidate.cv_parsed_data.phone && <div><span className="font-medium">Số điện thoại:</span> {analyzeCVCandidate.cv_parsed_data.phone}</div>}
                  {analyzeCVCandidate.cv_parsed_data.university && <div><span className="font-medium">Trường học:</span> {analyzeCVCandidate.cv_parsed_data.university}</div>}
                  {(analyzeCVCandidate.cv_parsed_data.skills?.length ?? 0) > 0 && (
                    <div>
                      <span className="font-medium">Kỹ năng phát hiện từ CV:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {analyzeCVCandidate.cv_parsed_data.skills?.map((skill: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="bg-white">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(analyzeCVCandidate?.cv_candidate_skills?.length ?? 0) > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Kỹ năng đã lưu trong hệ thống</h4>
                  <div className="flex flex-wrap gap-2">
                    {analyzeCVCandidate?.cv_candidate_skills?.map((item: any, idx: number) => (
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
                  <p>• Số kỹ năng đã lưu: {analyzeCVCandidate?.cv_candidate_skills?.length || 0}</p>
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
          <DialogHeader><DialogTitle>Bộ lọc nâng cao</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {[
              { label:'Trạng thái', val:tempFilterStatus, set:setTempFilterStatus,
                items: uniqueStatuses.map(s => ({v:s,l:s})), placeholder:'Tất cả trạng thái' },
              { label:'Vị trí', val:tempFilterPosition, set:setTempFilterPosition,
                items: uniquePositions.map(p => ({v:p,l:p})), placeholder:'Tất cả vị trí' },
              { label:'Cấp độ', val:tempFilterLevel, set:setTempFilterLevel,
                items: uniqueLevels.map(l => ({v:l,l})), placeholder:'Tất cả cấp độ' },
            ].map(({ label, val, set, items, placeholder }) => (
              <div key={label}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <Select value={val} onValueChange={set}>
                  <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
                  <SelectContent className="bg-white z-[60] shadow-lg border border-gray-200">
                    <SelectItem value="all">{placeholder}</SelectItem>
                    {items.map(i => <SelectItem key={i.v} value={i.v}>{i.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nguồn</label>
              <Select value={tempFilterSource} onValueChange={setTempFilterSource}>
                <SelectTrigger><SelectValue placeholder="Tất cả nguồn" /></SelectTrigger>
                <SelectContent className="z-[60] bg-white shadow-lg border border-gray-200">
                  <SelectItem value="all">Tất cả nguồn</SelectItem>
                  {renderSourceItems()}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTempFilterStatus('all'); setTempFilterPosition('all'); setTempFilterLevel('all'); setTempFilterSource('all') }}>Reset</Button>
            <Button onClick={() => { setFilterStatus(tempFilterStatus); setFilterPosition(tempFilterPosition); setFilterLevel(tempFilterLevel); setFilterSource(tempFilterSource); setIsFilterOpen(false) }}>Áp dụng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {[
          { label:'Tổng ứng viên', value:candidates.length, icon:<TrendingUp className="inline h-4 w-4 mr-1 text-green-500"/>, note:'+20.1% tháng trước' },
          { label:'Ứng viên mới', value:candidates.filter(c=>c.status==='Mới').length, icon:<Users className="inline h-4 w-4 mr-1 text-blue-500"/>, note:'Trong tuần này' },
        ].map(s => (
          <Card key={s.label} className="shadow-sm border-2 border-gray-100">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{s.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground">{s.icon}{s.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1 min-w-0">
          <div className="relative min-w-[180px] sm:min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input className="pl-9" placeholder="Tìm theo tên, email, vị trí..." value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsFilterOpen(true)}>
            <Filter className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Bộ lọc nâng cao</span>
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="hidden sm:flex">
          <Download className="mr-2 h-4 w-4" />Xuất CSV
        </Button>
      </div>

      {/* Candidates table */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 mt-4 text-sm">Đang tải dữ liệu ứng viên...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Không tìm thấy ứng viên</h3>
          <p className="text-sm text-gray-500 mt-1">Thử thay đổi bộ lọc hoặc thêm ứng viên mới</p>
        </div>
      ) : (
        <Card className="shadow-sm border-2 border-gray-100 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[270px]">Ứng viên</TableHead>
                  <TableHead>Vị trí</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Kỹ năng</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map(c => (
                  <TableRow key={c.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border-2 border-blue-200">
                          <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                            {c.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{c.full_name}</div>
                          <div className="text-xs text-gray-500 truncate">{c.email}</div>
                          {/* ── source_note badge ─────────────────────────── */}
                          {c.source_note && (
                            <div className="mt-0.5">{getSourceNoteBadge(c.source_note)}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.cv_jobs ? <div><div className="font-medium text-sm">{c.cv_jobs.title}</div><div className="text-xs text-gray-500">{c.cv_jobs.level}</div></div> : 'N/A'}
                    </TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[300px]">
                        {c.cv_candidate_skills?.slice(0, 3).map((item, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{item.cv_skills.name}</Badge>
                        ))}
                        {(c.cv_candidate_skills?.length ?? 0) > 3 && (
                          <Badge variant="secondary" className="text-xs">+{(c.cv_candidate_skills?.length ?? 0) - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[60] bg-white shadow-lg border border-gray-200">
                          <DropdownMenuItem onClick={() => handleViewCandidate(c)} className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-600" /><span>Xem thông tin</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditCandidate(c)} className="flex items-center gap-2">
                            <Edit className="h-4 w-4 text-green-600" /><span>Chỉnh sửa</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewCV(c)} className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-purple-600" /><span>Xem CV</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAnalyzeCV(c)} className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-orange-600" /><span>Phân tích CV</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteCandidate(c)} className="flex items-center gap-2 text-red-600">
                            <Trash2 className="h-4 w-4" /><span>Xóa ứng viên</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 p-3">
            {filteredCandidates.map(c => (
              <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors shadow-sm">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 border-2 border-blue-200">
                    <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                      {c.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{c.full_name}</h3>
                    <p className="text-sm text-gray-500 truncate">{c.email}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {getStatusBadge(c.status)}
                      {c.cv_jobs && <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{c.cv_jobs.title}</span>}
                      {/* ── source_note badge (mobile) ── */}
                      {c.source_note && getSourceNoteBadge(c.source_note)}
                    </div>
                  </div>
                </div>
                {(c.cv_candidate_skills?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.cv_candidate_skills?.slice(0, 4).map((item, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{item.cv_skills.name}</Badge>
                    ))}
                    {(c.cv_candidate_skills?.length ?? 0) > 4 && <Badge variant="secondary" className="text-xs">+{(c.cv_candidate_skills?.length ?? 0) - 4}</Badge>}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('vi-VN')}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewCandidate(c)}><Eye className="h-4 w-4 text-blue-600" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCandidate(c)}>
                      <Edit className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewCV(c)}><FileText className="h-4 w-4 text-purple-600" /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-white z-[60] shadow-lg border border-gray-200">
                        <DropdownMenuItem onClick={() => handleAnalyzeCV(c)}><Brain className="mr-2 h-4 w-4 text-orange-600" />Phân tích CV</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteCandidate(c)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Xóa ứng viên</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Delete confirm */}
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
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category manager */}
      <CandidateCategoryDialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen} onCategoriesUpdated={fetchSources} />
    </div>
  )
}

export default CandidatesPage