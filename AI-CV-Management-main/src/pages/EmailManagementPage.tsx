// src/pages/EmailManagementPage.tsx
"use client"

import { useState, useEffect } from "react"
import {
  Search, Plus, Mail, Send, Clock, FileText, Eye,
  Sparkles, Users, CheckCircle, AlertCircle, RefreshCw, Zap, ToggleLeft,
  ToggleRight, Trash2, Pencil, ChevronDown, ChevronUp, Settings2,
  Copy, Info, X, ChevronRight, Filter, PlayCircle, PauseCircle,
  ArrowRight, Check, Layers, Bell, GitBranch
} from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectTrigger, SelectValue, SelectItem
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { EmailRecipientSelector } from "@/components/EmailRecipientSelector"
import { useCompanyProfile } from "../hooks/useCompanyProfile"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailCategory { id: string; name: string; description?: string }

interface EmailTemplate {
  id: string; name: string; subject: string; body: string
  category_id: string; variables?: string[]; is_default?: boolean
  usage_count?: number; created_at?: string
  email_categories: EmailCategory | null
}

interface Campaign {
  id: string; name: string; description?: string; trigger: string
  template_id?: string; is_active: boolean; delay_hours: number
  cc_emails?: string
  conditions?: {
    result?: string
    new_status?: string
    custom_rules?: CustomRule[]
  } | null
  created_at?: string
  cv_email_templates?: { name: string; subject: string } | null
}

interface CampaignLog {
  id: string; campaign_name?: string; email_sent_to?: string
  status: string; error_message?: string; triggered_at: string
}

type RuleOperator = 'AND' | 'OR'

type RuleField =
  | 'candidate_status'
  | 'interview_result'
  | 'interview_type'
  | 'job_title'
  | 'candidate_source'
  | 'interview_round'
  | 'rating_gte'
  | 'rating_lte'
  | 'days_since_apply'

type RuleCondition =
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'gte' | 'lte'
  | 'in_list'

interface CustomRule {
  id: string
  field: RuleField
  condition: RuleCondition
  value: string
  operator: RuleOperator
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS = [
  {
    value: 'interview_created',
    label: 'Lịch phỏng vấn được tạo',
    description: 'Khi một lịch phỏng vấn mới được thêm vào hệ thống',
    icon: '📅',
    color: 'blue',
  },
  {
    value: 'interview_rescheduled',
    label: 'Lịch phỏng vấn thay đổi',
    description: 'Khi lịch phỏng vấn đã có bị dời hoặc chỉnh sửa',
    icon: '🔄',
    color: 'orange',
  },
  {
    value: 'interview_result_published',
    label: 'Kết quả phỏng vấn được công bố',
    description: 'Khi kết quả đạt / không đạt được cập nhật',
    icon: '📋',
    color: 'purple',
  },
  {
    value: 'candidate_status_changed',
    label: 'Trạng thái ứng viên thay đổi',
    description: 'Khi ứng viên chuyển sang trạng thái mới',
    icon: '👤',
    color: 'green',
  },
  {
    value: 'custom',
    label: 'Điều kiện tùy chỉnh',
    description: 'Kết hợp nhiều điều kiện linh hoạt theo ý muốn',
    icon: '⚙️',
    color: 'gray',
  },
]

const TRIGGER_LABELS: Record<string, string> = {
  interview_created:          'Lịch phỏng vấn được tạo',
  interview_rescheduled:      'Lịch phỏng vấn thay đổi',
  interview_result_published: 'Kết quả phỏng vấn được công bố',
  candidate_status_changed:   'Trạng thái ứng viên thay đổi',
  custom:                     'Điều kiện tùy chỉnh',
}

const TRIGGER_COLOR: Record<string, string> = {
  interview_created:          'bg-blue-50 text-blue-700 border-blue-200',
  interview_rescheduled:      'bg-orange-50 text-orange-700 border-orange-200',
  interview_result_published: 'bg-purple-50 text-purple-700 border-purple-200',
  candidate_status_changed:   'bg-green-50 text-green-700 border-green-200',
  custom:                     'bg-gray-50 text-gray-700 border-gray-200',
}

const RULE_FIELD_LABELS: Record<RuleField, string> = {
  candidate_status:  'Trạng thái ứng viên',
  interview_result:  'Kết quả phỏng vấn',
  interview_type:    'Hình thức phỏng vấn',
  job_title:         'Vị trí ứng tuyển',
  candidate_source:  'Nguồn ứng viên',
  interview_round:   'Vòng phỏng vấn',
  rating_gte:        'Điểm đánh giá ≥',
  rating_lte:        'Điểm đánh giá ≤',
  days_since_apply:  'Số ngày kể từ khi nộp',
}

const RULE_CONDITION_LABELS: Record<RuleCondition, string> = {
  equals:       'bằng',
  not_equals:   'không bằng',
  contains:     'chứa',
  not_contains: 'không chứa',
  gte:          '≥',
  lte:          '≤',
  in_list:      'nằm trong danh sách',
}

const FIELD_CONDITIONS: Record<RuleField, RuleCondition[]> = {
  candidate_status:  ['equals', 'not_equals', 'in_list'],
  interview_result:  ['equals', 'not_equals'],
  interview_type:    ['equals', 'not_equals'],
  job_title:         ['equals', 'contains', 'not_contains'],
  candidate_source:  ['equals', 'not_equals', 'in_list'],
  interview_round:   ['equals', 'gte', 'lte'],
  rating_gte:        ['gte'],
  rating_lte:        ['lte'],
  days_since_apply:  ['gte', 'lte'],
}

const FIELD_SUGGESTIONS: Partial<Record<RuleField, string[]>> = {
  candidate_status:  ['Mới', 'Sàng lọc', 'Phỏng vấn', 'Chấp nhận', 'Từ chối'],
  interview_result:  ['Đạt', 'Không đạt', 'Chờ xét'],
  interview_type:    ['Online', 'Trực tiếp', 'Điện thoại'],
  candidate_source:  ['Website', 'LinkedIn', 'Facebook', 'TopCV', 'Giới thiệu'],
  interview_round:   ['1', '2', '3'],
}

const NUMERIC_FIELDS: RuleField[] = ['rating_gte', 'rating_lte', 'days_since_apply', 'interview_round']

const genId = () => Math.random().toString(36).slice(2, 9)
const EMPTY_RULE = (): CustomRule => ({
  id: genId(), field: 'candidate_status', condition: 'equals', value: '', operator: 'AND'
})

// ─── Helpers ──────────────────────────────────────────────────────────────

const describeRules = (rules: CustomRule[]): string => {
  if (!rules.length) return 'Không có điều kiện'
  return rules.map((r, i) => {
    const part = `${RULE_FIELD_LABELS[r.field]} ${RULE_CONDITION_LABELS[r.condition]} "${r.value}"`
    return i < rules.length - 1 ? `${part} ${r.operator}` : part
  }).join(' ')
}

const getCategoryBadge = (category: string) => {
  const colors: Record<string, string> = {
    Interview:   'bg-purple-50 text-purple-700 border-purple-200',
    Offer:       'bg-orange-50 text-orange-700 border-orange-200',
    Rejection:   'bg-red-50 text-red-700 border-red-200',
    General:     'bg-blue-50 text-blue-700 border-blue-200',
    Reminder:    'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Follow-up': 'bg-green-50 text-green-700 border-green-200',
    Other:       'bg-gray-50 text-gray-700 border-gray-200',
  }
  return <Badge variant="outline" className={colors[category] || 'bg-gray-50 text-gray-700'}>{category}</Badge>
}

// ─── Campaign Wizard Steps ─────────────────────────────────────────────────

type WizardStep = 'trigger' | 'filter' | 'template' | 'settings'

const WIZARD_STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'trigger',  label: 'Sự kiện',   icon: <Bell className="h-4 w-4" /> },
  { key: 'filter',   label: 'Điều kiện', icon: <Filter className="h-4 w-4" /> },
  { key: 'template', label: 'Nội dung',  icon: <Mail className="h-4 w-4" /> },
  { key: 'settings', label: 'Cài đặt',   icon: <Settings2 className="h-4 w-4" /> },
]

// ─── CustomRuleBuilder ────────────────────────────────────────────────────

interface CustomRuleBuilderProps {
  rules: CustomRule[]
  onChange: (rules: CustomRule[]) => void
}

function CustomRuleBuilder({ rules, onChange }: CustomRuleBuilderProps) {
  const addRule    = () => onChange([...rules, EMPTY_RULE()])
  const removeRule = (id: string) => onChange(rules.filter(r => r.id !== id))
  const dupRule    = (r: CustomRule) => onChange([...rules, { ...r, id: genId() }])
  const updateRule = (id: string, patch: Partial<CustomRule>) =>
    onChange(rules.map(r => r.id === id ? { ...r, ...patch } : r))

  return (
    <div className="space-y-2">
      {rules.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          <GitBranch className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Chưa có điều kiện nào</p>
          <p className="text-xs text-gray-400 mt-0.5">Nhấn "Thêm điều kiện" để bắt đầu</p>
        </div>
      )}

      {rules.map((rule, idx) => {
        const availableConds = FIELD_CONDITIONS[rule.field] || ['equals']
        const suggestions    = FIELD_SUGGESTIONS[rule.field] || []
        const isNumeric      = NUMERIC_FIELDS.includes(rule.field)
        const isCustomValue  = suggestions.length > 0 && rule.value !== '' && !suggestions.includes(rule.value)

        return (
          <div key={rule.id}>
            <div className="flex items-start gap-2 p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-200 transition-colors">
              <span className="flex-shrink-0 w-5 h-5 mt-2.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Select value={rule.field} onValueChange={v => {
                  const nf = v as RuleField
                  updateRule(rule.id, { field: nf, condition: FIELD_CONDITIONS[nf][0], value: '' })
                }}>
                  <SelectTrigger className="bg-gray-50 text-sm h-9 border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white z-[70]">
                    {(Object.keys(RULE_FIELD_LABELS) as RuleField[]).map(f => (
                      <SelectItem key={f} value={f}>{RULE_FIELD_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={rule.condition} onValueChange={v => updateRule(rule.id, { condition: v as RuleCondition })}>
                  <SelectTrigger className="bg-gray-50 text-sm h-9 border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white z-[70]">
                    {availableConds.map(c => (
                      <SelectItem key={c} value={c}>{RULE_CONDITION_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="space-y-1">
                  {suggestions.length > 0 ? (
                    <Select
                      value={isCustomValue ? '__custom__' : (rule.value || '')}
                      onValueChange={v => updateRule(rule.id, { value: v === '__custom__' ? '' : v })}
                    >
                      <SelectTrigger className="bg-gray-50 text-sm h-9 border-gray-200">
                        <SelectValue placeholder="Chọn giá trị..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-[70]">
                        {suggestions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        <SelectItem value="__custom__">✏️ Nhập tùy chỉnh...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={rule.value} onChange={e => updateRule(rule.id, { value: e.target.value })}
                      placeholder={isNumeric ? 'Nhập số...' : 'Nhập giá trị...'}
                      type={isNumeric ? 'number' : 'text'} className="bg-gray-50 text-sm h-9 border-gray-200" />
                  )}
                  {(isCustomValue || (suggestions.length > 0 && !suggestions.includes(rule.value) && rule.value === '')) && (
                    <Input value={rule.value} onChange={e => updateRule(rule.id, { value: e.target.value })}
                      placeholder="Nhập giá trị tùy chỉnh..."
                      className="bg-blue-50 border-blue-200 text-sm h-9 mt-1" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                <button type="button" onClick={() => dupRule(rule)} title="Nhân bản"
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => removeRule(rule.id)} title="Xóa"
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {idx < rules.length - 1 && (
              <div className="flex items-center gap-2 my-1.5">
                <div className="h-px flex-1 bg-gray-200" />
                <button type="button"
                  onClick={() => updateRule(rule.id, { operator: rule.operator === 'AND' ? 'OR' : 'AND' })}
                  className={`px-3 py-0.5 rounded-full text-xs font-bold border select-none transition-all cursor-pointer
                    ${rule.operator === 'AND'
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                      : 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'}`}>
                  {rule.operator}
                </button>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            )}
          </div>
        )
      })}

      <button type="button" onClick={addRule}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-colors">
        <Plus className="h-4 w-4" />Thêm điều kiện
      </button>

      {rules.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
          <p className="font-mono leading-relaxed break-words">{describeRules(rules)}</p>
        </div>
      )}
    </div>
  )
}

// ─── Campaign Wizard ──────────────────────────────────────────────────────────

interface CampaignWizardProps {
  open: boolean
  onClose: () => void
  editCampaign: Campaign | null
  templates: EmailTemplate[]
  onSaved: () => void
}

function CampaignWizard({ open, onClose, editCampaign, templates, onSaved }: CampaignWizardProps) {
  const [step, setStep] = useState<WizardStep>('trigger')
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger: '',
    template_id: '',
    is_active: true,
    delay_hours: 0,
    cc_emails: '',
    condition_result: '',
    custom_rules: [] as CustomRule[],
  })

  // Reset wizard when opening
  useEffect(() => {
    if (!open) return
    setStep('trigger')
    if (editCampaign) {
      setForm({
        name: editCampaign.name,
        description: editCampaign.description || '',
        trigger: editCampaign.trigger,
        template_id: editCampaign.template_id || '',
        is_active: editCampaign.is_active,
        delay_hours: editCampaign.delay_hours,
        cc_emails: editCampaign.cc_emails || '',
        condition_result: editCampaign.conditions?.result || editCampaign.conditions?.new_status || '',
        custom_rules: editCampaign.conditions?.custom_rules || [],
      })
    } else {
      setForm({ name: '', description: '', trigger: '', template_id: '', is_active: true, delay_hours: 0, cc_emails: '', condition_result: '', custom_rules: [] })
    }
  }, [open, editCampaign])

  const stepIndex = WIZARD_STEPS.findIndex(s => s.key === step)

  const canProceed = () => {
    if (step === 'trigger') return !!form.trigger
    if (step === 'filter') {
      if (form.trigger === 'custom') {
        if (!form.custom_rules.length) return false
        return form.custom_rules.every(r => r.value.trim() !== '')
      }
      return true // filter step is optional for non-custom
    }
    if (step === 'template') return !!form.template_id
    if (step === 'settings') return !!form.name.trim()
    return true
  }

  const goNext = () => {
    const idx = WIZARD_STEPS.findIndex(s => s.key === step)
    if (idx < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[idx + 1].key)
  }

  const goBack = () => {
    const idx = WIZARD_STEPS.findIndex(s => s.key === step)
    if (idx > 0) setStep(WIZARD_STEPS[idx - 1].key)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.trigger || !form.template_id) {
      toast.warning('Vui lòng điền đầy đủ thông tin'); return
    }
    setIsSaving(true)
    try {
      let conditions: Campaign['conditions'] = null
      if (form.trigger === 'interview_result_published' && form.condition_result.trim())
        conditions = { result: form.condition_result }
      else if (form.trigger === 'candidate_status_changed' && form.condition_result.trim())
        conditions = { new_status: form.condition_result }
      else if (form.trigger === 'custom' && form.custom_rules.length)
        conditions = { custom_rules: form.custom_rules }

      const payload = {
        name: form.name, description: form.description || null,
        trigger: form.trigger, template_id: form.template_id,
        is_active: form.is_active, delay_hours: form.delay_hours,
        cc_emails: form.cc_emails || null, conditions,
        updated_at: new Date().toISOString()
      }
      if (editCampaign) {
        const { error } = await supabase.from('cv_email_campaigns').update(payload).eq('id', editCampaign.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cv_email_campaigns').insert([payload])
        if (error) throw error
      }
      onSaved()
      onClose()
      toast.success(editCampaign ? 'Cập nhật campaign thành công!' : 'Tạo campaign mới thành công!')
    } catch (e: any) { toast.error('Lỗi: ' + e.message) }
    finally { setIsSaving(false) }
  }

  const selectedTrigger = TRIGGER_OPTIONS.find(t => t.value === form.trigger)
  const selectedTemplate = templates.find(t => t.id === form.template_id)

  const needsFilter = form.trigger === 'interview_result_published' || form.trigger === 'candidate_status_changed' || form.trigger === 'custom'

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b bg-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {editCampaign ? 'Chỉnh sửa Campaign' : 'Tạo Campaign Mới'}
              </h2>
              <p className="text-xs text-gray-500">Tự động gửi email khi sự kiện xảy ra</p>
            </div>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-1">
            {WIZARD_STEPS.map((s, idx) => {
              const isActive   = s.key === step
              const isComplete = WIZARD_STEPS.findIndex(x => x.key === step) > idx
              return (
                <div key={s.key} className="flex items-center gap-1 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      // Allow going back to any completed step
                      if (isComplete) setStep(s.key)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center
                      ${isActive   ? 'bg-blue-600 text-white shadow-sm'
                      : isComplete ? 'bg-blue-50 text-blue-700 cursor-pointer hover:bg-blue-100'
                      :              'bg-gray-100 text-gray-400 cursor-default'}`}>
                    {isComplete
                      ? <Check className="h-3 w-3" />
                      : <span className="flex items-center">{s.icon}</span>}
                    {s.label}
                  </button>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <ChevronRight className={`h-3 w-3 flex-shrink-0 ${isComplete ? 'text-blue-400' : 'text-gray-300'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ══ Step 1: Trigger ══ */}
          {step === 'trigger' && (
            <div className="space-y-3">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900">Chọn sự kiện kích hoạt</h3>
                <p className="text-sm text-gray-500 mt-0.5">Campaign sẽ tự động chạy khi sự kiện này xảy ra trong hệ thống</p>
              </div>
              <div className="grid gap-2">
                {TRIGGER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, trigger: opt.value, condition_result: '', custom_rules: [] }))}
                    className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border-2 transition-all
                      ${form.trigger === opt.value
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                      ${form.trigger === opt.value ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      ${form.trigger === opt.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {form.trigger === opt.value && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══ Step 2: Filter / Conditions ══ */}
          {step === 'filter' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Thiết lập điều kiện lọc</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {form.trigger === 'custom'
                    ? 'Xây dựng các điều kiện tùy chỉnh để kiểm soát chính xác khi nào email được gửi'
                    : 'Chọn điều kiện để lọc – hoặc bỏ qua để gửi cho tất cả trường hợp'}
                </p>
              </div>

              {/* Trigger summary chip */}
              {selectedTrigger && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-lg">{selectedTrigger.icon}</span>
                  <div>
                    <p className="text-xs text-gray-500">Sự kiện đã chọn</p>
                    <p className="text-sm font-medium text-gray-800">{selectedTrigger.label}</p>
                  </div>
                </div>
              )}

              {/* Interview result filter */}
              {form.trigger === 'interview_result_published' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Lọc theo kết quả phỏng vấn:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: '', label: 'Tất cả', sub: 'Đạt & Không đạt', icon: '📊' },
                      { value: 'Đạt', label: 'Chỉ Đạt', sub: 'Kết quả đạt yêu cầu', icon: '✅' },
                      { value: 'Không đạt', label: 'Chỉ Không đạt', sub: 'Kết quả không đạt', icon: '❌' },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setForm(p => ({ ...p, condition_result: opt.value }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all
                          ${form.condition_result === opt.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <div className="text-xl mb-1">{opt.icon}</div>
                        <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidate status filter */}
              {form.trigger === 'candidate_status_changed' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Lọc theo trạng thái mới của ứng viên:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: '', label: 'Tất cả trạng thái', sub: 'Gửi khi chuyển sang bất kỳ trạng thái nào', icon: '🔄' },
                      { value: 'Mới', label: 'Mới', sub: 'Vừa nộp đơn', icon: '🆕' },
                      { value: 'Sàng lọc', label: 'Sàng lọc', sub: 'Đang được xem xét', icon: '🔍' },
                      { value: 'Phỏng vấn', label: 'Phỏng vấn', sub: 'Đã lên lịch phỏng vấn', icon: '💬' },
                      { value: 'Chấp nhận', label: 'Chấp nhận', sub: 'Thông qua tuyển dụng', icon: '🎉' },
                      { value: 'Từ chối', label: 'Từ chối', sub: 'Không phù hợp', icon: '🚫' },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setForm(p => ({ ...p, condition_result: opt.value }))}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                          ${form.condition_result === opt.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <span className="text-lg">{opt.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
                          <div className="text-xs text-gray-500 truncate">{opt.sub}</div>
                        </div>
                        {form.condition_result === opt.value && (
                          <Check className="h-4 w-4 text-blue-500 flex-shrink-0 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Other triggers: no filter needed */}
              {(form.trigger === 'interview_created' || form.trigger === 'interview_rescheduled') && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Không cần lọc thêm</p>
                  <p className="text-xs text-gray-500 mt-1">Campaign sẽ chạy với mọi trường hợp của sự kiện này</p>
                </div>
              )}

              {/* Custom rule builder */}
              {form.trigger === 'custom' && (
                <CustomRuleBuilder
                  rules={form.custom_rules}
                  onChange={rules => setForm(p => ({ ...p, custom_rules: rules }))}
                />
              )}
            </div>
          )}

          {/* ══ Step 3: Template ══ */}
          {step === 'template' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Chọn template email</h3>
                <p className="text-sm text-gray-500 mt-0.5">Nội dung email sẽ được gửi khi campaign kích hoạt</p>
              </div>

              <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
                {templates.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Chưa có template nào</p>
                    <p className="text-xs text-gray-400 mt-0.5">Hãy tạo template trước</p>
                  </div>
                ) : templates.map(t => (
                  <button key={t.id} type="button"
                    onClick={() => setForm(p => ({ ...p, template_id: t.id }))}
                    className={`w-full text-left flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all
                      ${form.template_id === t.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                      ${form.template_id === t.id ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Mail className={`h-4 w-4 ${form.template_id === t.id ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{t.name}</span>
                        {t.is_default && <span className="text-yellow-500 text-xs">⭐</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getCategoryBadge(t.email_categories?.name || 'General')}
                        <span className="text-[10px] text-gray-400">{t.variables?.length || 0} biến · {t.usage_count || 0} lần dùng</span>
                      </div>
                    </div>
                    {form.template_id === t.id && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Variable hint */}
              {form.template_id && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Biến hỗ trợ trong template:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {[
                      ['{{candidateName}}', 'Tên ứng viên'],
                      ['{{position}}', 'Vị trí'],
                      ['{{companyName}}', 'Tên công ty'],
                      ['{{interviewTime}}', 'Ngày & giờ PV'],
                      ['{{interviewType}}', 'Hình thức'],
                      ['{{result}}', 'Kết quả'],
                    ].map(([code, desc]) => (
                      <div key={code} className="flex items-center gap-1">
                        <code className="bg-white border border-gray-200 px-1 rounded text-[10px] text-blue-700 shrink-0">{code}</code>
                        <span className="text-[10px] text-gray-400 truncate">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ Step 4: Settings ══ */}
          {step === 'settings' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Cài đặt campaign</h3>
                <p className="text-sm text-gray-500 mt-0.5">Đặt tên và tinh chỉnh cách campaign hoạt động</p>
              </div>

              {/* Summary card */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Tóm tắt campaign</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedTrigger && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-200 rounded-full text-blue-800">
                      <span>{selectedTrigger.icon}</span>{selectedTrigger.label}
                    </span>
                  )}
                  {form.condition_result && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-200 rounded-full text-blue-800">
                      <Filter className="h-3 w-3" />Lọc: {form.condition_result}
                    </span>
                  )}
                  {form.trigger === 'custom' && form.custom_rules.length > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-200 rounded-full text-blue-800">
                      <GitBranch className="h-3 w-3" />{form.custom_rules.length} điều kiện
                    </span>
                  )}
                  {selectedTemplate && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-200 rounded-full text-blue-800">
                      <Mail className="h-3 w-3" />{selectedTemplate.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tên Campaign <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="VD: Gửi mail mời phỏng vấn vòng 1"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="bg-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả <span className="text-gray-400 font-normal">(tùy chọn)</span></label>
                <Input
                  placeholder="Mô tả ngắn gọn mục đích của campaign"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="bg-white"
                />
              </div>

              {/* Delay + CC */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Gửi sau (giờ)</label>
                  <Input
                    type="number" min={0}
                    value={form.delay_hours}
                    onChange={e => setForm(p => ({ ...p, delay_hours: parseInt(e.target.value) || 0 }))}
                    className="bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">0 = gửi ngay lập tức</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">CC Email <span className="text-gray-400 font-normal">(tùy chọn)</span></label>
                  <Input
                    placeholder="a@b.com, c@d.com"
                    value={form.cc_emails}
                    onChange={e => setForm(p => ({ ...p, cc_emails: e.target.value }))}
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all
                ${form.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {form.is_active ? '🟢 Bật ngay sau khi lưu' : '⚫ Lưu ở trạng thái tắt'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.is_active
                      ? 'Campaign sẽ hoạt động ngay khi được tạo'
                      : 'Bạn có thể bật campaign sau trong danh sách'}
                  </p>
                </div>
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0
                    ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                    ${form.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={stepIndex === 0 ? onClose : goBack}>
            {stepIndex === 0 ? 'Hủy' : '← Quay lại'}
          </Button>

          <div className="flex items-center gap-2">
            {/* Dot indicators */}
            <div className="flex gap-1 mr-2">
              {WIZARD_STEPS.map((s, i) => (
                <div key={s.key} className={`w-1.5 h-1.5 rounded-full transition-all
                  ${i === stepIndex ? 'bg-blue-600 w-4' : i < stepIndex ? 'bg-blue-300' : 'bg-gray-300'}`} />
              ))}
            </div>

            {stepIndex < WIZARD_STEPS.length - 1 ? (
              <Button
                size="sm"
                disabled={!canProceed()}
                onClick={goNext}
                className="bg-blue-600 hover:bg-blue-700 text-white">
                Tiếp theo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!canProceed() || isSaving}
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white">
                {isSaving ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Đang lưu...</>
                ) : (
                  <><Check className="h-4 w-4 mr-1.5" />{editCampaign ? 'Cập nhật' : 'Tạo Campaign'}</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function EmailManagementPage() {
  const [templates,   setTemplates]   = useState<EmailTemplate[]>([])
  const [categories,  setCategories]  = useState<EmailCategory[]>([])
  const [loading,     setLoading]     = useState(true)
  const [currentTab,  setCurrentTab]  = useState<'templates' | 'history' | 'campaigns'>('templates')
  const [stats, setStats] = useState({ totalSent: 0, openRate: '0.0', waitingToSend: 0, totalTemplates: 0 })

  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false)
  const [apiKey,       setApiKey]      = useState('')
  const [senderName,   setSenderName]  = useState('Recruit AI')
  const [defaultFrom,  setDefaultFrom] = useState('onboarding@resend.dev')
  const [isRefreshingApiKey, setIsRefreshingApiKey] = useState(false)

  const [isComposeOpen,    setIsComposeOpen]    = useState(false)
  const [isTemplateOpen,   setIsTemplateOpen]   = useState(false)
  const [isTestEmailOpen,  setIsTestEmailOpen]  = useState(false)
  const [viewTemplate,     setViewTemplate]     = useState<EmailTemplate | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery,      setSearchQuery]      = useState('')
  const [isSaving,         setIsSaving]         = useState(false)
  const [emailSendingStatus, setEmailSendingStatus] = useState<Record<string, 'idle' | 'sending' | 'success' | 'error'>>({})

  const [campaigns,     setCampaigns]     = useState<Campaign[]>([])
  const [campaignLogs,  setCampaignLogs]  = useState<CampaignLog[]>([])
  const [isWizardOpen,  setIsWizardOpen]  = useState(false)
  const [editCampaign,  setEditCampaign]  = useState<Campaign | null>(null)
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)

  const [composeForm,  setComposeForm]  = useState({ candidate_id: '', template_id: '', subject: '', body: '', scheduled_at: '', cc: '', priority: 'normal' })
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '', category_id: '', is_default: false })
  const [testEmailForm, setTestEmailForm] = useState({ test_email: '', template_id: '' })
  const [emailHistory, setEmailHistory] = useState<any[]>([])

  const { profile: companyProfile } = useCompanyProfile()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('compose') === 'true') {
      setIsComposeOpen(true)
      const cid = params.get('candidate_id')
      if (cid) setComposeForm(prev => ({ ...prev, candidate_id: cid }))
      window.history.replaceState({}, '', '/quan-ly-email')
    }
  }, [])

  useEffect(() => { fetchData(); checkApiKeyStatus() }, [])
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === 'email_settings_updated') checkApiKeyStatus() }
    window.addEventListener('storage', onStorage)
    const id = setInterval(checkApiKeyStatus, 30000)
    return () => { window.removeEventListener('storage', onStorage); clearInterval(id) }
  }, [])

  const checkApiKeyStatus = async () => {
    setIsRefreshingApiKey(true)
    try {
      const { data } = await supabase.from('cv_email_settings')
        .select('resend_api_key, sending_email, sender_name')
        .order('updated_at', { ascending: false }).limit(1).single()
      if (data) {
        if (data.resend_api_key && data.resend_api_key !== 'EMPTY') {
          setIsApiKeyConfigured(true); setApiKey(data.resend_api_key)
          localStorage.setItem('resend_api_key', data.resend_api_key)
        } else { setIsApiKeyConfigured(false) }
        if (data.sending_email) { setDefaultFrom(data.sending_email); localStorage.setItem('resend_from_email', data.sending_email) }
        if (data.sender_name)   { setSenderName(data.sender_name);    localStorage.setItem('resend_sender_name', data.sender_name) }
      } else { setIsApiKeyConfigured(false) }
    } catch { setIsApiKeyConfigured(false) }
    finally { setIsRefreshingApiKey(false) }
  }

  const forceRefreshApiKey = async () => {
    ['resend_api_key','resend_from_email','resend_sender_name'].forEach(k => localStorage.removeItem(k))
    await checkApiKeyStatus()
  }

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([fetchTemplates(), fetchCategories(), fetchStats(), fetchHistory(), fetchCampaigns()])
    setLoading(false)
  }

  const fetchTemplates = async () => {
    const { data } = await supabase.from('cv_email_templates')
      .select('*, cv_email_categories(id,name,description)').eq('is_active', true).order('created_at', { ascending: false })
    if (data) setTemplates(data.map((item: any) => ({ ...item, email_categories: item.cv_email_categories || null })) as EmailTemplate[])
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('cv_email_categories').select('*').order('name')
    if (data) setCategories(data as EmailCategory[])
  }

  const fetchStats = async () => {
    const [{ count: sent }, { count: queue }, { count: tmpl }] = await Promise.all([
      supabase.from('cv_emails').select('*', { count:'exact', head:true }).eq('status','sent'),
      supabase.from('cv_email_queue').select('*', { count:'exact', head:true }).eq('status','pending'),
      supabase.from('cv_email_templates').select('*', { count:'exact', head:true }).eq('is_active',true),
    ])
    setStats({ totalSent: sent||0, openRate:'0.0', waitingToSend: queue||0, totalTemplates: tmpl||0 })
  }

  const fetchHistory = async () => {
    const { data } = await supabase.from('cv_emails')
      .select('id,candidate_id,subject,status,sent_at,cv_email_templates(name)')
      .order('sent_at', { ascending: false }).limit(50)
    if (data) setEmailHistory(data)
  }

  const fetchCampaigns = async () => {
    const { data } = await supabase.from('cv_email_campaigns')
      .select('*, cv_email_templates(name,subject)').order('created_at', { ascending: false })
    if (data) setCampaigns(data as Campaign[])
  }

  const fetchCampaignLogs = async () => {
    const { data } = await supabase.from('cv_campaign_logs')
      .select('*').order('triggered_at', { ascending: false }).limit(50)
    if (data) setCampaignLogs(data as CampaignLog[])
  }

  const handleToggleCampaign = async (c: Campaign) => {
    const { error } = await supabase.from('cv_email_campaigns').update({ is_active: !c.is_active }).eq('id', c.id)
    if (!error) setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x))
  }

  const handleDeleteCampaign = async (c: Campaign) => {
    if (!confirm(`Xóa campaign "${c.name}"?`)) return
    const { error } = await supabase.from('cv_email_campaigns').delete().eq('id', c.id)
    if (!error) setCampaigns(prev => prev.filter(x => x.id !== c.id))
  }

  const formatEmailContent = (content: string, subject?: string) => {
    let processedContent = content
      .replace(/\{\{company_name\}\}/g, companyProfile?.company_name || 'Công ty')
      .replace(/\{\{company_description\}\}/g, companyProfile?.company_description || 'Mô tả công ty')
      .replace(/\{\{company_address\}\}/g, companyProfile?.company_address || 'Địa chỉ công ty')
      .replace(/\{\{contact_email\}\}/g, companyProfile?.contact_email || 'email@company.com')
      .replace(/\{\{website\}\}/g, companyProfile?.website || 'https://company.com')

    const safe = processedContent.replace(/\n/g,'<br/>').replace(/\{\{([^}]+)\}\}/g,'<span style="color:#3b82f6;font-weight:500">{{$1}}</span>')
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${subject??'Recruit AI'}</title>
<style>body{margin:0;padding:0;font-family:-apple-system,sans-serif;background:#f4f7fa;color:#1f2937;line-height:1.6}
.wrap{max-width:640px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.05)}
.header{padding:32px 40px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:16px;background:#f9fafb}
.logo{width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700}
.content{padding:40px;color:#374151}
.footer{padding:24px 40px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;text-align:center;background:#f9fafb}
.footer a{color:#3b82f6;text-decoration:none}</style></head>
<body><div class="wrap"><div class="header"><div class="logo">RA</div>
<div><div style="font-size:20px;font-weight:600;color:#111827">Recruit AI</div>
<div style="font-size:13px;color:#6b7280">Hệ thống gửi email tuyển dụng chuyên nghiệp</div></div></div>
<div class="content">${safe}</div>
<div class="footer">Email tự động từ Recruit AI. Vui lòng không trả lời.<br/><a href="https://recruit-ai.com">Truy cập trang web</a></div>
</div></body></html>`
  }

  const resolveRecipients = async (field: string): Promise<string[]|null> => {
    if (!field) return null
    const parts = field.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.every(p => p.includes('@'))) return parts
    try {
      const { data } = await supabase.from('cv_candidates').select('email').in('id', parts)
      const emails = (data||[]).map((r:any) => r.email).filter(Boolean)
      return emails.length ? emails : null
    } catch { return null }
  }

  const sendEmail = async (toField: string, subject: string, body: string, cc?: string, templateId?: string) => {
    if (!isApiKeyConfigured || !apiKey) {
      await forceRefreshApiKey()
      if (!isApiKeyConfigured || !apiKey) { toast.error('Vui lòng cấu hình App Password trước khi gửi email.'); return { success:false, error:'App Password not configured' } }
    }
    setIsSaving(true)
    try {
      const recipients = await resolveRecipients(toField)
      if (!recipients?.length) return { success:false, error:'Không có email hợp lệ' }
      const payload: any = {
        subject, body_html: formatEmailContent(body, subject), body_text: body.replace(/\{\{|\}\}/g,''),
        to: recipients, app_password: apiKey.replace(/\s/g,''), sender_email: defaultFrom, sender_name: senderName
      }
      if (cc?.trim()) { const ccList = cc.split(',').map(s=>s.trim()).filter(Boolean); if (ccList.length) payload.cc = ccList }
      const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API_URL}/api/send-email`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error((err as any).detail||(err as any).message||'Failed') }
      const data = await res.json().catch(()=>({}))
      await supabase.from('cv_emails').insert([{ candidate_id:toField, template_id:templateId||null, subject, body, composition_type:'manual', status:'sent', sent_at:new Date().toISOString(), external_id:(data as any).id||null }])
      if (templateId) {
        const { data: tData } = await supabase.from('cv_email_templates').select('usage_count').eq('id',templateId).single()
        if (tData) await supabase.from('cv_email_templates').update({ usage_count:(tData.usage_count||0)+1 }).eq('id',templateId)
      }
      return { success:true, data }
    } catch (e:any) { return { success:false, error:e?.message||String(e) } }
    finally { setIsSaving(false) }
  }

  const handleComposeSubmit = async () => {
    if (!composeForm.candidate_id||!composeForm.subject||!composeForm.body) { toast.warning('Vui lòng điền đầy đủ thông tin'); return }
    setEmailSendingStatus(p=>({...p,compose:'sending'}))
    try {
      const result = await sendEmail(composeForm.candidate_id,composeForm.subject,composeForm.body,composeForm.cc,composeForm.template_id)
      if (result?.success) { setEmailSendingStatus(p=>({...p,compose:'success'})); toast.success('Email đã gửi thành công!'); setIsComposeOpen(false); setComposeForm({candidate_id:'',template_id:'',subject:'',body:'',scheduled_at:'',cc:'',priority:'normal'}); fetchStats() }
      else { setEmailSendingStatus(p=>({...p,compose:'error'})); toast.error('Lỗi: '+result?.error) }
    } catch(e:any){ setEmailSendingStatus(p=>({...p,compose:'error'})); toast.error(e.message) }
    finally { setTimeout(()=>setEmailSendingStatus(p=>({...p,compose:'idle'})),3000) }
  }

  const handleTestEmail = async () => {
    if (!testEmailForm.test_email) { toast.warning('Nhập email nhận thử'); return }
    const tmpl = templates.find(t=>t.id===testEmailForm.template_id)
    if (!tmpl) { toast.warning('Chọn template'); return }
    setEmailSendingStatus(p=>({...p,test:'sending'}))
    try {
      const result = await sendEmail(testEmailForm.test_email,`[TEST] ${tmpl.subject}`,tmpl.body,undefined,testEmailForm.template_id)
      if (result?.success) { setEmailSendingStatus(p=>({...p,test:'success'})); toast.success('Gửi thử thành công!'); setIsTestEmailOpen(false); setTestEmailForm({test_email:'',template_id:''}) }
      else { setEmailSendingStatus(p=>({...p,test:'error'})); toast.error('Lỗi: '+result?.error) }
    } catch(e:any){ setEmailSendingStatus(p=>({...p,test:'error'})); toast.error(e.message) }
    finally { setTimeout(()=>setEmailSendingStatus(p=>({...p,test:'idle'})),3000) }
  }

  const handleCreateTemplate = async () => {
    if (!templateForm.name||!templateForm.subject||!templateForm.body||!templateForm.category_id) { toast.warning('Điền đầy đủ thông tin template'); return }
    setIsSaving(true)
    try {
      const vars = (templateForm.body.match(/\{\{(\w+)\}\}/g)||[]).map(v=>v.replace(/[{}]/g,''))
      const { data, error } = await supabase.from('cv_email_templates').insert([{ name:templateForm.name, subject:templateForm.subject, body:templateForm.body, category_id:templateForm.category_id, variables:vars, is_default:templateForm.is_default, is_active:true, usage_count:0 }]).select('*,cv_email_categories(id,name)')
      if (error) throw error
      if (data?.[0]) { setTemplates(prev=>[{...data[0],email_categories:data[0].cv_email_categories||null} as EmailTemplate,...prev]); toast.success('Tạo template thành công!'); setIsTemplateOpen(false); setTemplateForm({name:'',subject:'',body:'',category_id:'',is_default:false}); fetchStats() }
    } catch(e:any){ toast.error('Lỗi: '+e.message) }
    finally { setIsSaving(false) }
  }

  const handleUseTemplate = (t: EmailTemplate) => {
    setComposeForm(prev=>({...prev,template_id:t.id,subject:t.subject,body:t.body}))
    setIsComposeOpen(true)
  }

  const filteredTemplates = templates.filter(t =>
    (t.name.toLowerCase().includes(searchQuery.toLowerCase())||t.subject.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (selectedCategory==='all'||t.category_id===selectedCategory)
  )
  const categoryCounts: Record<string,number> = {}
  categories.forEach(c => { categoryCounts[c.name]=templates.filter(t=>t.category_id===c.id).length })

  const activeCampaigns   = campaigns.filter(c => c.is_active).length
  const inactiveCampaigns = campaigns.filter(c => !c.is_active).length

  return (
    <>
      <div className="sm:hidden flex flex-col items-center justify-center min-h-[80vh] p-6 text-center space-y-4">
        <div className="bg-gray-100 p-4 rounded-full">
          <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800">Không hỗ trợ di động</h2>
        <p className="text-gray-500">We're Launching Soon</p>
      </div>

      <div className="hidden sm:block">
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-lg"><Mail className="h-8 w-8 text-white" /></div>
              <div>
                <h1 className="text-2xl font-bold">Quản lý Email</h1>
                <p className="text-sm text-muted-foreground">Quản lý {stats.totalTemplates} mẫu email trong {categories.length} danh mục</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={()=>setIsTestEmailOpen(true)}><Sparkles className="mr-2 h-4 w-4"/>Test Email</Button>
              <Button variant="outline" onClick={()=>setIsTemplateOpen(true)}><Plus className="mr-2 h-4 w-4"/>Tạo Template</Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>setIsComposeOpen(true)}><Send className="mr-2 h-4 w-4"/>Soạn Email</Button>
            </div>
          </div>

          {/* Config banner */}
          {isApiKeyConfigured ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <div className="text-green-600 mt-0.5">✓</div>
              <div className="flex-1">
                <p className="text-sm text-gray-700">Đã tải {stats.totalTemplates} mẫu email với {categories.length} danh mục:{Object.entries(categoryCounts).map(([n,c],i)=><span key={n}> {n} ({c}){i<Object.keys(categoryCounts).length-1?',':'.'}</span>)}</p>
                <p className="text-sm text-green-600 mt-1"><strong>Hệ thống Email đã cấu hình.</strong> Bạn có thể gửi email ngay.</p>
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
              <div className="text-orange-600 mt-0.5">!</div>
              <div className="flex-1 flex items-center justify-between">
                <p className="text-sm text-orange-600"><strong>Lưu ý:</strong> Cấu hình Gmail App Password trong mục Cài đặt.</p>
                <Button variant="outline" size="sm" onClick={forceRefreshApiKey} disabled={isRefreshingApiKey} className="ml-4">
                  {isRefreshingApiKey?<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"/>Đang kiểm tra...</>:<><RefreshCw className="mr-2 h-4 w-4"/>Kiểm tra lại</>}
                </Button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-sm"><CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div><p className="text-sm text-gray-600 mb-1">Email đã gửi</p><div className="text-3xl font-bold">{stats.totalSent}</div></div>
                <div className="bg-blue-600 p-3 rounded-xl"><Send className="h-6 w-6 text-white"/></div>
              </div>
            </CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div><p className="text-sm text-gray-600 mb-1">Mẫu Email</p><div className="text-3xl font-bold">{stats.totalTemplates}</div></div>
                <div className="bg-purple-600 p-3 rounded-xl"><FileText className="h-6 w-6 text-white"/></div>
              </div>
            </CardContent></Card>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b">
            {(['templates','history'] as const).map(tab => (
              <button key={tab}
                className={`pb-3 px-1 text-sm font-medium transition-colors relative ${currentTab===tab?'text-blue-600':'text-gray-600 hover:text-gray-900'}`}
                onClick={()=>setCurrentTab(tab)}>
                {tab==='templates'?`Templates (${filteredTemplates.length})`:'History'}
                {currentTab===tab&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"/>}
              </button>
            ))}
            <button
              className={`pb-3 px-1 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${currentTab==='campaigns'?'text-blue-600':'text-gray-600 hover:text-gray-900'}`}
              onClick={()=>{setCurrentTab('campaigns');fetchCampaigns();fetchCampaignLogs()}}>
              <Zap className="h-4 w-4"/>Campaigns
              {campaigns.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">{campaigns.length}</span>
              )}
              {currentTab==='campaigns'&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"/>}
            </button>
          </div>

          {/* Templates */}
          {currentTab==='templates'&&(
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Email Templates</h3>
                <div className="flex items-center gap-3">
                  <div className="relative w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/>
                    <Input placeholder="Tìm kiếm templates..." className="pl-10 bg-gray-100 border-0" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="Tất cả danh mục"/></SelectTrigger>
                    <SelectContent className="bg-white"><SelectItem value="all">Tất cả danh mục</SelectItem>{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {loading?(
                <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"/><p className="text-gray-500 mt-4">Đang tải...</p></div>
              ):filteredTemplates.length===0?(
                <Card><CardContent className="pt-12 pb-12 text-center"><FileText className="h-16 w-16 mx-auto text-gray-400 mb-4"/><p className="font-medium">Không tìm thấy template</p><p className="text-sm text-muted-foreground mb-4">Tạo template đầu tiên!</p><Button onClick={()=>setIsTemplateOpen(true)}><Plus className="mr-2 h-4 w-4"/>Tạo Template</Button></CardContent></Card>
              ):(
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTemplates.map(template=>(
                    <Card key={template.id} className="border hover:shadow-lg transition-shadow bg-white">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2"><h4 className="font-semibold text-base">{template.name}</h4>{template.is_default&&<><span className="text-xs">⭐</span><span className="text-xs text-gray-500">Mặc định</span></>}</div>
                            {getCategoryBadge(template.email_categories?.name||'General')}
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>setViewTemplate(template)}><Eye className="h-4 w-4"/></Button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.subject}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4"><span>{template.variables?.length||0} biến</span><span>Đã dùng {template.usage_count||0} lần</span></div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>handleUseTemplate(template)}><Send className="mr-2 h-4 w-4"/>Sử dụng Template</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History */}
          {currentTab==='history'&&(
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>{['Người nhận','Tiêu đề','Template','Thời gian','Trạng thái'].map(h=><th key={h} className="px-6 py-4 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {emailHistory.length>0?emailHistory.map(email=>(
                    <tr key={email.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 truncate max-w-[200px]">{email.candidate_id}</td>
                      <td className="px-6 py-4 truncate max-w-[250px]">{email.subject}</td>
                      <td className="px-6 py-4 text-gray-500">{email.cv_email_templates?.name||'Thủ công'}</td>
                      <td className="px-6 py-4 text-gray-500">{new Date(email.sent_at).toLocaleString('vi-VN')}</td>
                      <td className="px-6 py-4"><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{email.status==='sent'?'Thành công':email.status}</Badge></td>
                    </tr>
                  )):<tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Chưa có lịch sử gửi email</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Campaigns */}
          {currentTab==='campaigns'&&(
            <div className="space-y-6">

              {/* Campaign header + stats */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Email Campaigns Tự Động</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {campaigns.length === 0
                      ? 'Chưa có campaign nào – tạo campaign đầu tiên để bắt đầu'
                      : `${activeCampaigns} đang bật · ${inactiveCampaigns} đã tắt`}
                  </p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => { setEditCampaign(null); setIsWizardOpen(true) }}>
                  <Plus className="mr-2 h-4 w-4"/>Tạo Campaign
                </Button>
              </div>

              {campaigns.length === 0 ? (
                /* Empty state */
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 text-blue-400" />
                  </div>
                  <p className="text-gray-700 font-semibold text-base">Chưa có campaign nào</p>
                  <p className="text-gray-400 text-sm mt-1 mb-5">Tự động hóa quy trình gửi email tuyển dụng của bạn</p>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => { setEditCampaign(null); setIsWizardOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4"/>Tạo Campaign đầu tiên
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map(c => {
                    const isExpanded   = expandedCampaign === c.id
                    const hasCustomRules = c.trigger === 'custom' && (c.conditions?.custom_rules?.length ?? 0) > 0
                    const triggerOpt   = TRIGGER_OPTIONS.find(t => t.value === c.trigger)

                    return (
                      <div key={c.id}
                        className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden
                          ${c.is_active ? 'border-blue-100' : 'border-gray-200 opacity-75'}`}>

                        <div className="p-4 flex items-center gap-4">
                          {/* Status indicator */}
                          <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${c.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />

                          {/* Trigger icon */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0
                            ${c.is_active ? 'bg-blue-50' : 'bg-gray-100'}`}>
                            {triggerOpt?.icon ?? '⚡'}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
                              <Badge variant="outline"
                                className={c.is_active ? 'bg-green-50 text-green-700 border-green-200 text-[10px]' : 'bg-gray-50 text-gray-500 text-[10px]'}>
                                {c.is_active ? '● Đang bật' : '○ Đã tắt'}
                              </Badge>
                              {c.trigger === 'custom' && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                                  ⚙️ Tùy chỉnh
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${TRIGGER_COLOR[c.trigger] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                {TRIGGER_LABELS[c.trigger] || c.trigger}
                              </span>
                              {(c.conditions?.result || c.conditions?.new_status) && (
                                <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                                  Lọc: <b>{c.conditions.result || c.conditions.new_status}</b>
                                </span>
                              )}
                              {c.delay_hours > 0 && (
                                <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />Gửi sau {c.delay_hours}h
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-gray-500 mt-0.5">
                              <Mail className="inline h-3 w-3 mr-0.5 text-gray-400" />
                              {(c as any).cv_email_templates?.name || <span className="text-orange-500">Chưa chọn template</span>}
                              {c.cc_emails && <span className="ml-2 text-gray-400">· CC: {c.cc_emails}</span>}
                            </p>

                            {hasCustomRules && (
                              <p className="text-[11px] text-purple-600 mt-0.5 truncate">
                                📋 {describeRules(c.conditions!.custom_rules!)}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {hasCustomRules && (
                              <button onClick={() => setExpandedCampaign(isExpanded ? null : c.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Xem điều kiện chi tiết">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            )}
                            <button onClick={() => handleToggleCampaign(c)}
                              className={`p-1.5 rounded-lg transition-colors ${c.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                              title={c.is_active ? 'Tắt campaign' : 'Bật campaign'}>
                              {c.is_active ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                            </button>
                            <button onClick={() => { setEditCampaign(c); setIsWizardOpen(true) }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Chỉnh sửa">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteCampaign(c)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Xóa">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded custom rules */}
                        {isExpanded && hasCustomRules && (
                          <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                            <p className="text-xs font-semibold text-gray-500 mb-2 mt-3 flex items-center gap-1.5">
                              <GitBranch className="h-3.5 w-3.5 text-purple-500" />Chi tiết điều kiện:
                            </p>
                            <div className="space-y-1.5">
                              {c.conditions!.custom_rules!.map((rule, idx) => (
                                <div key={rule.id} className="flex items-center gap-2">
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-purple-100 rounded-lg text-xs text-purple-800 flex-1">
                                    <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                                    <span className="font-medium">{RULE_FIELD_LABELS[rule.field]}</span>
                                    <span className="text-purple-400">{RULE_CONDITION_LABELS[rule.condition]}</span>
                                    <span className="font-semibold">"{rule.value}"</span>
                                  </div>
                                  {idx < c.conditions!.custom_rules!.length - 1 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0
                                      ${rule.operator === 'AND' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                      {rule.operator}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Campaign logs */}
              {campaignLogs.length > 0 && (
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />Lịch sử Campaign <span className="text-sm font-normal text-gray-400">(50 gần nhất)</span>
                  </h4>
                  <div className="border rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>{['Campaign','Gửi đến','Trạng thái','Thời gian'].map(h=>(
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {campaignLogs.map(log => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-800">{log.campaign_name || '—'}</td>
                            <td className="px-4 py-2.5 text-gray-600">{log.email_sent_to || '—'}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className={
                                log.status==='sent'   ? 'bg-green-50 text-green-700 border-green-200' :
                                log.status==='failed' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-gray-50 text-gray-500'}>
                                {log.status==='sent' ? '✓ Đã gửi' : log.status==='failed' ? '✗ Thất bại' : 'Bỏ qua'}
                              </Badge>
                              {log.error_message && <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(log.triggered_at).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ══════════════ DIALOGS ══════════════════════════════════════════════ */}

        {/* Campaign Wizard */}
        <CampaignWizard
          open={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          editCampaign={editCampaign}
          templates={templates}
          onSaved={() => { fetchCampaigns(); setEditCampaign(null) }}
        />

        {/* Compose */}
        <Dialog open={isComposeOpen} onOpenChange={o=>{if(!o)setIsComposeOpen(false)}}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><div className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600"/><DialogTitle className="text-xl">Soạn Email</DialogTitle></div><p className="text-sm text-gray-500 mt-2">Soạn và gửi email tuyển dụng với template hoặc nội dung tự tạo.</p></DialogHeader>
            <div className="space-y-6 mt-6">
              <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4"/>Thông tin cơ bản</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-2">Người nhận *</label><EmailRecipientSelector value={composeForm.candidate_id} onChange={val=>setComposeForm(prev=>({...prev,candidate_id:val}))}/></div>
                  <div><label className="block text-sm font-medium mb-2">Tiêu đề *</label><Input placeholder="Tiêu đề email" className="bg-gray-50" value={composeForm.subject} onChange={e=>setComposeForm(prev=>({...prev,subject:e.target.value}))}/></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="block text-sm font-medium mb-2">CC (Tùy chọn)</label><Input placeholder="cc1@example.com" className="bg-gray-50" value={composeForm.cc} onChange={e=>setComposeForm(prev=>({...prev,cc:e.target.value}))}/></div>
                  <div><label className="block text-sm font-medium mb-2">Độ ưu tiên</label>
                    <Select value={composeForm.priority} onValueChange={v=>setComposeForm(prev=>({...prev,priority:v}))}>
                      <SelectTrigger className="bg-gray-50"><SelectValue/></SelectTrigger>
                      <SelectContent className="bg-white"><SelectItem value="high">Cao</SelectItem><SelectItem value="normal">Bình thường</SelectItem><SelectItem value="low">Thấp</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600"/>Chọn Template (Tùy chọn)</h3><Button variant="outline" size="sm" onClick={()=>setIsTemplateOpen(true)}>Tự tạo</Button></div>
                {composeForm.template_id?(
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                    <div><p className="font-medium text-blue-900">Template đã chọn</p><p className="text-sm text-blue-700 mt-1">{templates.find(t=>t.id===composeForm.template_id)?.name}</p></div>
                    <Button variant="ghost" size="sm" onClick={()=>setComposeForm(prev=>({...prev,template_id:'',subject:'',body:''}))}>Xóa</Button>
                  </div>
                ):(
                  <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {templates.slice(0,4).map(template=>(
                      <button key={template.id} onClick={()=>handleUseTemplate(template)} className="text-left border rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-colors">
                        <div className="flex items-start justify-between mb-2"><h4 className="font-medium text-sm">{template.name}</h4>{template.is_default&&<span className="text-yellow-500">⭐</span>}</div>
                        {getCategoryBadge(template.email_categories?.name||'General')}
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{template.subject}</p>
                        <p className="text-xs text-gray-500 mt-2">Sử dụng: {template.usage_count||0} lần</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t pt-6"><label className="block text-sm font-medium mb-2">Nội dung email</label><Textarea placeholder="Nội dung..." className="min-h-[200px] bg-gray-50" value={composeForm.body} onChange={e=>setComposeForm(prev=>({...prev,body:e.target.value}))}/></div>
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-600"><Users className="h-4 w-4"/><span>{composeForm.candidate_id?composeForm.candidate_id.split(',').length:0} người nhận</span></div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={()=>{setIsComposeOpen(false);setComposeForm({candidate_id:'',template_id:'',subject:'',body:'',scheduled_at:'',cc:'',priority:'normal'})}} disabled={isSaving}>Hủy</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleComposeSubmit} disabled={isSaving||emailSendingStatus.compose==='sending'}>
                    {emailSendingStatus.compose==='sending'?<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"/>Đang gửi...</>:emailSendingStatus.compose==='success'?<><CheckCircle className="mr-2 h-4 w-4"/>Đã gửi</>:emailSendingStatus.compose==='error'?<><AlertCircle className="mr-2 h-4 w-4"/>Gửi thất bại</>:<><Send className="mr-2 h-4 w-4"/>Gửi Email</>}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Template */}
        <Dialog open={isTemplateOpen} onOpenChange={o=>{if(!o)setIsTemplateOpen(false)}}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-xl">Tạo Email Template mới</DialogTitle><p className="text-sm text-gray-500 mt-2">Tạo template email tùy chỉnh cho quy trình tuyển dụng</p></DialogHeader>
            <div className="space-y-5 mt-6">
              <div><label className="block text-sm font-semibold mb-2">Tên template</label><Input placeholder="VD: Mời phỏng vấn vòng 3" className="bg-gray-50" value={templateForm.name} onChange={e=>setTemplateForm(prev=>({...prev,name:e.target.value}))}/></div>
              <div><label className="block text-sm font-semibold mb-2">Danh mục</label>
                <Select value={templateForm.category_id} onValueChange={v=>setTemplateForm(prev=>({...prev,category_id:v}))}>
                  <SelectTrigger className="bg-gray-50"><SelectValue placeholder="Chọn danh mục"/></SelectTrigger>
                  <SelectContent className="bg-white">{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="block text-sm font-semibold mb-2">Tiêu đề email</label><Input placeholder="VD: [{{companyName}}] Mời phỏng vấn - {{position}}" className="bg-gray-50" value={templateForm.subject} onChange={e=>setTemplateForm(prev=>({...prev,subject:e.target.value}))}/></div>
              <div><label className="block text-sm font-semibold mb-2">Nội dung email</label><Textarea placeholder="Nhập nội dung... Dùng {{variableName}} để tạo biến động" className="min-h-[250px] bg-gray-50 font-mono text-sm" value={templateForm.body} onChange={e=>setTemplateForm(prev=>({...prev,body:e.target.value}))}/><p className="text-xs text-gray-500 mt-2">Sử dụng {`{{candidateName}}, {{position}}`}</p></div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2"><Info className="h-4 w-4" />Biến có sẵn</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-medium text-blue-800 mb-1">Thông tin công ty:</p>
                    <div className="space-y-1">
                      {[['{{company_name}}', companyProfile?.company_name||'Tên công ty'],['{{company_description}}','Mô tả công ty'],['{{company_address}}','Địa chỉ công ty'],['{{contact_email}}',companyProfile?.contact_email||'email@company.com'],['{{website}}',companyProfile?.website||'https://company.com']].map(([code,val])=>(
                        <div key={code} className="flex items-center gap-2">
                          <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 font-mono">{code}</code>
                          <span className="text-blue-600">→ {val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-blue-800 mb-1">Biến ứng viên:</p>
                    <div className="space-y-1">
                      {[['{{candidate_name}}','Tên ứng viên'],['{{position}}','Vị trí ứng tuyển'],['{{interview_date}}','Ngày phỏng vấn'],['{{interview_time}}','Giờ phỏng vấn']].map(([code,val])=>(
                        <div key={code} className="flex items-center gap-2">
                          <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 font-mono">{code}</code>
                          <span className="text-blue-600">→ {val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" id="is_default" checked={templateForm.is_default} onChange={e=>setTemplateForm(prev=>({...prev,is_default:e.target.checked}))} className="rounded w-4 h-4"/><label htmlFor="is_default" className="text-sm">Đặt làm template mặc định</label></div>
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={()=>{setIsTemplateOpen(false);setTemplateForm({name:'',subject:'',body:'',category_id:'',is_default:false})}} disabled={isSaving}>Hủy</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreateTemplate} disabled={isSaving}><Plus className="mr-2 h-4 w-4"/>{isSaving?'Đang tạo...':'Tạo Template'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Template */}
        <Dialog open={!!viewTemplate} onOpenChange={o=>{if(!o)setViewTemplate(null)}}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{viewTemplate?.name}</DialogTitle></DialogHeader>
            {viewTemplate&&(
              <div className="space-y-4">
                <div className="flex items-center gap-2">{getCategoryBadge(viewTemplate.email_categories?.name||'General')}{viewTemplate.is_default&&<Badge variant="outline" className="bg-yellow-50 text-yellow-700">Mặc định</Badge>}</div>
                <div><label className="text-sm font-medium text-gray-500">Tiêu đề</label><p className="text-gray-900 mt-1">{viewTemplate.subject}</p></div>
                <div><label className="text-sm font-medium text-gray-500">Nội dung</label><div className="mt-1 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap font-mono text-sm">{viewTemplate.body}</div></div>
                <div><label className="text-sm font-medium text-gray-500">Biến sử dụng</label><div className="flex flex-wrap gap-2 mt-2">{viewTemplate.variables?.length?viewTemplate.variables.map((v,i)=><Badge key={i} variant="outline" className="font-mono">{`{{${v}}}`}</Badge>):<p className="text-sm text-gray-500">Không có biến</p>}</div></div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div><label className="text-sm font-medium text-gray-500">Số lần sử dụng</label><p className="text-2xl font-bold">{viewTemplate.usage_count||0}</p></div>
                  <div><label className="text-sm font-medium text-gray-500">Ngày tạo</label><p className="text-sm">{viewTemplate.created_at?new Date(viewTemplate.created_at).toLocaleDateString('vi-VN'):''}</p></div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Test Email */}
        <Dialog open={isTestEmailOpen} onOpenChange={o=>{if(!o)setIsTestEmailOpen(false)}}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Kiểm tra cấu hình Email</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="block text-sm font-medium mb-1.5">Email nhận thử nghiệm *</label><Input type="email" placeholder="your-email@example.com" value={testEmailForm.test_email} onChange={e=>setTestEmailForm(prev=>({...prev,test_email:e.target.value}))}/></div>
              <div><label className="block text-sm font-medium mb-1.5">Chọn Template</label>
                <Select value={testEmailForm.template_id} onValueChange={v=>setTestEmailForm(prev=>({...prev,template_id:v}))}>
                  <SelectTrigger><SelectValue placeholder="Chọn một template"/></SelectTrigger>
                  <SelectContent className="bg-white">{templates.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"><p className="text-xs text-yellow-800">Email thử nghiệm sẽ được gửi với dữ liệu mẫu từ template đã chọn.</p></div>
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={()=>setIsTestEmailOpen(false)}>Hủy</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleTestEmail} disabled={isSaving||emailSendingStatus.test==='sending'}>
                  {emailSendingStatus.test==='sending'?<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"/>Đang gửi...</>:emailSendingStatus.test==='success'?<><CheckCircle className="mr-2 h-4 w-4"/>Đã gửi</>:emailSendingStatus.test==='error'?<><AlertCircle className="mr-2 h-4 w-4"/>Gửi thất bại</>:<><Sparkles className="mr-2 h-4 w-4"/>Gửi Email Thử</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </>
  )
}

export default EmailManagementPage