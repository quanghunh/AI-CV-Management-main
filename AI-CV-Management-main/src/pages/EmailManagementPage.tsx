// src/pages/EmailManagementPage.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, Plus, Mail, Send, Clock, FileText, Eye,
  Filter, Sparkles, Users, CheckCircle, CheckCircle2,
  AlertCircle, RefreshCw, X, ChevronDown, Briefcase,
  History, BarChart2, Loader2, Settings, ExternalLink,
  Copy, Trash2, Star
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select, SelectContent, SelectTrigger, SelectValue, SelectItem
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailCategory { id: string; name: string; description?: string }

interface EmailTemplate {
  id: string; name: string; subject: string; body: string
  category_id: string; variables?: string[]; is_default?: boolean
  usage_count?: number; created_at?: string
  email_categories: EmailCategory | null
}

interface EmailHistory {
  id: string; subject: string; status: string; sent_at: string
  candidate_id?: string; external_id?: string
  cv_candidates?: { full_name: string; email: string } | null
  cv_email_templates?: { name: string } | null
}

interface Candidate {
  id: string; full_name: string; email: string
  status: string; job_id?: string
  cv_jobs?: { title: string } | null
}

type SendStatus = 'idle' | 'sending' | 'success' | 'error'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Interview:  'bg-purple-50 text-purple-700 border-purple-200',
  Offer:      'bg-orange-50 text-orange-700 border-orange-200',
  Rejection:  'bg-red-50 text-red-700 border-red-200',
  General:    'bg-blue-50 text-blue-700 border-blue-200',
  Reminder:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Follow-up':'bg-green-50 text-green-700 border-green-200',
  Other:      'bg-gray-50 text-gray-700 border-gray-200',
}

function CategoryBadge({ name }: { name: string }) {
  return (
    <Badge variant="outline" className={CATEGORY_COLORS[name] || CATEGORY_COLORS.Other}>
      {name}
    </Badge>
  )
}

/** Build production-ready HTML wrapper around plain email body */
function wrapEmailHtml(body: string, subject: string, senderName: string): string {
  const safeBody = body
    .replace(/\n/g, '<br/>')
    .replace(/\{\{([^}]+)\}\}/g, '<span style="color:#3b82f6;font-weight:500">{{$1}}</span>')

  return `<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${subject}</title>
<style>
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f4f7fa;color:#1f2937;line-height:1.6;font-size:16px}
.wrap{width:100%;max-width:640px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.07)}
.head{padding:28px 40px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:14px;background:#f9fafb}
.logo{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;flex-shrink:0}
.title-block .title{font-size:18px;font-weight:600;color:#111827}
.title-block .sub{font-size:12px;color:#6b7280;margin-top:2px}
.body{padding:36px 40px;color:#374151}
.foot{padding:20px 40px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;text-align:center;background:#f9fafb}
.foot a{color:#3b82f6;text-decoration:none}
@media(max-width:640px){.wrap{margin:16px}.head,.body,.foot{padding:24px 24px}}
</style>
</head><body>
<div class="wrap">
  <div class="head">
    <div class="logo">RA</div>
    <div class="title-block">
      <div class="title">${senderName}</div>
      <div class="sub">Hệ thống tuyển dụng tự động</div>
    </div>
  </div>
  <div class="body">${safeBody}</div>
  <div class="foot">
    Email tự động từ ${senderName}. Vui lòng không trả lời email này.<br/>
    <a href="#">Hủy nhận thông báo</a>
  </div>
</div>
</body></html>`
}

// ─── CandidateSearchDropdown ──────────────────────────────────────────────────

interface CandidateSearchProps {
  selected: Candidate | null
  onSelect: (c: Candidate | null) => void
}

function CandidateSearchDropdown({ selected, onSelect }: CandidateSearchProps) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState<Candidate[]>([])
  const [results, setResults] = useState<Candidate[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('cv_candidates')
        .select('id, full_name, email, status, job_id, cv_jobs!job_id(title)')
        .order('full_name')
      if (data) {
        const mapped = data.map((c: any) => ({
          ...c,
          cv_jobs: Array.isArray(c.cv_jobs) ? c.cv_jobs[0] ?? null : c.cv_jobs ?? null
        })) as Candidate[]
        setAll(mapped)
        setResults(mapped.slice(0, 40))
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    setResults(q
      ? all.filter(c =>
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.cv_jobs?.title || '').toLowerCase().includes(q)
        ).slice(0, 40)
      : all.slice(0, 40)
    )
  }, [query, all])

  if (selected) {
    return (
      <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="text-xs bg-gradient-to-br from-blue-400 to-purple-500 text-white">
            {selected.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900 truncate">{selected.full_name}</p>
          <p className="text-xs text-blue-600 truncate">{selected.email}</p>
          {selected.cv_jobs && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
              <Briefcase className="h-3 w-3" />{selected.cv_jobs.title}
            </p>
          )}
        </div>
        <button type="button" onClick={() => onSelect(null)}
          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Tìm theo tên, email hoặc vị trí ứng tuyển..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {results.length} ứng viên{query ? ` khớp "${query}"` : ''}
            </span>
            <button type="button" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {results.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Không tìm thấy ứng viên</div>
            ) : results.map(c => (
              <button key={c.id} type="button"
                onClick={() => { onSelect(c); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-blue-50 transition-colors">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                    {c.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.email}</p>
                  {c.cv_jobs && (
                    <p className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                      <Briefcase className="h-3 w-3" />{c.cv_jobs.title}
                    </p>
                  )}
                </div>
                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-gray-100 text-gray-600 flex-shrink-0">
                  {c.status}
                </Badge>
              </button>
            ))}
          </div>
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">Nhập tên hoặc email để lọc nhanh</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmailManagementPage() {
  // ── email config state ─────────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState('')
  const [senderName, setSenderName] = useState('Recruit AI')
  const [fromEmail, setFromEmail] = useState('onboarding@resend.dev')
  const [isConfigured, setIsConfigured] = useState(false)
  const [configChecking, setConfigChecking] = useState(false)

  // ── data state ─────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [categories, setCategories] = useState<EmailCategory[]>([])
  const [history, setHistory] = useState<EmailHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [stats, setStats] = useState({ totalSent: 0, openRate: '0.0', waiting: 0, totalTemplates: 0 })

  // ── ui state ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'templates' | 'history'>('templates')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // ── compose dialog ─────────────────────────────────────────────────────────
  const [composeOpen, setComposeOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [composeForm, setComposeForm] = useState({
    template_id: '', subject: '', body: '', cc: '', priority: 'normal'
  })
  const [composeSendStatus, setComposeSendStatus] = useState<SendStatus>('idle')

  // ── template create dialog ─────────────────────────────────────────────────
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState({
    name: '', subject: '', body: '', category_id: '', is_default: false
  })
  const [templateSaving, setTemplateSaving] = useState(false)

  // ── view template dialog ───────────────────────────────────────────────────
  const [viewTemplate, setViewTemplate] = useState<EmailTemplate | null>(null)

  // ── test email dialog ──────────────────────────────────────────────────────
  const [testOpen, setTestOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testTemplateId, setTestTemplateId] = useState('')
  const [testSendStatus, setTestSendStatus] = useState<SendStatus>('idle')

  // ── load email config ──────────────────────────────────────────────────────

  const loadEmailConfig = useCallback(async () => {
    setConfigChecking(true)
    try {
      // 1. localStorage first (fast path)
      const lsKey = localStorage.getItem('resend_api_key')
      const lsFrom = localStorage.getItem('resend_from_email')
      const lsName = localStorage.getItem('resend_sender_name')
      if (lsKey && lsKey !== 'EMPTY') {
        setApiKey(lsKey)
        if (lsFrom) setFromEmail(lsFrom)
        if (lsName) setSenderName(lsName)
        setIsConfigured(true)
        return
      }

      // 2. DB
      const { data } = await supabase
        .from('cv_email_settings')
        .select('resend_api_key, sending_email, sender_name')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data?.resend_api_key) {
        setApiKey(data.resend_api_key)
        if (data.sending_email) setFromEmail(data.sending_email)
        if (data.sender_name) setSenderName(data.sender_name)
        setIsConfigured(true)
        localStorage.setItem('resend_api_key', data.resend_api_key)
        if (data.sending_email) localStorage.setItem('resend_from_email', data.sending_email)
        if (data.sender_name) localStorage.setItem('resend_sender_name', data.sender_name)
      } else {
        setIsConfigured(false)
      }
    } catch (err) {
      console.error(err)
      setIsConfigured(false)
    } finally {
      setConfigChecking(false)
    }
  }, [])

  // ── data fetch ─────────────────────────────────────────────────────────────

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('cv_email_templates')
      .select('*, cv_email_categories(id, name, description)')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
    if (data) {
      setTemplates(data.map((t: any) => ({
        ...t, email_categories: t.cv_email_categories || null
      })) as EmailTemplate[])
    }
    if (error) console.error(error)
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('cv_email_categories').select('*').order('name')
    if (data) setCategories(data as EmailCategory[])
  }

  const fetchStats = async () => {
    const [{ count: sent }, { count: waiting }, { count: tmpl }] = await Promise.all([
      supabase.from('cv_emails').select('*', { count:'exact', head:true }).eq('status', 'sent'),
      supabase.from('cv_email_queue').select('*', { count:'exact', head:true }).eq('status', 'pending'),
      supabase.from('cv_email_templates').select('*', { count:'exact', head:true }).eq('is_active', true),
    ])
    setStats({ totalSent: sent || 0, openRate: '—', waiting: waiting || 0, totalTemplates: tmpl || 0 })
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('cv_emails')
      .select(`
        id, subject, status, sent_at, candidate_id, external_id,
        cv_candidates!candidate_id ( full_name, email ),
        cv_email_templates!template_id ( name )
      `)
      .order('sent_at', { ascending: false })
      .limit(50)
    if (data) setHistory(data as EmailHistory[])
    setHistoryLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchTemplates(), fetchCategories(), fetchStats(), loadEmailConfig()])
      .finally(() => setLoading(false))

    // listen for settings change from other windows/tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'email_settings_updated') loadEmailConfig()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [loadEmailConfig])

  useEffect(() => {
    if (tab === 'history') fetchHistory()
  }, [tab])

  // ── core send function ────────────────────────────────────────────────────

  const sendEmailViaResend = async (opts: {
    to: string[]; subject: string; body: string
    cc?: string[]; templateId?: string; candidateId?: string
  }): Promise<{ success: boolean; error?: string }> => {
    if (!apiKey) {
      await loadEmailConfig()
      if (!apiKey) return { success: false, error: 'API key chưa cấu hình' }
    }

    try {
      const html = wrapEmailHtml(opts.body, opts.subject, senderName)
      const payload: Record<string, any> = {
        from: `${senderName} <${fromEmail}>`,
        to: opts.to,
        subject: opts.subject,
        html,
        text: opts.body.replace(/<[^>]+>/g, ''),
      }
      if (opts.cc?.length) payload.cc = opts.cc

      const res = await fetch('/proxy/resend/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message || `HTTP ${res.status}`)
      }

      const resData = await res.json().catch(() => ({}))

      // record in DB
      await supabase.from('cv_emails').insert([{
        candidate_id: opts.candidateId || null,
        template_id: opts.templateId || null,
        subject: opts.subject,
        body: opts.body,
        composition_type: 'manual',
        status: 'sent',
        sent_at: new Date().toISOString(),
        external_id: (resData as any).id || null,
      }])

      // bump usage count
      if (opts.templateId) {
        await supabase.rpc('increment_template_usage', { template_id: opts.templateId })
          .catch(() => {})
      }

      return { success: true }
    } catch (err: any) {
      console.error('sendEmailViaResend error:', err)
      return { success: false, error: err.message }
    }
  }

  // ── compose submit ────────────────────────────────────────────────────────

  const handleComposeSubmit = async () => {
    if (!selectedCandidate) { alert('Vui lòng chọn ứng viên'); return }
    if (!composeForm.subject.trim()) { alert('Vui lòng nhập tiêu đề'); return }
    if (!composeForm.body.trim()) { alert('Vui lòng nhập nội dung'); return }
    if (!isConfigured) { alert('Vui lòng cấu hình email trong Cài đặt trước.'); return }

    setComposeSendStatus('sending')
    const cc = composeForm.cc
      ? composeForm.cc.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const result = await sendEmailViaResend({
      to: [selectedCandidate.email],
      subject: composeForm.subject,
      body: composeForm.body,
      cc,
      templateId: composeForm.template_id || undefined,
      candidateId: selectedCandidate.id,
    })

    if (result.success) {
      setComposeSendStatus('success')
      fetchStats()
      setTimeout(() => {
        setComposeSendStatus('idle')
        setComposeOpen(false)
        resetCompose()
        if (tab === 'history') fetchHistory()
      }, 1500)
    } else {
      setComposeSendStatus('error')
      alert('Gửi email thất bại: ' + result.error)
      setTimeout(() => setComposeSendStatus('idle'), 3000)
    }
  }

  const resetCompose = () => {
    setSelectedCandidate(null)
    setComposeForm({ template_id:'', subject:'', body:'', cc:'', priority:'normal' })
  }

  // ── use template ──────────────────────────────────────────────────────────

  const handleUseTemplate = (t: EmailTemplate) => {
    setComposeForm(prev => ({
      ...prev, template_id: t.id, subject: t.subject, body: t.body
    }))
    setComposeOpen(true)
  }

  // ── create template ───────────────────────────────────────────────────────

  const handleCreateTemplate = async () => {
    const { name, subject, body, category_id } = templateForm
    if (!name || !subject || !body || !category_id) {
      alert('Vui lòng điền đầy đủ thông tin')
      return
    }
    setTemplateSaving(true)
    try {
      const variables = (body.match(/\{\{(\w+)\}\}/g) || []).map(v => v.replace(/[{}]/g, ''))
      const { data, error } = await supabase
        .from('cv_email_templates')
        .insert([{
          name, subject, body, category_id,
          variables, is_default: templateForm.is_default,
          is_active: true, usage_count: 0,
        }])
        .select('*, cv_email_categories(id, name)')
        .single()
      if (error) throw error
      setTemplates(prev => [{
        ...data,
        email_categories: (data as any).cv_email_categories || null
      } as EmailTemplate, ...prev])
      setTemplateOpen(false)
      setTemplateForm({ name:'', subject:'', body:'', category_id:'', is_default:false })
      fetchStats()
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setTemplateSaving(false)
    }
  }

  // ── test email ────────────────────────────────────────────────────────────

  const handleTestEmail = async () => {
    if (!testEmail.trim()) { alert('Vui lòng nhập email nhận'); return }
    if (!testTemplateId) { alert('Vui lòng chọn template'); return }
    if (!isConfigured) { alert('Vui lòng cấu hình email trước'); return }

    const template = templates.find(t => t.id === testTemplateId)
    if (!template) return

    setTestSendStatus('sending')
    const result = await sendEmailViaResend({
      to: [testEmail.trim()],
      subject: `[TEST] ${template.subject}`,
      body: template.body,
    })
    if (result.success) {
      setTestSendStatus('success')
      setTimeout(() => { setTestSendStatus('idle'); setTestOpen(false) }, 2000)
    } else {
      setTestSendStatus('error')
      alert('Gửi thất bại: ' + result.error)
      setTimeout(() => setTestSendStatus('idle'), 3000)
    }
  }

  // ── filter ────────────────────────────────────────────────────────────────

  const filteredTemplates = templates.filter(t => {
    const q = searchQuery.toLowerCase()
    return (
      (t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)) &&
      (selectedCategory === 'all' || t.category_id === selectedCategory)
    )
  })

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile not supported */}
      <div className="sm:hidden flex flex-col items-center justify-center min-h-[80vh] p-6 text-center space-y-4">
        <div className="bg-gray-100 p-4 rounded-full">
          <Mail className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Không hỗ trợ di động</h2>
        <p className="text-gray-500">Tính năng Email chỉ khả dụng trên màn hình lớn.</p>
      </div>

      {/* Desktop */}
      <div className="hidden sm:block min-h-screen bg-gray-50/50 p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Mail className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Quản lý Email</h1>
              <p className="text-sm text-muted-foreground">
                {stats.totalTemplates} mẫu email · {categories.length} danh mục · {stats.totalSent} đã gửi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />Test Email
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Tạo Template
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setComposeOpen(true)}>
              <Send className="mr-2 h-4 w-4" />Soạn Email
            </Button>
          </div>
        </div>

        {/* ── Config banner ──────────────────────────────────────────────── */}
        {isConfigured ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 flex-1">
              <strong>Email đã cấu hình.</strong> Gửi từ{' '}
              <strong>{senderName}</strong> &lt;{fromEmail}&gt;
            </p>
            <Button variant="ghost" size="sm" onClick={loadEmailConfig} disabled={configChecking}
              className="text-green-700 hover:text-green-900">
              <RefreshCw className={`h-4 w-4 ${configChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
            <p className="text-sm text-orange-800 flex-1">
              <strong>Chưa cấu hình email.</strong> Vào{' '}
              <strong>Cài đặt → Email</strong> để thêm Resend API Key trước khi gửi.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadEmailConfig} disabled={configChecking}>
                {configChecking
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Kiểm tra...</>
                  : <><RefreshCw className="h-4 w-4 mr-2" />Kiểm tra lại</>}
              </Button>
              <a href="/settings#email">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />Cấu hình
                  <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label:'Email đã gửi', value:stats.totalSent, icon:<Send className="h-6 w-6 text-white"/>, color:'bg-blue-600' },
            { label:'Tỷ lệ mở',     value:stats.openRate === '—' ? '—' : `${stats.openRate}%`, icon:<Mail className="h-6 w-6 text-white"/>, color:'bg-green-600' },
            { label:'Đang chờ gửi', value:stats.waiting, icon:<Clock className="h-6 w-6 text-white"/>, color:'bg-orange-500' },
            { label:'Mẫu Email',    value:stats.totalTemplates, icon:<FileText className="h-6 w-6 text-white"/>, color:'bg-purple-600' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{s.label}</p>
                    <div className="text-3xl font-bold">{s.value}</div>
                  </div>
                  <div className={`${s.color} p-3 rounded-xl`}>{s.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b">
          {[
            { id:'templates' as const, label:'Templates', icon:<FileText className="h-4 w-4 mr-1.5"/> },
            { id:'history'   as const, label:'Lịch sử gửi', icon:<History className="h-4 w-4 mr-1.5"/> },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center pb-3 px-4 text-sm font-medium transition-colors relative
                ${tab === t.id
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'}`}>
              {t.icon}{t.label}
              {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
          ))}
        </div>

        {/* ── Templates tab ──────────────────────────────────────────────── */}
        {tab === 'templates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Tìm kiếm templates..." className="pl-10 bg-white"
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue placeholder="Tất cả danh mục" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">Tất cả danh mục</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-gray-500">{filteredTemplates.length} templates</p>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-gray-500">Đang tải templates...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-700 mb-1">Không tìm thấy template</p>
                  <p className="text-sm text-gray-500 mb-4">Tạo template đầu tiên để bắt đầu.</p>
                  <Button onClick={() => setTemplateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />Tạo Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map(t => (
                  <Card key={t.id} className="border hover:shadow-md transition-all duration-200 bg-white group">
                    <CardContent className="pt-5 pb-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <h4 className="font-semibold text-sm truncate">{t.name}</h4>
                            {t.is_default && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400 flex-shrink-0" />}
                          </div>
                          <CategoryBadge name={t.email_categories?.name || 'General'} />
                        </div>
                        <button onClick={() => setViewTemplate(t)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors ml-2 flex-shrink-0">
                          <Eye className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>

                      {/* Subject */}
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                        {t.subject}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                        <span>{t.variables?.length || 0} biến</span>
                        <span>Dùng {t.usage_count || 0} lần</span>
                      </div>

                      {/* Action */}
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleUseTemplate(t)}>
                        <Send className="mr-2 h-4 w-4" />Dùng Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── History tab ────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Lịch sử gửi email</h3>
              <Button variant="outline" size="sm" onClick={fetchHistory} disabled={historyLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </div>

            {historyLoading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              </div>
            ) : history.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <History className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-700">Chưa có email nào được gửi</p>
                  <p className="text-sm text-gray-500 mt-1">Gửi email đầu tiên bằng nút "Soạn Email".</p>
                </CardContent>
              </Card>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Người nhận','Tiêu đề','Template','Trạng thái','Thời gian'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {history.map(h => (
                      <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          {h.cv_candidates ? (
                            <div>
                              <p className="font-medium text-gray-900 truncate max-w-[140px]">{h.cv_candidates.full_name}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[140px]">{h.cv_candidates.email}</p>
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="truncate text-gray-800">{h.subject}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {h.cv_email_templates?.name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {h.status === 'sent' ? (
                            <Badge className="bg-green-100 text-green-700 border-0">
                              <CheckCircle className="h-3 w-3 mr-1" />Đã gửi
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{h.status}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {h.sent_at ? new Date(h.sent_at).toLocaleString('vi-VN', {
                            day:'2-digit', month:'2-digit', year:'numeric',
                            hour:'2-digit', minute:'2-digit'
                          }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>{/* end desktop wrapper */}

      {/* ══════════════════════════════════════════════════════════════════
          DIALOGS
      ══════════════════════════════════════════════════════════════════ */}

      {/* ── Compose Email Dialog ──────────────────────────────────────────── */}
      <Dialog open={composeOpen} onOpenChange={o => { if (!o) { setComposeOpen(false); resetCompose() } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />Soạn Email
            </DialogTitle>
            <p className="text-sm text-gray-500">Gửi email tuyển dụng đến ứng viên.</p>
          </DialogHeader>

          <div className="space-y-5 mt-4">

            {/* Recipient */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Users className="h-4 w-4" />Ứng viên nhận <span className="text-red-500">*</span>
              </label>
              <CandidateSearchDropdown
                selected={selectedCandidate}
                onSelect={setSelectedCandidate}
              />
            </div>

            {/* Template picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-500" />Template (tuỳ chọn)
                </label>
                {composeForm.template_id && (
                  <button
                    type="button"
                    onClick={() => setComposeForm(p => ({ ...p, template_id:'', subject:'', body:'' }))}
                    className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />Xóa template
                  </button>
                )}
              </div>

              {composeForm.template_id ? (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                  <p className="font-medium text-purple-900">
                    {templates.find(t => t.id === composeForm.template_id)?.name}
                  </p>
                  <p className="text-xs text-purple-600 mt-0.5">Template đã được áp dụng vào nội dung bên dưới.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {templates.slice(0, 6).map(t => (
                    <button key={t.id} type="button" onClick={() => handleUseTemplate(t)}
                      className="text-left border rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.is_default && <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-300 flex-shrink-0" />}
                      </div>
                      <CategoryBadge name={t.email_categories?.name || 'General'} />
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">{t.subject}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tiêu đề <span className="text-red-500">*</span></label>
              <Input
                value={composeForm.subject}
                onChange={e => setComposeForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Tiêu đề email..."
                className="bg-gray-50"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nội dung <span className="text-red-500">*</span></label>
              <Textarea
                value={composeForm.body}
                onChange={e => setComposeForm(p => ({ ...p, body: e.target.value }))}
                placeholder="Nội dung email... Dùng {{variableName}} cho các biến động."
                className="min-h-[180px] bg-gray-50 font-mono text-sm resize-none"
              />
              <p className="text-xs text-gray-400">
                Biến ví dụ: {`{{candidateName}}, {{position}}, {{interviewDate}}`}
              </p>
            </div>

            {/* CC */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">CC (tuỳ chọn)</label>
              <Input
                value={composeForm.cc}
                onChange={e => setComposeForm(p => ({ ...p, cc: e.target.value }))}
                placeholder="cc1@example.com, cc2@example.com"
                className="bg-gray-50"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="text-sm text-gray-500 flex items-center gap-1.5">
                {selectedCandidate
                  ? <><CheckCircle2 className="h-4 w-4 text-green-500" />{selectedCandidate.email}</>
                  : <><AlertCircle className="h-4 w-4 text-orange-400" />Chưa chọn ứng viên</>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline"
                  onClick={() => { setComposeOpen(false); resetCompose() }}
                  disabled={composeSendStatus === 'sending'}>Hủy</Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                  onClick={handleComposeSubmit}
                  disabled={composeSendStatus === 'sending' || !isConfigured}
                >
                  {composeSendStatus === 'sending' ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang gửi...</>
                  ) : composeSendStatus === 'success' ? (
                    <><CheckCircle2 className="h-4 w-4 mr-2" />Đã gửi!</>
                  ) : composeSendStatus === 'error' ? (
                    <><AlertCircle className="h-4 w-4 mr-2" />Thất bại</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Gửi Email</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Template Dialog ──────────────────────────────────────────── */}
      <Dialog open={templateOpen} onOpenChange={o => { if (!o) setTemplateOpen(false) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />Tạo Email Template mới
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Tên template <span className="text-red-500">*</span></label>
              <Input value={templateForm.name}
                onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                placeholder="VD: Mời phỏng vấn vòng 2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Danh mục <span className="text-red-500">*</span></label>
                <Select value={templateForm.category_id}
                  onValueChange={v => setTemplateForm(p => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                  <input type="checkbox" checked={templateForm.is_default}
                    onChange={e => setTemplateForm(p => ({ ...p, is_default: e.target.checked }))}
                    className="rounded w-4 h-4 text-blue-600" />
                  Đặt làm mặc định
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tiêu đề <span className="text-red-500">*</span></label>
              <Input value={templateForm.subject}
                onChange={e => setTemplateForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="VD: [{{companyName}}] Thư mời phỏng vấn - {{position}}" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Nội dung <span className="text-red-500">*</span></label>
              <Textarea value={templateForm.body}
                onChange={e => setTemplateForm(p => ({ ...p, body: e.target.value }))}
                placeholder={`Xin chào {{candidateName}},\n\nChúng tôi trân trọng mời bạn tham gia phỏng vấn...`}
                className="min-h-[220px] font-mono text-sm resize-none" />
              <p className="text-xs text-gray-400 mt-1">
                Dùng <code className="bg-gray-100 px-1 rounded">{'{{biến}}'}</code> để tạo nội dung động.
              </p>
            </div>
            <div className="flex gap-3 pt-3 border-t">
              <Button variant="outline"
                onClick={() => { setTemplateOpen(false); setTemplateForm({ name:'', subject:'', body:'', category_id:'', is_default:false }) }}
                disabled={templateSaving}>Hủy</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleCreateTemplate} disabled={templateSaving}>
                {templateSaving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang tạo...</>
                  : <><Plus className="h-4 w-4 mr-2" />Tạo Template</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View Template Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!viewTemplate} onOpenChange={o => { if (!o) setViewTemplate(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewTemplate?.name}
              {viewTemplate?.is_default && <Star className="h-4 w-4 text-yellow-400 fill-yellow-300" />}
            </DialogTitle>
          </DialogHeader>
          {viewTemplate && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-2">
                <CategoryBadge name={viewTemplate.email_categories?.name || 'General'} />
                <span className="text-xs text-gray-400">Dùng {viewTemplate.usage_count || 0} lần</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tiêu đề</label>
                <p className="mt-1 text-gray-900">{viewTemplate.subject}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nội dung</label>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg font-mono text-sm whitespace-pre-wrap border">
                  {viewTemplate.body}
                </div>
              </div>
              {(viewTemplate.variables?.length || 0) > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Biến sử dụng</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {viewTemplate.variables?.map((v, i) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">{`{{${v}}}`}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-3 border-t">
                <Button variant="outline" onClick={() => setViewTemplate(null)}>Đóng</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => { handleUseTemplate(viewTemplate); setViewTemplate(null) }}>
                  <Send className="h-4 w-4 mr-2" />Dùng Template này
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Test Email Dialog ─────────────────────────────────────────────── */}
      <Dialog open={testOpen} onOpenChange={o => { if (!o) { setTestOpen(false); setTestEmail(''); setTestTemplateId(''); setTestSendStatus('idle') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />Gửi Email Thử Nghiệm
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email nhận thử <span className="text-red-500">*</span></label>
              <Input type="email" value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="your-email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Template <span className="text-red-500">*</span></label>
              <Select value={testTemplateId} onValueChange={setTestTemplateId}>
                <SelectTrigger><SelectValue placeholder="Chọn template để test" /></SelectTrigger>
                <SelectContent className="bg-white">
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              Email thử sẽ được gửi với tiêu đề <strong>[TEST]</strong> kèm nội dung gốc của template.
              Các biến <code>{'{{...}}'}</code> sẽ không được thay thế.
            </div>
            {!isConfigured && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
                ⚠️ Email chưa được cấu hình. Vào <strong>Cài đặt → Email</strong> để thêm API Key.
              </div>
            )}
            <div className="flex gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => setTestOpen(false)}>Hủy</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleTestEmail}
                disabled={testSendStatus === 'sending' || !isConfigured}>
                {testSendStatus === 'sending' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang gửi...</>
                ) : testSendStatus === 'success' ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Đã gửi!</>
                ) : testSendStatus === 'error' ? (
                  <><AlertCircle className="h-4 w-4 mr-2" />Thất bại</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Gửi Email Thử</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  )
}

export default EmailManagementPage