// src/components/settings/CompanySettings.tsx
"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Upload, Building2, Globe, Palette, RefreshCw, Check, X,
  Image as ImageIcon, Mail, MapPin, Info, CheckCircle2, AlertCircle
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

// ─── Props ────────────────────────────────────────────────────────────────────

interface CompanySettingsProps {
  profile: any
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const BUCKET_NAME = 'logos'
const LOGO_PATH = 'company_logo'

const COLOR_PRESETS = [
  { name: 'Mặc định',  button: '#222831', menu: '#e8f4fa' },
  { name: 'Xanh dương', button: '#2563eb', menu: '#dbeafe' },
  { name: 'Xanh lá',   button: '#16a34a', menu: '#dcfce7' },
  { name: 'Tím',       button: '#9333ea', menu: '#f3e8ff' },
  { name: 'Cam',       button: '#ea580c', menu: '#ffedd5' },
  { name: 'Hồng',      button: '#db2777', menu: '#fce7f3' },
  { name: 'Chàm',      button: '#4f46e5', menu: '#e0e7ff' },
  { name: 'Xanh ngọc', button: '#0d9488', menu: '#ccfbf1' },
  { name: 'Đỏ',        button: '#dc2626', menu: '#fee2e2' },
  { name: 'Xám',       button: '#475569', menu: '#f1f5f9' },
  { name: 'Lá emerald',button: '#059669', menu: '#d1fae5' },
  { name: 'Vàng',      button: '#d97706', menu: '#fef3c7' },
]

// ─── Color utilities ──────────────────────────────────────────────────────────

const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

const applyThemeColors = (buttonColor: string, menuColor: string) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const btn = hexToHSL(buttonColor)
  const mnu = hexToHSL(menuColor)

  root.style.setProperty('--primary', `${btn.h} ${btn.s}% ${btn.l}%`)
  root.style.setProperty('--primary-foreground', btn.l > 55 ? '0 0% 10%' : '0 0% 100%')
  root.style.setProperty('--secondary', `${mnu.h} ${mnu.s}% ${mnu.l}%`)
  root.style.setProperty('--secondary-foreground', mnu.l > 55 ? '222.2 47.4% 11.2%' : '0 0% 100%')
  root.style.setProperty('--accent', `${btn.h} ${Math.max(btn.s - 20, 30)}% ${Math.min(btn.l + 45, 95)}%`)
  root.style.setProperty('--accent-foreground', `${btn.h} ${btn.s}% ${btn.l}%`)
  root.style.setProperty('--muted', `${mnu.h} ${Math.max(mnu.s - 10, 0)}% ${Math.min(mnu.l + 2, 98)}%`)
  root.style.setProperty('--muted-foreground', mnu.l > 70 ? '215.4 16.3% 46.9%' : '0 0% 60%')
  root.style.setProperty('--ring', `${btn.h} ${btn.s}% ${btn.l}%`)
  root.style.setProperty('--border', `${mnu.h} ${Math.max(mnu.s - 20, 15)}% ${Math.min(mnu.l + 10, 95)}%`)
  root.style.setProperty('--sidebar-bg', buttonColor)
  root.style.setProperty('--sidebar-text', '#FFFFFF')
  root.style.setProperty('--sidebar-active', `${btn.h} ${Math.min(btn.s + 10, 100)}% ${Math.min(btn.l + 10, 90)}%`)
  root.style.setProperty('--sidebar-hover', `${btn.h} ${btn.s}% ${Math.min(btn.l + 5, 85)}%`)
  root.style.setProperty('--card-highlight', menuColor)
  root.style.setProperty('--card-border', `hsl(${mnu.h} ${Math.max(mnu.s - 15, 0)}% ${Math.max(mnu.l - 10, 80)}%)`)
}

const persistColors = (btn: string, mnu: string) => {
  localStorage.setItem('theme-button-color', btn)
  localStorage.setItem('theme-menu-color', mnu)
}

const loadPersistedColors = () => {
  if (typeof window === 'undefined') {
    return { buttonColor: '#222831', menuColor: '#e8f4fa' }
  }

  const rawButton = localStorage.getItem('theme-button-color') || '#222831'
  const rawMenu = localStorage.getItem('theme-menu-color') || '#e8f4fa'
  const validHex = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value)

  return {
    buttonColor: validHex(rawButton) ? rawButton : '#222831',
    menuColor: validHex(rawMenu) ? rawMenu : '#e8f4fa',
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Inline section card with consistent header */
function SectionCard({
  icon, title, description, children, className = ''
}: {
  icon: React.ReactNode; title: string; description?: string
  children: React.ReactNode; className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompanySettings({ profile, handleInputChange }: CompanySettingsProps) {
  // ── color state ──────────────────────────────────────────────────────────
  const init = loadPersistedColors()
  const [buttonColor, setButtonColor] = useState(init.buttonColor)
  const [menuColor, setMenuColor] = useState(init.menuColor)
  const [colorApplied, setColorApplied] = useState(false)
  const [colorSaving, setColorSaving] = useState(false)

  // ── logo state ───────────────────────────────────────────────────────────
  const [logo, setLogo] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoError, setLogoError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoSaving, setLogoSaving] = useState(false)
  const [logoSaveSuccess, setLogoSaveSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── on mount: apply saved colors + load logo ─────────────────────────────
  useEffect(() => {
    applyThemeColors(buttonColor, menuColor)
    loadLogo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'company-logo') return
      setLogo(event.newValue)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    if (colorApplied) {
      setColorApplied(false)
    }
  }, [buttonColor, menuColor])

  // ── Logo helpers ─────────────────────────────────────────────────────────

  const loadLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('cv_company_profile')
        .select('logo_url')
        .eq('id', COMPANY_PROFILE_ID)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') return
      if (data?.logo_url) {
        setLogo(data.logo_url)
        localStorage.setItem('company-logo', data.logo_url)
      } else {
        setLogo(null)
        localStorage.removeItem('company-logo')
      }
    } catch (err) {
      console.error('loadLogo error:', err)
    }
  }

  const upsertCompanyProfile = async (payload: Record<string, any>) => {
    // try update first
    const { data, error } = await supabase
      .from('cv_company_profile')
      .update(payload)
      .eq('id', COMPANY_PROFILE_ID)
      .select()
      .maybeSingle()
    if (error) throw error
    // if nothing was updated, insert
    if (!data) {
      const { error: insertErr } = await supabase
        .from('cv_company_profile')
        .insert({ id: COMPANY_PROFILE_ID, company_name: profile?.company_name || 'Recruit AI', ...payload })
      if (insertErr) throw insertErr
    }
  }

  const broadcastLogoChange = (url: string | null) => {
    const previousValue = localStorage.getItem('company-logo')
    if (url) localStorage.setItem('company-logo', url)
    else localStorage.removeItem('company-logo')

    window.dispatchEvent(new Event('logo-updated'))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'company-logo',
      oldValue: previousValue,
      newValue: url,
      url: window.location.href,
      storageArea: localStorage,
    }))
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      setLogoError('Vui lòng chọn file ảnh hợp lệ (PNG, JPG, SVG)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Kích thước file không được vượt quá 2MB')
      return
    }

    setLogoError('')
    setLogoUploading(true)
    setLogoFile(file)

    // Local preview first
    const reader = new FileReader()
    reader.onloadend = async () => {
      setLogo(reader.result as string)
      setLogoUploading(false)
      setLogoSaving(true)
      try {
        // Upload to storage
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET_NAME).upload(LOGO_PATH, file, { upsert: true })
        if (uploadErr) throw uploadErr

        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(LOGO_PATH)
        if (!data?.publicUrl) {
          throw new Error('Không lấy được URL công khai của logo')
        }
        await upsertCompanyProfile({ logo_url: data.publicUrl })
        setLogo(data.publicUrl)
        broadcastLogoChange(data.publicUrl)
        setLogoSaveSuccess(true)
        setTimeout(() => setLogoSaveSuccess(false), 3000)
      } catch (err: any) {
        setLogoError('Không thể lưu logo vào hệ thống. Vui lòng thử lại.')
        console.error('logo save error:', err)
      } finally {
        setLogoSaving(false)
      }
    }
    reader.onerror = () => {
      setLogoError('Có lỗi xảy ra khi đọc file ảnh')
      setLogoUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleLogoRemove = async () => {
    setLogoSaving(true)
    try {
      await supabase.storage.from(BUCKET_NAME).remove([LOGO_PATH])
      await upsertCompanyProfile({ logo_url: null })
      setLogo(null)
      setLogoFile(null)
      setLogoError('')
      broadcastLogoChange(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: any) {
      setLogoError('Không thể xóa logo. Vui lòng thử lại.')
      console.error('logo remove error:', err)
    } finally {
      setLogoSaving(false)
    }
  }

  // ── Color helpers ────────────────────────────────────────────────────────

  const handleApplyColors = useCallback(() => {
    setColorSaving(true)
    applyThemeColors(buttonColor, menuColor)
    persistColors(buttonColor, menuColor)
    setTimeout(() => {
      setColorSaving(false)
      setColorApplied(true)
      setTimeout(() => setColorApplied(false), 2500)
    }, 300)
  }, [buttonColor, menuColor])

  const handleResetColors = () => {
    const btn = '#222831', mnu = '#e8f4fa'
    setButtonColor(btn); setMenuColor(mnu)
    applyThemeColors(btn, mnu); persistColors(btn, mnu)
  }

  const btnHSL = hexToHSL(buttonColor)
  const mnuHSL = hexToHSL(menuColor)

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── 1. Thông tin công ty ── */}
      <SectionCard
        icon={<Building2 className="w-5 h-5" />}
        title="Thông tin công ty"
        description="Cập nhật tên, website và thông tin cơ bản của công ty"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_name">
              Tên công ty <span className="text-red-500">*</span>
            </Label>
            <Input
              id="company_name"
              value={profile.company_name || ''}
              onChange={handleInputChange}
              placeholder="Tên công ty của bạn"
              className="font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-1.5">
              <Globe className="w-4 h-4" />Website
            </Label>
            <Input
              id="website"
              type="url"
              value={profile.website || ''}
              onChange={handleInputChange}
              placeholder="https://yourcompany.com"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Mô tả công ty ── */}
      <SectionCard
        icon={<Info className="w-5 h-5" />}
        title="Mô tả công ty"
        description="Giới thiệu ngắn gọn về công ty của bạn"
      >
        <Textarea
          id="company_description"
          value={profile.company_description || ''}
          onChange={handleInputChange}
          className="min-h-[120px] resize-y"
          placeholder="Mô tả về lĩnh vực hoạt động, văn hóa công ty, sứ mệnh..."
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {(profile.company_description || '').length} ký tự
        </p>
      </SectionCard>

      {/* ── 3. Địa chỉ & liên hệ ── */}
      <SectionCard
        icon={<MapPin className="w-5 h-5" />}
        title="Địa chỉ và liên hệ"
        description="Thông tin liên lạc và địa chỉ văn phòng"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_address">Địa chỉ</Label>
            <Input
              id="company_address"
              value={profile.company_address || ''}
              onChange={handleInputChange}
              placeholder="Số nhà, đường, phường, quận, thành phố"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email" className="flex items-center gap-1.5">
              <Mail className="w-4 h-4" />Email liên hệ
            </Label>
            <Input
              id="contact_email"
              type="email"
              value={profile.contact_email || ''}
              onChange={handleInputChange}
              placeholder="contact@company.com"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── 4. Logo công ty ── */}
      <Card className="border-2 border-blue-200 bg-blue-50/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Logo công ty</CardTitle>
              </div>
              <CardDescription className="mt-1">
                🌐 Logo chung cho toàn hệ thống — tất cả người dùng sẽ thấy logo này
              </CardDescription>
            </div>
            {logo && (
              <Button variant="outline" size="sm" onClick={handleLogoRemove} disabled={logoSaving}
                className="flex-shrink-0 hover:bg-red-50 hover:text-red-600 hover:border-red-300">
                <X className="w-4 h-4 mr-1.5" />Xóa logo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            onChange={handleLogoSelect} className="hidden" disabled={logoUploading || logoSaving} />

          {logo ? (
            <div className="space-y-4">
              {/* Main preview */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-xl border-2 bg-white shadow-sm">
                <div className="w-40 h-40 rounded-xl border-2 border-dashed border-primary/30 bg-gray-50 flex items-center justify-center shadow-inner flex-shrink-0">
                  <img src={logo} alt="Logo công ty" className="max-w-full max-h-full object-contain p-2" />
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <h4 className="font-semibold text-gray-900">Logo hiện tại</h4>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {logoFile?.name || 'Logo đã lưu trong hệ thống'}
                    </p>
                  </div>
                  {logoFile && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p><span className="font-medium">Kích thước:</span> {(logoFile.size / 1024).toFixed(1)} KB</p>
                      <p><span className="font-medium">Định dạng:</span> {logoFile.type.split('/')[1].toUpperCase()}</p>
                    </div>
                  )}
                  {logoSaveSuccess && (
                    <div className="flex items-center gap-1.5 text-green-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Logo đã được lưu thành công!</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}
                      disabled={logoUploading || logoSaving}>
                      <Upload className="w-4 h-4 mr-1.5" />Thay đổi logo
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleLogoRemove} disabled={logoSaving}
                      className="hover:bg-red-50 hover:text-red-600 hover:border-red-300">
                      <X className="w-4 h-4 mr-1.5" />Xóa
                    </Button>
                  </div>
                </div>
              </div>

              {/* Size previews */}
              <div className="p-4 bg-gray-50 rounded-xl border">
                <p className="text-sm font-medium mb-3 text-gray-700">Xem trước các kích thước:</p>
                <div className="flex flex-wrap items-end gap-6">
                  {[
                    { label: '64×64', size: 'w-16 h-16', padding: 'p-1.5' },
                    { label: '96×96', size: 'w-24 h-24', padding: 'p-2' },
                    { label: '128×128', size: 'w-32 h-32', padding: 'p-3' },
                  ].map(({ label, size, padding }) => (
                    <div key={label} className="text-center space-y-1.5">
                      <div className={`${size} border-2 border-gray-200 rounded-lg bg-white ${padding} flex items-center justify-center shadow-sm`}>
                        <img src={logo} alt={label} className="max-w-full max-h-full object-contain" />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Upload zone
            <div
              onClick={() => !(logoUploading || logoSaving) && fileRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-all
                ${logoUploading || logoSaving
                  ? 'border-blue-300 bg-blue-50/50 cursor-wait'
                  : 'border-gray-300 hover:border-primary/50 hover:bg-primary/5 cursor-pointer group'}`}
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Upload className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Tải lên logo công ty</h4>
              <p className="text-sm text-muted-foreground mb-4">Nhấp để chọn hoặc kéo thả file vào đây</p>
              <Button variant="outline" className="pointer-events-none" size="sm">Chọn file</Button>
              <p className="text-xs text-muted-foreground mt-3">PNG, JPG, SVG — tối đa 2MB</p>
            </div>
          )}

          {/* Status indicators */}
          {(logoUploading || logoSaving) && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              {logoUploading ? 'Đang đọc file...' : 'Đang lưu vào hệ thống...'}
            </div>
          )}
          {logoError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{logoError}
            </div>
          )}

          {/* Guidelines */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-2">
            <p className="font-semibold text-blue-900 flex items-center gap-1.5">
              <span>💡</span> Hướng dẫn:
            </p>
            <ul className="ml-4 list-disc space-y-1 text-blue-800">
              <li>Logo nên có nền trong suốt (PNG)</li>
              <li>Tỉ lệ khuyến nghị: vuông (1:1), kích thước 512×512px</li>
              <li className="font-semibold text-green-700">✅ Logo sẽ đồng bộ cho <strong>TẤT CẢ</strong> người dùng trong hệ thống</li>
              <li className="font-semibold text-orange-700">⚠️ Mọi thay đổi sẽ ảnh hưởng đến toàn bộ hệ thống</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ── 5. Màu sắc giao diện ── */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent rounded-t-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Màu sắc giao diện</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Tuỳ chỉnh màu sắc của sidebar, nút bấm và các thành phần trong hệ thống
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetColors}
              className="flex-shrink-0 hover:bg-red-50 hover:text-red-600 hover:border-red-300">
              <RefreshCw className="w-4 h-4 mr-1.5" />Đặt lại
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">

          {/* Color pickers */}
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                id: 'btn', label: 'Màu chính (nút bấm, sidebar)',
                desc: 'Áp dụng cho nút bấm, thanh sidebar và các thành phần chính',
                value: buttonColor, setter: setButtonColor, placeholder: '#222831'
              },
              {
                id: 'mnu', label: 'Màu phụ (nền, card)',
                desc: 'Áp dụng cho nền menu, thẻ card và các khu vực phụ',
                value: menuColor, setter: setMenuColor, placeholder: '#e8f4fa'
              },
            ].map(({ id, label, desc, value, setter, placeholder }) => (
              <div key={id} className="space-y-2.5">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0"
                    style={{ backgroundColor: value }} />
                  {label}
                </Label>
                <div className="flex items-center gap-2">
                  {/* Color swatch */}
                  <div className="relative flex-shrink-0">
                    <input type="color" value={value}
                      onChange={e => setter(e.target.value)}
                      className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer p-0.5 hover:border-primary transition-colors"
                      style={{ padding: '3px' }}
                    />
                  </div>
                  {/* HEX input */}
                  <Input
                    value={value.toUpperCase()}
                    onChange={e => {
                      const v = e.target.value
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(v) || v === '') setter(v)
                    }}
                    placeholder={placeholder}
                    className="font-mono text-sm uppercase font-semibold"
                    maxLength={7}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          {/* Preset palette */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4" />Bộ màu có sẵn
            </Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {COLOR_PRESETS.map(preset => {
                const active =
                  buttonColor.toLowerCase() === preset.button.toLowerCase() &&
                  menuColor.toLowerCase() === preset.menu.toLowerCase()
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => { setButtonColor(preset.button); setMenuColor(preset.menu) }}
                    className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5
                      ${active ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-200 hover:border-primary/40'}`}
                  >
                    <div className="flex gap-1">
                      <div className="w-7 h-7 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: preset.button }} />
                      <div className="w-7 h-7 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: preset.menu }} />
                    </div>
                    <span className={`text-[10px] font-medium leading-tight text-center ${active ? 'text-primary' : 'text-gray-600'}`}>
                      {preset.name}
                    </span>
                    {active && (
                      <div className="absolute -top-1.5 -right-1.5 bg-primary text-white rounded-full p-0.5 shadow">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              👁️ Xem trước giao diện
              {colorApplied && (
                <span className="text-xs font-normal text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />Đã áp dụng!
                </span>
              )}
            </Label>

            <Card className="border-2 border-dashed bg-gradient-to-br from-gray-50 to-white">
              <CardContent className="p-5 space-y-5">
                {/* Button variants */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2.5">Các kiểu nút:</p>
                  <div className="flex flex-wrap gap-2.5">
                    <button className="px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all hover:shadow-md"
                      style={{ backgroundColor: buttonColor, color: btnHSL.l > 55 ? '#111' : '#fff' }}>
                      Nút chính
                    </button>
                    <button className="px-4 py-2 rounded-lg text-sm font-medium border-2 shadow-sm"
                      style={{ backgroundColor: menuColor, borderColor: menuColor, color: mnuHSL.l > 55 ? '#333' : '#fff' }}>
                      Nút phụ
                    </button>
                    <button className="px-4 py-2 rounded-lg text-sm font-medium border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                      Viền
                    </button>
                    <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
                      Ghost
                    </button>
                  </div>
                </div>

                {/* Color cards */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl shadow-sm" style={{ backgroundColor: buttonColor }}>
                    <p className="text-sm font-semibold" style={{ color: btnHSL.l > 55 ? '#111' : '#fff' }}>
                      ✨ Thành phần chính
                    </p>
                    <p className="text-xs mt-1 opacity-80" style={{ color: btnHSL.l > 55 ? '#444' : '#ffffffcc' }}>
                      Sidebar, header, badges
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border shadow-sm" style={{ backgroundColor: menuColor }}>
                    <p className="text-sm font-semibold" style={{ color: mnuHSL.l > 55 ? '#111' : '#fff' }}>
                      🎨 Thành phần phụ
                    </p>
                    <p className="text-xs mt-1 opacity-80" style={{ color: mnuHSL.l > 55 ? '#444' : '#ffffffcc' }}>
                      Card, nền, container
                    </p>
                  </div>
                </div>

                {/* Sidebar preview */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sidebar:</p>
                  <div className="flex rounded-xl overflow-hidden border shadow-sm w-48">
                    <div className="w-24 p-2.5 space-y-1" style={{ backgroundColor: buttonColor }}>
                      {['Dashboard', 'Ứng viên', 'Phỏng vấn'].map((item, i) => (
                        <div key={item} className={`px-2 py-1 rounded text-[10px] font-medium transition-colors
                          ${i === 0 ? 'text-white' : 'text-white/70 hover:text-white'}`}
                          style={i === 0 ? {
                            backgroundColor: `hsl(${btnHSL.h} ${Math.min(btnHSL.s + 10, 100)}% ${Math.min(btnHSL.l + 12, 90)}%)`
                          } : {}}>
                          {item}
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 p-2.5" style={{ backgroundColor: menuColor }}>
                      <div className="text-[10px] font-medium mb-1.5"
                        style={{ color: mnuHSL.l > 55 ? '#333' : '#fff' }}>Nội dung</div>
                      <div className="space-y-1">
                        {[70, 50, 85].map((w, i) => (
                          <div key={i} className="h-1.5 rounded-full bg-gray-300/60" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* HEX values */}
                <div className="flex flex-wrap gap-4 pt-2 border-t border-dashed text-xs text-muted-foreground">
                  {[
                    { label: 'Chính', color: buttonColor, hsl: btnHSL },
                    { label: 'Phụ',   color: menuColor,   hsl: mnuHSL },
                  ].map(({ label, color, hsl }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded border" style={{ backgroundColor: color }} />
                      <span className="font-semibold">{label}:</span>
                      <span className="font-mono">{color.toUpperCase()}</span>
                      <span className="text-[10px] opacity-70">
                        (HSL: {hsl.h}° {hsl.s}% {hsl.l}%)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Apply + tips */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            {/* Tips */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold flex items-center gap-1">💡 Hướng dẫn nhanh:</p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>Chọn màu bằng bảng màu hoặc nhập mã HEX</li>
                <li>Dùng bộ màu có sẵn để chọn nhanh</li>
                <li>Nhấn <strong>"Áp dụng"</strong> để lưu thay đổi</li>
              </ul>
            </div>

            {/* Apply button */}
            <button
              type="button"
              onClick={handleApplyColors}
              disabled={colorApplied || colorSaving}
              style={{
                backgroundColor: colorApplied ? '#10b981' : buttonColor,
                color: '#fff',
                fontWeight: 600,
                minWidth: 180,
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                cursor: colorApplied ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!colorApplied) (e.currentTarget.style.transform = 'translateY(-2px)')
              }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {colorSaving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang lưu...</span></>
              ) : colorApplied ? (
                <><Check className="w-5 h-5" /><span>Đã áp dụng!</span></>
              ) : (
                <><Palette className="w-5 h-5" /><span>Áp dụng màu sắc</span></>
              )}
            </button>
          </div>

          {/* What gets themed */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-xs space-y-3">
            <p className="font-semibold text-blue-900 flex items-center gap-1.5">
              ℹ️ Màu sắc sẽ được áp dụng cho:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-blue-700">
              {['Sidebar menu', 'Tất cả nút bấm', 'Cards & containers',
                'Links & icons', 'Biểu đồ & đồ thị', 'Badges & nhãn'].map(item => (
                <div key={item} className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="text-blue-600 font-medium">
              🔄 Nhấn <strong>"Đặt lại"</strong> để khôi phục màu mặc định bất kỳ lúc nào
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CompanySettings