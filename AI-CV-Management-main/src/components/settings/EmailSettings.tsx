// src/components/settings/EmailSettings.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { KeyRound, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

interface EmailSettingsData {
  id?: string
  resend_api_key: string
  sending_email: string
  sender_name: string
  updated_at?: string
}

export function EmailSettings() {
  const [apiKey, setApiKey] = useState("")
  const [sendingEmail, setSendingEmail] = useState("onboarding@resend.dev")
  const [senderName, setSenderName] = useState("Recruit AI")
  const [isLoading, setIsLoading] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)

  // Load settings khi component mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      // Lấy row mới nhất (theo updated_at hoặc created_at)
      const { data, error } = await supabase
        .from('cv_email_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        // Nếu không có data thì bỏ qua lỗi
        if (error.code === 'PGRST116') {
          console.log('No settings found, using defaults')
          return
        }
        console.error('Error loading settings:', error)
        alert(`Lỗi tải cài đặt: ${error.message}`)
        return
      }

      if (data) {
        setApiKey(data.resend_api_key || "")
        setSendingEmail(data.sending_email || "onboarding@resend.dev")
        setSenderName(data.sender_name || "Recruit AI")
        setSettingsId(data.id)
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      alert('Không thể tải cài đặt email')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('Vui lòng nhập Resend API Key')
      return
    }

    setIsLoading(true)
    try {
      const settingsData: EmailSettingsData = {
        resend_api_key: apiKey,
        sending_email: sendingEmail,
        sender_name: senderName,
        updated_at: new Date().toISOString()
      }

      let result

      if (settingsId) {
        // Update existing record
        result = await supabase
          .from('cv_email_settings')
          .update(settingsData)
          .eq('id', settingsId)
          .select()
          .single()
      } else {
        // Insert new record
        result = await supabase
          .from('cv_email_settings')
          .insert([settingsData])
          .select()
          .single()
      }

      if (result.error) {
        throw result.error
      }

      setSettingsId(result.data.id)
      localStorage.setItem('email_settings_updated', 'true'); // Trigger update event

      alert('Cài đặt email đã được lưu thành công!')
    } catch (error: any) {
      console.error('Error saving settings:', error)
      alert(`Lỗi lưu cài đặt: ${error.message || 'Không thể lưu cài đặt'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestAPI = () => {
    if (!apiKey.trim()) {
      alert('Vui lòng nhập Resend API Key')
      return
    }

    // Kiểm tra format cơ bản
    if (!apiKey.startsWith('re_')) {
      alert('API Key phải bắt đầu bằng "re_"')
      return
    }

    alert('Format API Key hợp lệ! Hãy lưu cài đặt và test bằng cách gửi email từ hệ thống.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Cài đặt Email
        </CardTitle>
        <CardDescription>Cấu hình dịch vụ gửi email của bạn (ví dụ: Resend).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="resend-api-key">Resend API Key</Label>
          <Input
            id="resend-api-key"
            type="password"
            placeholder="re_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-sm text-muted-foreground">
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Lấy API key từ Resend Dashboard
            </a>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sending-email">Email gửi</Label>
            <Input
              id="sending-email"
              type="email"
              value={sendingEmail}
              onChange={(e) => setSendingEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender-name">Tên người gửi</Label>
            <Input
              id="sender-name"
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu cài đặt
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleTestAPI} 
            disabled={isLoading}
          >
            Kiểm tra định dạng
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}