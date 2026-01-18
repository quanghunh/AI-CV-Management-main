// src/components/settings/EmailSettings.tsx
"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { useTranslation } from 'react-i18next'
import { Loader2 } from "lucide-react"

interface EmailSettingsData {
  id?: string
  resend_api_key?: string
  from_email?: string
  from_name?: string
}

export function EmailSettings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<EmailSettingsData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("cv_email_settings")
        .select("*")
        .single()
      
      if (error && error.code !== "PGRST116") throw error
      if (data) setSettings(data)
    } catch (err: any) {
      console.error(err)
      toast.error("Lỗi tải thông tin email: " + (err?.message ?? ""))
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setSettings((prev) => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    // Validation
    if (!settings.resend_api_key?.trim()) {
      toast.error("Vui lòng nhập Resend API Key")
      return
    }
    if (!settings.from_email?.trim()) {
      toast.error("Vui lòng nhập Email gửi")
      return
    }
    if (!settings.from_name?.trim()) {
      toast.error("Vui lòng nhập Tên người gửi")
      return
    }

    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('cv_email_settings')
        .upsert({ 
          ...settings, 
          id: settings.id || undefined,
          updated_at: new Date().toISOString()
        })
      
      if (error) throw error
      toast.success("Lưu thành công")
      
      // Reload to confirm
      await fetchSettings()
    } catch (err: any) {
      console.error(err)
      toast.error("Lỗi lưu: " + (err?.message ?? ""))
    } finally {
      setSaving(false)
    }
  }

  const handleTestKey = async () => {
    if (!settings.resend_api_key?.trim()) {
      toast.error("Vui lòng nhập Resend API Key trước khi kiểm tra")
      return
    }

    setTesting(true)
    
    try {
      const response = await fetch('/api/test-resend-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.resend_api_key })
      })

      if (response.ok) {
        toast.success("API Key hợp lệ và đang hoạt động")
      } else {
        const error = await response.json()
        toast.error("API Key không hợp lệ: " + (error.message || "Lỗi không xác định"))
      }
    } catch (err) {
      toast.error("Lỗi kết nối khi kiểm tra")
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Cấu hình dịch vụ email của bạn (Ví dụ: Resend)</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="resend_api_key">Resend API Key</Label>
            <div className="mt-1 flex gap-2">
              <Input 
                id="resend_api_key" 
                value={settings.resend_api_key || ''} 
                onChange={handleInputChange}
                placeholder="re_..."
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={handleTestKey} 
                disabled={testing}
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang kiểm tra...
                  </>
                ) : (
                  "Kiểm tra API Key"
                )}
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Lấy API Key từ Resend
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="from_email">Email gửi</Label>
              <Input 
                id="from_email" 
                value={settings.from_email || ''} 
                onChange={handleInputChange}
                placeholder="noreply@company.com"
              />
            </div>
            <div>
              <Label htmlFor="from_name">Tên người gửi</Label>
              <Input 
                id="from_name" 
                value={settings.from_name || ''} 
                onChange={handleInputChange}
                placeholder="Recruit AI"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button 
          variant="outline"
          onClick={() => window.location.reload()}
          disabled={saving}
        >
          Hủy
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            "Lưu thay đổi"
          )}
        </Button>
      </div>
    </div>
  )
}