// src/pages/ProfileSettingsPage.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, Phone, Lock, Upload, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { useTranslation } from 'react-i18next'

export function ProfileSettingsPage() {
  const { t } = useTranslation()
  const { user, profile, updateProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: ''
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Load profile data when user or profile changes
    useEffect(() => {
      if (user) {
        const metadata = (user as any)?.user_metadata || {}
        
        setProfileData({
          full_name: profile?.full_name || metadata.full_name || '',
          email: user.email || '',
          phone: profile?.phone || metadata.phone || '',
          avatar_url: profile?.avatar_url || metadata.avatar_url || ''
        })
      }
    }, [user, profile])

  const getInitials = () => {
    if (profileData.full_name) {
      const names = profileData.full_name.split(' ')
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase()
    }
    return user?.email?.[0].toUpperCase() || 'U'
  }

  const handleProfileUpdate = async () => {
    if (!profileData.full_name || profileData.full_name.trim() === '') {
      alert(t('profile.messages.nameRequired'))
      return
    }

    setLoading(true)
    try {
      const { error } = await updateProfile({
        full_name: profileData.full_name,
        phone: profileData.phone
      })

      if (error) {
        alert(t('profile.messages.saveError'))
        console.error('Profile update error:', error)
      } else {
        alert(t('profile.messages.saveSuccess'))
      }
    } catch (error) {
      alert(t('profile.messages.saveError'))
      console.error('Profile update exception:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert(t('profile.messages.passwordMismatch'))
      return
    }

    if (passwordData.newPassword.length < 6) {
      alert(t('profile.security.passwordRequirements'))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
})

      if (error) {
        alert(t('profile.messages.passwordChangeError'))
        console.error('Password change error:', error)
      } else {
        alert(t('profile.messages.passwordChangeSuccess'))
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      }
    } catch (error) {
      alert(t('profile.messages.passwordChangeError'))
      console.error('Password change exception:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validation
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB')
      return
    }

    if (!user) {
      alert('You must be logged in to upload avatar')
      return
    }

    setLoading(true)
    try {
      console.log('📤 Starting avatar upload...')
      
      // Step 1: Generate unique filename with user ID prefix
      const fileExt = file.name.split('.').pop()
      const timestamp = Date.now()
      const fileName = `${user.id}/${timestamp}.${fileExt}`
      
      console.log('📁 Upload path:', fileName)

      // Step 2: Delete old avatar if exists
      if (profileData.avatar_url) {
        try {
          // Extract path from URL (format: .../storage/v1/object/public/avatars/USER_ID/file.ext)
          const urlParts = profileData.avatar_url.split('/avatars/')
          if (urlParts.length > 1) {
            const oldPath = urlParts[1]
            console.log('🗑️ Deleting old avatar:', oldPath)
            await supabase.storage.from('avatars').remove([oldPath])
          }
        } catch (err) {
          console.warn('⚠️ Could not delete old avatar:', err)
          // Continue anyway
        }
      }

      // Step 3: Upload new avatar
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        throw uploadError
      }

      console.log('✅ Upload successful:', uploadData)

      // Step 4: Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      console.log('🔗 Public URL:', publicUrl)

      // Step 5: Update profile in database
      const { error: updateError } = await updateProfile({ 
        avatar_url: publicUrl 
      })

      if (updateError) {
        console.error('❌ Profile update error:', updateError)
        throw updateError
      }

      // Step 6: Update local state
      setProfileData(prev => ({ ...prev, avatar_url: publicUrl }))
console.log('✅ Avatar updated successfully')
      alert(t('profile.messages.saveSuccess'))
      
    } catch (error) {
      console.error('❌ Avatar upload failed:', error)
      
      // Better error message
      if (error instanceof Error) {
        alert(`Error uploading avatar: ${error.message}`)
      } else {
        alert('Error uploading avatar. Please try again.')
      }
    } finally {
      setLoading(false)
      // Reset file input
      e.target.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('profile.title')}</h1>
          <p className="text-muted-foreground">{t('profile.subtitle')}</p>
        </div>

        {/* Personal Information Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <CardTitle>{t('profile.personalInfo.title')}</CardTitle>
            </div>
            <CardDescription>{t('profile.personalInfo.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24">
                {profileData.avatar_url ? (
                  <AvatarImage src={profileData.avatar_url} alt={profileData.full_name} />
                ) : (
                  <AvatarFallback className="text-2xl bg-blue-600 text-white">
                    {getInitials()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('profile.personalInfo.avatar')}</p>
                <div className="flex gap-2">
                  <label htmlFor="avatar-upload">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {t('profile.personalInfo.uploadAvatar')}
                    </Button>
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, GIF. Max 2MB
                </p>
              </div>
            </div>

            {/* Full Name Input */}
            <div className="space-y-2">
<Label htmlFor="full_name">
                {t('profile.personalInfo.fullName')} <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  placeholder={t('profile.personalInfo.fullNamePlaceholder')}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Email Input (Disabled) */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('profile.personalInfo.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={profileData.email}
                  disabled
                  className="pl-10 bg-gray-100"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('profile.personalInfo.emailNote')}
              </p>
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
              <Label htmlFor="phone">{t('profile.personalInfo.phone')}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder={t('profile.personalInfo.phonePlaceholder')}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                disabled={loading}
              >
                {t('profile.buttons.cancel')}
              </Button>
              <Button onClick={handleProfileUpdate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('profile.buttons.saving')}
                  </>
                ) : (
                  t('profile.buttons.save')
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
<CardTitle>{t('profile.security.title')}</CardTitle>
            </div>
            <CardDescription>{t('profile.security.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('profile.security.currentPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  className="pl-10"
                />
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('profile.security.newPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('profile.security.confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('profile.security.passwordRequirements')}
              </p>
            </div>

            {/* Change Password Button */}
            <div className="flex justify-end">
              <Button
                onClick={handlePasswordChange}
                disabled={loading || !passwordData.newPassword}
                variant="secondary"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('profile.buttons.saving')}
                  </>
) : (
                  t('profile.security.changePassword')
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}