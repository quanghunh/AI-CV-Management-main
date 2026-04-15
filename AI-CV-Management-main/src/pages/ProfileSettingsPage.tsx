// src/pages/ProfileSettingsPage.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, Phone, Upload, Loader2 } from "lucide-react"
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

  const isSystemUser = user && !(user as any).isCustomAuth

  // Load profile data when user or profile changes
  useEffect(() => {
    async function loadSystemProfile() {
      if (user) {
        if (isSystemUser) {
          console.log("Loading system profile from 'profiles' table...");
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (error) {
            console.warn("Could not fetch profile from 'profiles' table:", error.message);
          }

          const metadata = (user as any)?.user_metadata || {}
          
          setProfileData({
            full_name: data?.full_name || metadata.full_name || '',
            email: user.email || '',
            phone: data?.phone || '',
            avatar_url: data?.avatar_url || metadata.avatar_url || ''
          })
        } else {
          // CustomAuth User (Candidate or Admin via Custom Auth)
          setProfileData({
            full_name: profile?.full_name || '',
            email: user.email || '',
            phone: profile?.phone || '',
            avatar_url: profile?.avatar_url || ''
          })
        }
      }
    }
    
    if (user) {
      loadSystemProfile()
    }
  }, [user, profile, isSystemUser])

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
    if (!user) return;
    
    if (!profileData.full_name || profileData.full_name.trim() === '') {
      alert(t('profile.messages.nameRequired'))
      return
    }

    setLoading(true)
    try {
      if (isSystemUser) {
        // 1. Update the system profiles table
        const { error: dbError } = await supabase
          .from('profiles')
          .update({
            full_name: profileData.full_name,
            phone: profileData.phone
          })
          .eq('id', user.id);

        if (dbError) throw dbError;

        // 2. Also keep auth meta_data in sync
        await supabase.auth.updateUser({
          data: { full_name: profileData.full_name }
        });
      } else {
        // 1. Update custom user via Context function
        const { error } = await updateProfile({
          full_name: profileData.full_name,
          phone: profileData.phone
        });
        if (error) throw error;
      }

      alert(t('profile.messages.saveSuccess'))
    } catch (error) {
      alert(t('profile.messages.saveError'))
      console.error('Profile update exception:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0]
    if (!file) return

    // Validation
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng upload định dạng hình ảnh (JPG, PNG)')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Kích thước ảnh phải nhỏ hơn 2MB')
      return
    }

    setLoading(true)
    try {
      console.log('📤 Starting avatar upload...')
      
      // Step 1: Generate unique filename with prefix isolating system users and candidates
      const fileExt = file.name.split('.').pop()
      const timestamp = Date.now()
      const prefix = isSystemUser ? 'system_users' : 'candidates_avatars'
      const fileName = `${prefix}/${user.id}/${timestamp}.${fileExt}`
      
      console.log('📁 Upload path:', fileName)

      // Step 2: Upload new avatar
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

      // Step 3: Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      console.log('🔗 Public URL:', publicUrl)

      // Step 4: Update profile in database directly
      if (isSystemUser) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);

        if (updateError) {
          console.error('❌ Profile DB update error:', updateError)
          throw updateError
        }
        
        // Update auth meta as well
        await supabase.auth.updateUser({
          data: { avatar_url: publicUrl }
        });
      } else {
        const { error: updateError } = await updateProfile({
          avatar_url: publicUrl
        });
        if (updateError) throw updateError;
      }

      // Step 5: Update local state
      setProfileData(prev => ({ ...prev, avatar_url: publicUrl }))
      console.log('✅ Avatar updated successfully')
      alert(t('profile.messages.saveSuccess'))
      
    } catch (error) {
      console.error('❌ Avatar upload failed:', error)
      if (error instanceof Error) {
        alert(`Error uploading avatar: ${error.message}`)
      } else {
        alert('Error uploading avatar. Please try again.')
      }
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <>
      <div className="sm:hidden flex flex-col items-center justify-center min-h-[80vh] p-6 text-center space-y-4">
        <div className="bg-gray-100 p-4 rounded-full">
          <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800">Không hỗ trợ di động</h2>
        <p className="text-gray-500">Do not support for device mobile, We're Launching Soon</p>
      </div>
      <div className="hidden sm:block">
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

      </div>
    </div>
      </div>
    </>
  )
}