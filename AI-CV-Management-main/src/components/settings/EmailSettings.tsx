// src/components/settings/EmailSettings.tsx
"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabaseClient"
import {
  CheckCircle2, AlertCircle, Loader2, Eye, EyeOff,
  Mail, Key, User, ExternalLink, RefreshCw, Send
} from "lucide-react"

// ─── Schema thống nhất với EmailManagementPage ────────────────────────────────
// Bảng cv_email_settings:
//   id, resend_api_key, sending_email, sender_name, updated_at
// ─────────────────────────────────────────────────────────────────────────────

interface EmailSettingsData {
  id?: string
  resend_api_key: string
  sending_email: string
  sender_name: string
  updated_at?: string
}

const EMPTY_SETTINGS: EmailSettingsData = {
  resend_api_key: '',
  sending_email: '',
  sender_name: 'Recruit AI',
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettingsData>(EMPTY_SETTINGS)
  const [original, setOriginal] = useState<EmailSettingsData>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendTestStatus, setSendTestStatus] = useState<TestStatus>('idle')
  const [isDirty, setIsDirty] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cv_email_settings')
        .select('id, resend_api_key, sending_email, sender_name, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('fetchSettings error:', error)
      }

      if (data) {
        const normalized: EmailSettingsData = {
          id: data.id,
          resend_api_key: data.resend_api_key || '',
          sending_email: data.sending_email || '',
          sender_name: data.sender_name || 'Recruit AI',
        }
        setSettings(normalized)
        setOriginal(normalized)
        // sync to localStorage so EmailManagementPage can read immediately
        syncToLocalStorage(normalized)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSettings() }, [])

  // ── dirty check ───────────────────────────────────────────────────────────

  useEffect(() => {
    setIsDirty(
      settings.resend_api_key !== original.resend_api_key ||
      settings.sending_email !== original.sending_email ||
      settings.sender_name !== original.sender_name
    )
  }, [settings, original])

  // ── helpers ───────────────────────────────────────────────────────────────

  const syncToLocalStorage = (s: EmailSettingsData) => {
    if (s.resend_api_key) {
      localStorage.setItem('resend_api_key', s.resend_api_key)
    } else {
      localStorage.removeItem('resend_api_key')
    }
    if (s.sending_email) localStorage.setItem('resend_from_email', s.sending_email)
    if (s.sender_name) localStorage.setItem('resend_sender_name', s.sender_name)
    // signal to other tabs/windows
    localStorage.setItem('email_settings_updated', Date.now().toString())
  }

  const update = (field: keyof EmailSettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }))
    setSaveSuccess(false)
  }

  // ── validate API key (call Resend domains endpoint — no side effects) ──────
  const handleTestApiKey = async () => {
    if (!settings.resend_api_key.trim()) return
    setTestStatus('testing')
    setTestError('')
    try {
      const res = await fetch('/proxy/resend/domains', {
        headers: { Authorization: `Bearer ${settings.resend_api_key.trim()}` }
      })
      if (res.ok) {
        setTestStatus('success')
      } else {
        const body = await res.json().catch(() => ({}))
        setTestStatus('error')
        setTestError((body as any)?.message || `HTTP ${res.status}`)
      }
    } catch (err: any) {
      setTestStatus('error')
      setTestError(err.message || 'Lỗi kết nối')
    } finally {
      setTimeout(() => setTestStatus('idle'), 4000)
    }
  }

  // ── send actual test email ────────────────────────────────────────────────
  const handleSendTestEmail = async () => {
    if (!testEmail.trim() || !settings.resend_api_key.trim()) return
    setSendTestStatus('testing')
    try {
      const payload = {
        from: `${settings.sender_name || 'Recruit AI'} <${settings.sending_email || 'onboarding@resend.dev'}>`,
        to: [testEmail.trim()],
        subject: '[Recruit AI] Email thử nghiệm',
        html: `<p>Xin chào,</p>
<p>Đây là email thử nghiệm từ hệ thống <strong>Recruit AI</strong>.</p>
<p>Nếu bạn nhận được email này, cấu hình email của bạn đang hoạt động chính xác.</p>
<br/><p>Trân trọng,<br/>${settings.sender_name || 'Recruit AI'}</p>`,
      }

      const res = await fetch('/proxy/resend/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.resend_api_key.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSendTestStatus('success')
      } else {
        setSendTestStatus('error')
      }
    } catch {
      setSendTestStatus('error')
    } finally {
      setTimeout(() => setSendTestStatus('idle'), 4000)
    }
  }

  // ── save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!settings.resend_api_key.trim()) {
      alert('Vui lòng nhập Resend API Key')
      return
    }
    if (!settings.sending_email.trim()) {
      alert('Vui lòng nhập Email gửi')
      return
    }
    if (!settings.sender_name.trim()) {
      alert('Vui lòng nhập Tên người gửi')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        resend_api_key: settings.resend_api_key.trim(),
        sending_email: settings.sending_email.trim(),
        sender_name: settings.sender_name.trim(),
        updated_at: new Date().toISOString(),
      }
      if (settings.id) payload.id = settings.id

      const { data, error } = await supabase
        .from('cv_email_settings')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single()

      if (error) throw error

      const saved: EmailSettingsData = {
        id: data.id,
        resend_api_key: data.resend_api_key || '',
        sending_email: data.sending_email || '',
        sender_name: data.sender_name || 'Recruit AI',
      }
      setSettings(saved)
      setOriginal(saved)
      syncToLocalStorage(saved)
      setSaveSuccess(true)
      setIsDirty(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      alert('Lỗi khi lưu: ' + (err?.message || 'Không xác định'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSettings(original)
    setIsDirty(false)
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const isConfigured = !!original.resend_api_key && !!original.sending_email

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Status banner */}
      {isConfigured ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-900">Email đã được cấu hình</p>
            <p className="text-xs text-green-700 mt-0.5 truncate">
              Gửi từ: <strong>{original.sender_name}</strong> &lt;{original.sending_email}&gt;
            </p>
          </div>
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs flex-shrink-0">Đang hoạt động</Badge>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-900">Chưa cấu hình email</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Điền API Key và thông tin bên dưới để bật tính năng gửi email.
            </p>
          </div>
        </div>
      )}

      {/* Card: Resend API Key */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Key className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Resend API Key</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="resend_api_key" className="text-sm">
              API Key <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="resend_api_key"
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.resend_api_key}
                  onChange={e => update('resend_api_key', e.target.value)}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Test button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleTestApiKey}
                disabled={!settings.resend_api_key.trim() || testStatus === 'testing'}
                className="flex-shrink-0"
              >
                {testStatus === 'testing' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Kiểm tra...</>
                ) : testStatus === 'success' ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />Hợp lệ</>
                ) : testStatus === 'error' ? (
                  <><AlertCircle className="h-4 w-4 mr-2 text-red-600" />Không hợp lệ</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Kiểm tra</>
                )}
              </Button>
            </div>

            {testStatus === 'error' && testError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{testError}
              </p>
            )}
            {testStatus === 'success' && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />API Key hợp lệ và đang hoạt động
              </p>
            )}

            <p className="text-xs text-gray-500">
              Lấy API Key tại{' '}
              <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                resend.com/api-keys <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Card: Sender info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Thông tin người gửi</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sending_email" className="text-sm">
              Email gửi <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="sending_email"
                type="email"
                value={settings.sending_email}
                onChange={e => update('sending_email', e.target.value)}
                placeholder="noreply@company.com"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-gray-500">
              Domain phải được verify trên Resend
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sender_name" className="text-sm">
              Tên người gửi <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="sender_name"
                value={settings.sender_name}
                onChange={e => update('sender_name', e.target.value)}
                placeholder="Recruit AI"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-gray-500">
              Tên hiển thị trong hộp thư của người nhận
            </p>
          </div>
        </div>

        {/* Preview */}
        {(settings.sender_name || settings.sending_email) && (
          <div className="px-6 pb-6">
            <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Xem trước tiêu đề gửi:</p>
              <p className="text-sm font-medium text-gray-800">
                {settings.sender_name || 'Recruit AI'}{' '}
                <span className="font-normal text-gray-500">
                  &lt;{settings.sending_email || 'your-email@domain.com'}&gt;
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card: Send test email */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Send className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Gửi email thử nghiệm</h3>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-gray-600">
            Gửi email thử để xác nhận cấu hình hoạt động đúng trước khi lưu.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="your-inbox@example.com"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSendTestEmail}
              disabled={!testEmail.trim() || !settings.resend_api_key.trim() || sendTestStatus === 'testing'}
              className="flex-shrink-0"
            >
              {sendTestStatus === 'testing' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang gửi...</>
              ) : sendTestStatus === 'success' ? (
                <><CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />Đã gửi</>
              ) : sendTestStatus === 'error' ? (
                <><AlertCircle className="h-4 w-4 mr-2 text-red-600" />Thất bại</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Gửi thử</>
              )}
            </Button>
          </div>
          {sendTestStatus === 'success' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />Email thử nghiệm đã được gửi, kiểm tra hộp thư của bạn.
            </p>
          )}
          {sendTestStatus === 'error' && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />Gửi thất bại. Kiểm tra API Key và email gửi.
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {saveSuccess && (
            <p className="text-sm text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />Đã lưu thành công
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} disabled={!isDirty || saving}>
            Hủy thay đổi
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang lưu...</>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default EmailSettings