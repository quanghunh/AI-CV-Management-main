// src/components/settings/CompanySettings.tsx

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Building2, Globe, Languages, Palette, RefreshCw, Check, X, Image as ImageIcon } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useTranslation } from 'react-i18next'
import { supabase } from "@/lib/supabaseClient"

interface CompanySettingsProps {
  profile: any;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

// Hàm chuyển đổi hex sang HSL
const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
  hex = hex.replace('#', '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

// Áp dụng màu sắc vào @theme variables của Tailwind v4
const applyThemeColors = (buttonColor: string, menuColor: string) => {
  const root = document.documentElement;
  
  const buttonHSL = hexToHSL(buttonColor);
  const menuHSL = hexToHSL(menuColor);
  
  root.style.setProperty('--primary', `${buttonHSL.h} ${buttonHSL.s}% ${buttonHSL.l}%`);
  const primaryForeground = buttonHSL.l > 55 ? '0 0% 10%' : '0 0% 100%';
  root.style.setProperty('--primary-foreground', primaryForeground);
  
  root.style.setProperty('--secondary', `${menuHSL.h} ${menuHSL.s}% ${menuHSL.l}%`);
  const secondaryForeground = menuHSL.l > 55 ? '222.2 47.4% 11.2%' : '0 0% 100%';
  root.style.setProperty('--secondary-foreground', secondaryForeground);
  
  const accentL = Math.min(buttonHSL.l + 45, 95);
  root.style.setProperty('--accent', `${buttonHSL.h} ${Math.max(buttonHSL.s - 20, 30)}% ${accentL}%`);
  root.style.setProperty('--accent-foreground', `${buttonHSL.h} ${buttonHSL.s}% ${buttonHSL.l}%`);
  
  root.style.setProperty('--muted', `${menuHSL.h} ${Math.max(menuHSL.s - 10, 0)}% ${Math.min(menuHSL.l + 2, 98)}%`);
  const mutedForeground = menuHSL.l > 70 ? '215.4 16.3% 46.9%' : '0 0% 60%';
  root.style.setProperty('--muted-foreground', mutedForeground);
  
  root.style.setProperty('--ring', `${buttonHSL.h} ${buttonHSL.s}% ${buttonHSL.l}%`);
  
  const borderL = Math.min(menuHSL.l + 10, 95);
  root.style.setProperty('--border', `${menuHSL.h} ${Math.max(menuHSL.s - 20, 15)}% ${borderL}%`);
  
  root.style.setProperty('--sidebar-bg', buttonColor);
  root.style.setProperty('--sidebar-text', '#FFFFFF');
  root.style.setProperty('--sidebar-active', `${buttonHSL.h} ${Math.min(buttonHSL.s + 10, 100)}% ${Math.min(buttonHSL.l + 10, 90)}%`);
  root.style.setProperty('--sidebar-hover', `${buttonHSL.h} ${buttonHSL.s}% ${Math.min(buttonHSL.l + 5, 85)}%`);
  
  root.style.setProperty('--card-highlight', menuColor);
  root.style.setProperty('--card-border', `hsl(${menuHSL.h} ${Math.max(menuHSL.s - 15, 0)}% ${Math.max(menuHSL.l - 10, 80)}%)`);
};

const saveColors = (buttonColor: string, menuColor: string) => {
  localStorage.setItem('theme-button-color', buttonColor);
  localStorage.setItem('theme-menu-color', menuColor);
};

const loadColors = () => {
  return {
    buttonColor: localStorage.getItem('theme-button-color') || '#222831',
    menuColor: localStorage.getItem('theme-menu-color') || '#e8f4fa'
  };
};

// Fixed UUID cho company profile (chung cho toàn hệ thống)
const COMPANY_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const BUCKET_NAME = 'logos';
const LOGO_PATH = 'company_logo';

export function CompanySettings({ profile, handleInputChange }: CompanySettingsProps) {
  const { t, i18n } = useTranslation();
  const savedColors = loadColors();
  const [buttonColor, setButtonColor] = useState(savedColors.buttonColor);
  const [menuColor, setMenuColor] = useState(savedColors.menuColor);
  const [isApplied, setIsApplied] = useState(false);
  
  // Logo states
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLogoFromSupabase();
  }, []);

  const loadLogoFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('cv_company_profile')
        .select('logo_url')
        .eq('id', COMPANY_PROFILE_ID)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error("Error loading logo:", error);
        return;
      }
      
      if (data?.logo_url) {
        setLogo(data.logo_url);
        localStorage.setItem('company-logo', data.logo_url);
      } else {
        setLogo(null);
        localStorage.removeItem('company-logo');
      }
    } catch (error) {
      console.error("Error loading logo:", error);
    }
  };

  const saveLogoToSupabase = async (file: File) => {
    try {
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(LOGO_PATH, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(LOGO_PATH);
      
      const publicUrl = publicData.publicUrl;

      // Save URL to database
      const { data: updateData, error: updateError, count } = await supabase
        .from('cv_company_profile')
        .update({ logo_url: publicUrl })
        .eq('id', COMPANY_PROFILE_ID)
        .select()
        .single();
      
      if (updateError) throw updateError;

      if (count === 0 || !updateData) {
        const companyName = profile?.company_name || 'Recruit AI';
        const { error: insertError } = await supabase
          .from('cv_company_profile')
          .insert({
            id: COMPANY_PROFILE_ID,
            company_name: companyName,
            logo_url: publicUrl
          });
        
        if (insertError) throw insertError;
      }
      
      localStorage.setItem('company-logo', publicUrl);
      window.dispatchEvent(new Event('logo-updated'));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'company-logo',
        newValue: publicUrl,
        url: window.location.href
      }));
      
      return publicUrl;
    } catch (error) {
      console.error("Error saving logo:", error);
      return null;
    }
  };

  const removeLogoFromSupabase = async () => {
    try {
      // Remove from storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([LOGO_PATH]);
      
      if (storageError) console.warn("Error removing logo from storage:", storageError);

      // Update database
      const { data: updateData, error: updateError, count } = await supabase
        .from('cv_company_profile')
        .update({ logo_url: null })
        .eq('id', COMPANY_PROFILE_ID)
        .select()
        .single();
      
      if (updateError) throw updateError;

      if (count === 0 || !updateData) {
        const companyName = profile?.company_name || 'Recruit AI';
        const { error: insertError } = await supabase
          .from('cv_company_profile')
          .insert({
            id: COMPANY_PROFILE_ID,
            company_name: companyName,
            logo_url: null
          });
        
        if (insertError) throw insertError;
      }
      
      localStorage.removeItem('company-logo');
      window.dispatchEvent(new Event('logo-updated'));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'company-logo',
        newValue: null,
        url: window.location.href
      }));
      
      return true;
    } catch (error) {
      console.error("Error removing logo:", error);
      return false;
    }
  };

  useEffect(() => {
    applyThemeColors(buttonColor, menuColor);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const handleApplyColors = () => {
    applyThemeColors(buttonColor, menuColor);
    saveColors(buttonColor, menuColor);
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 2500);
  };

  const handleResetColors = () => {
    const defaultButtonColor = '#222831';
    const defaultMenuColor = '#e8f4fa';
    setButtonColor(defaultButtonColor);
    setMenuColor(defaultMenuColor); 
    applyThemeColors(defaultButtonColor, defaultMenuColor);
    saveColors(defaultButtonColor, defaultMenuColor);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setLogoError(
        i18n.language === 'vi' 
          ? 'Vui lòng chọn file ảnh hợp lệ (PNG, JPG, SVG)' 
          : 'Please select a valid image file (PNG, JPG, SVG)'
      );
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setLogoError(
        i18n.language === 'vi' 
          ? 'Kích thước file không được vượt quá 2MB' 
          : 'File size must not exceed 2MB'
      );
      return;
    }

    setLogoError('');
    setIsUploading(true);
    setLogoFile(file);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = reader.result as string;
      setLogo(result); // for local preview
      setIsUploading(false);
      
      setIsSavingLogo(true);
      const publicUrl = await saveLogoToSupabase(file);
      setIsSavingLogo(false);
      
      if (publicUrl) {
        setLogo(publicUrl);
      } else {
        setLogoError(
          i18n.language === 'vi' 
            ? 'Không thể lưu logo vào hệ thống. Vui lòng thử lại.' 
            : 'Failed to save logo. Please try again.'
        );
      }
    };
    reader.onerror = () => {
      setLogoError(
        i18n.language === 'vi' 
          ? 'Có lỗi xảy ra khi tải ảnh' 
          : 'Error occurred while uploading image'
      );
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setIsSavingLogo(true);
    const success = await removeLogoFromSupabase();
    setIsSavingLogo(false);
    
    if (success) {
      setLogo(null);
      setLogoFile(null);
      setLogoError('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setLogoError(
        i18n.language === 'vi' 
          ? 'Không thể xóa logo. Vui lòng thử lại.' 
          : 'Failed to remove logo. Please try again.'
      );
    }
  };

  const handleLogoButtonClick = () => {
    fileInputRef.current?.click();
  };

  const colorPresets = [
    { name: 'Default', button: '#222831', menu: '#e8f4fa' },
    { name: 'Blue', button: '#2563eb', menu: '#dbeafe' },
    { name: 'Green', button: '#16a34a', menu: '#dcfce7' },
    { name: 'Purple', button: '#9333ea', menu: '#f3e8ff' },
    { name: 'Orange', button: '#ea580c', menu: '#ffedd5' },
    { name: 'Pink', button: '#db2777', menu: '#fce7f3' },
    { name: 'Indigo', button: '#4f46e5', menu: '#e0e7ff' },
    { name: 'Teal', button: '#0d9488', menu: '#ccfbf1' },
    { name: 'Red', button: '#dc2626', menu: '#fee2e2' },
    { name: 'Slate', button: '#475569', menu: '#f1f5f9' },
    { name: 'Emerald', button: '#059669', menu: '#d1fae5' },
    { name: 'Amber', button: '#d97706', menu: '#fef3c7' }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Thông tin công ty */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle>{t('settings.company.title')}</CardTitle>
          </div>
          <CardDescription>
            {t('settings.company.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_name">
              {t('settings.company.name')} <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="company_name" 
              value={profile.company_name || ''} 
              onChange={handleInputChange}
              placeholder={t('settings.company.name')}
              className="font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">
              <Globe className="w-4 h-4 inline mr-1" />
              {t('settings.company.website')}
            </Label>
            <Input 
              id="website" 
              type="url" 
              value={profile.website || ''} 
              onChange={handleInputChange}
              placeholder="https://yourcompany.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ngôn ngữ hệ thống */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            <CardTitle>{t('settings.language.title')}</CardTitle>
          </div>
          <CardDescription>{t('settings.language.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full md:w-1/2">
            <Select 
              value={i18n.language} 
              onValueChange={changeLanguage}
            >
              <SelectTrigger id="language" className="bg-white">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{i18n.language === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
                    <span>{i18n.language === 'vi' ? t('settings.language.vietnamese') : t('settings.language.english')}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                <SelectItem value="vi" className="cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🇻🇳</span>
                    <span>Tiếng Việt</span>
                  </div>
                </SelectItem>
                <SelectItem value="en" className="cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🇬🇧</span>
                    <span>English</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {i18n.language === 'vi' 
                ? '🇻🇳 Ngôn ngữ hiện tại: Tiếng Việt' 
                : '🇬🇧 Current language: English'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logo công ty - CHUNG CHO TOÀN HỆ THỐNG */}
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                <CardTitle>{t('settings.logo.title')}</CardTitle>
              </div>
              <CardDescription className="mt-1">
                {i18n.language === 'vi' 
                  ? '🌐 Logo chung cho toàn hệ thống - Tất cả người dùng sẽ thấy logo này' 
                  : '🌐 System-wide logo - All users will see this logo'}
              </CardDescription>
            </div>
            {logo && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRemoveLogo}
                disabled={isSavingLogo}
                className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
              >
                <X className="w-4 h-4" />
                {i18n.language === 'vi' ? 'Xóa logo' : 'Remove'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            onChange={handleLogoUpload}
            className="hidden"
            disabled={isUploading || isSavingLogo}
          />
          
          {logo ? (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-lg border-2 bg-gradient-to-br from-muted/30 to-background">
                <div className="flex-shrink-0 w-48 h-48 rounded-lg border-2 border-dashed border-primary/30 bg-white p-4 flex items-center justify-center shadow-md">
                  <img 
                    src={logo} 
                    alt="Company Logo" 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-semibold text-lg mb-1">
                      {i18n.language === 'vi' ? 'Logo hiện tại' : 'Current Logo'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {logoFile?.name || (i18n.language === 'vi' ? 'Logo đã lưu trong hệ thống' : 'Logo saved in system')}
                    </p>
                  </div>
                  
                  {logoFile && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium">{i18n.language === 'vi' ? 'Kích thước:' : 'Size:'}</span>{' '}
                        {(logoFile.size / 1024).toFixed(2)} KB
                      </p>
                      <p>
                        <span className="font-medium">{i18n.language === 'vi' ? 'Định dạng:' : 'Format:'}</span>{' '}
                        {logoFile.type.split('/')[1].toUpperCase()}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={handleLogoButtonClick}
                      disabled={isUploading || isSavingLogo}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {i18n.language === 'vi' ? 'Thay đổi logo' : 'Change Logo'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleRemoveLogo}
                      disabled={isSavingLogo}
                      className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                      {i18n.language === 'vi' ? 'Xóa' : 'Remove'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                <p className="text-sm font-medium">
                  {i18n.language === 'vi' ? 'Xem trước các kích thước:' : 'Preview sizes:'}
                </p>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="space-y-2 text-center">
                    <div className="w-16 h-16 border rounded bg-white p-2 flex items-center justify-center">
                      <img src={logo} alt="Logo small" className="max-w-full max-h-full object-contain" />
                    </div>
                    <p className="text-xs text-muted-foreground">64x64</p>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="w-24 h-24 border rounded bg-white p-3 flex items-center justify-center">
                      <img src={logo} alt="Logo medium" className="max-w-full max-h-full object-contain" />
                    </div>
                    <p className="text-xs text-muted-foreground">96x96</p>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="w-32 h-32 border rounded bg-white p-4 flex items-center justify-center">
                      <img src={logo} alt="Logo large" className="max-w-full max-h-full object-contain" />
                    </div>
                    <p className="text-xs text-muted-foreground">128x128</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={handleLogoButtonClick}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Upload className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-semibold mb-2">
                {i18n.language === 'vi' ? 'Tải lên logo công ty' : 'Upload Company Logo'}
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                {i18n.language === 'vi' 
                  ? 'Nhấp để chọn hoặc kéo thả file vào đây' 
                  : 'Click to select or drag and drop file here'}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="pointer-events-none">
                  {t('settings.logo.change')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {t('settings.logo.format')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {i18n.language === 'vi' ? 'Kích thước tối đa: 2MB' : 'Maximum size: 2MB'}
              </p>
            </div>
          )}

          {logoError && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
              <X className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{logoError}</p>
            </div>
          )}

          {(isUploading || isSavingLogo) && (
            <div className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-primary font-medium">
                  {isUploading 
                    ? (i18n.language === 'vi' ? 'Đang tải lên...' : 'Uploading...')
                    : (i18n.language === 'vi' ? 'Đang lưu vào hệ thống...' : 'Saving to system...')
                  }
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="font-semibold text-blue-900 flex items-center gap-2">
              <span>💡</span>
              {i18n.language === 'vi' ? 'Hướng dẫn:' : 'Guidelines:'}
            </p>
            <ul className="space-y-1 ml-4 list-disc text-blue-800">
              <li>{i18n.language === 'vi' ? 'Logo nên có nền trong suốt (PNG)' : 'Logo should have transparent background (PNG)'}</li>
              <li>{i18n.language === 'vi' ? 'Tỉ lệ khuyến nghị: vuông (1:1)' : 'Recommended ratio: square (1:1)'}</li>
              <li>{i18n.language === 'vi' ? 'Kích thước đề xuất: 512x512px' : 'Recommended size: 512x512px'}</li>
              <li className="font-semibold text-green-700">
                {i18n.language === 'vi' 
                  ? '✅ Logo sẽ đồng bộ cho TẤT CẢ người dùng trong hệ thống' 
                  : '✅ Logo will sync for ALL users in the system'}
              </li>
              <li className="font-semibold text-orange-700">
                {i18n.language === 'vi' 
                  ? '⚠️ Mọi thay đổi sẽ ảnh hưởng đến toàn bộ hệ thống' 
                  : '⚠️ Any changes will affect the entire system'}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Mô tả công ty */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.company.description_label')}</CardTitle>
          <CardDescription>{t('settings.company.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea 
            id="company_description" 
            value={profile.company_description || ''} 
            onChange={handleInputChange} 
            className="min-h-[100px]" 
            placeholder={t('settings.company.description_placeholder')}
          />
        </CardContent>
      </Card>

      {/* Địa chỉ và liên hệ */}
      <Card>
        <CardHeader>
          <CardTitle>
            {i18n.language === 'vi' ? 'Địa chỉ và liên hệ' : 'Address and Contact'}
          </CardTitle>
          <CardDescription>
            {i18n.language === 'vi' 
              ? 'Thông tin liên hệ và địa chỉ văn phòng' 
              : 'Contact information and office address'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_address">{t('settings.company.address')}</Label>
            <Input 
              id="company_address" 
              value={profile.company_address || ''} 
              onChange={handleInputChange} 
              placeholder={i18n.language === 'vi' 
                ? 'Số nhà, đường, phường, quận, thành phố' 
                : 'Street, district, city'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">{t('settings.company.email')}</Label>
            <Input 
              id="contact_email" 
              type="email" 
              value={profile.contact_email || ''} 
              onChange={handleInputChange}
              placeholder="contact@company.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Màu sắc giao diện */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <CardTitle>{t('settings.colors.title')}</CardTitle>
              </div>
              <CardDescription className="mt-2">
                {t('settings.colors.description')}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleResetColors}
              className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
            >
              <RefreshCw className="w-4 h-4" />
              {i18n.language === 'vi' ? 'Đặt lại' : 'Reset'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Color Pickers */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                {t('settings.colors.button')}
              </Label>
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Input 
                    type="color" 
                    value={buttonColor} 
                    onChange={(e) => setButtonColor(e.target.value)} 
                    className="h-14 w-14 p-1 cursor-pointer border-2 border-gray-300 hover:border-primary transition-all"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <Palette className="w-3 h-3 text-primary" />
                  </div>
                </div>
                <Input 
                  value={buttonColor.toUpperCase()} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-F]{0,6}$/i.test(val) || val === '') {
                      setButtonColor(val);
                    }
                  }}
                  placeholder="#2563EB"
                  className="font-mono text-sm uppercase font-semibold"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {i18n.language === 'vi' 
                  ? '🎯 Màu cho nút bấm và các thành phần chính' 
                  : '🎯 Color for buttons and primary elements'}
              </p>
            </div>
            
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary"></div>
                {t('settings.colors.menu')}
              </Label>
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Input 
                    type="color" 
                    value={menuColor} 
                    onChange={(e) => setMenuColor(e.target.value)} 
                    className="h-14 w-14 p-1 cursor-pointer border-2 border-gray-300 hover:border-primary transition-all"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <Palette className="w-3 h-3 text-secondary-foreground" />
                  </div>
                </div>
                <Input 
                  value={menuColor.toUpperCase()} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-F]{0,6}$/i.test(val) || val === '') {
                      setMenuColor(val);
                    }
                  }}
                  placeholder="#E0F2FE"
                  className="font-mono text-sm uppercase font-semibold"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {i18n.language === 'vi' 
                  ? '🎨 Màu cho nền menu, card và các khu vực phụ' 
                  : '🎨 Color for menu, card backgrounds and secondary areas'}
              </p>
            </div>
          </div>

          {/* Preset Colors */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4" />
              {i18n.language === 'vi' ? 'Bảng màu có sẵn' : 'Color Presets'}
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {colorPresets.map((preset) => {
                const isActive = buttonColor.toLowerCase() === preset.button.toLowerCase() && 
                                menuColor.toLowerCase() === preset.menu.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setButtonColor(preset.button);
                      setMenuColor(preset.menu);
                    }}
                    className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:shadow-lg hover:scale-105 ${
                      isActive ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex gap-1.5">
                      <div 
                        className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                        style={{ backgroundColor: preset.button }}
                      />
                      <div 
                        className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                        style={{ backgroundColor: preset.menu }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${isActive ? 'text-primary font-semibold' : ''}`}>
                      {preset.name}
                    </span>
                    {isActive && (
                      <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg animate-slide-in">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              👁️ {t('settings.colors.preview')}
              {isApplied && (
                <span className="text-xs text-green-600 font-normal flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full animate-slide-in">
                  <Check className="w-3 h-3" />
                  {i18n.language === 'vi' ? 'Đã áp dụng!' : 'Applied!'}
                </span>
              )}
            </Label>
            
            <Card className="bg-gradient-to-br from-muted/30 via-muted/50 to-muted/30 border-2 border-dashed">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {i18n.language === 'vi' ? 'Các kiểu nút:' : 'Button variants:'}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button className="bg-primary text-primary-foreground hover:opacity-90">
                      Primary Button
                    </Button>
                    <Button variant="secondary" className="bg-secondary text-secondary-foreground">
                      Secondary Button
                    </Button>
                    <Button variant="outline">
                      Outline Button
                    </Button>
                    <Button variant="ghost">
                      Ghost Button
                    </Button>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div 
                    className="p-4 rounded-lg border-2 transition-all shadow-sm"
                    style={{ 
                      backgroundColor: buttonColor,
                      borderColor: buttonColor
                    }}
                  >
                    <p 
                      className="text-sm font-medium"
                      style={{ color: hexToHSL(buttonColor).l > 50 ? '#000' : '#fff' }}
                    >
                      ✨ Primary Card
                    </p>
                  </div>
                  <div 
                    className="p-4 rounded-lg border-2 transition-all shadow-sm"
                    style={{ 
                      backgroundColor: menuColor,
                      borderColor: menuColor
                    }}
                  >
                    <p 
                      className="text-sm font-medium"
                      style={{ color: hexToHSL(menuColor).l > 50 ? '#000' : '#fff' }}
                    >
                      🎨 Secondary Card
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-dashed">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: buttonColor }}></div>
                    <span className="font-mono">{buttonColor.toUpperCase()}</span>
                    <span className="text-muted-foreground">
                      (HSL: {hexToHSL(buttonColor).h}° {hexToHSL(buttonColor).s}% {hexToHSL(buttonColor).l}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: menuColor }}></div>
                    <span className="font-mono">{menuColor.toUpperCase()}</span>
                    <span className="text-muted-foreground">
                      (HSL: {hexToHSL(menuColor).h}° {hexToHSL(menuColor).s}% {hexToHSL(menuColor).l}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Apply Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">
                💡 {i18n.language === 'vi' ? 'Lưu ý:' : 'Note:'}
              </p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>
                  {i18n.language === 'vi' 
                    ? 'Chọn màu hoặc chọn từ bảng màu có sẵn' 
                    : 'Pick colors or choose from presets'}
                </li>
                <li>
                  {i18n.language === 'vi' 
                    ? 'Nhấn nút "Áp dụng" để lưu thay đổi' 
                    : 'Click "Apply" button to save changes'}
                </li>
              </ul>
            </div>
            <button
              onClick={handleApplyColors}
              disabled={isApplied}
              style={{
                backgroundColor: isApplied ? '#10b981' : buttonColor,
                color: '#FFFFFF',
                fontWeight: '600',
                minWidth: '200px',
                padding: '0.625rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: isApplied ? 'not-allowed' : 'pointer',
                opacity: 1,
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                if (!isApplied) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
              }}
            >
              {isApplied ? (
                <>
                  <Check className="w-5 h-5" style={{ color: '#FFFFFF' }} />
                  <span style={{ color: '#FFFFFF', fontSize: '0.875rem' }}>
                    {i18n.language === 'vi' ? 'Đã áp dụng!' : 'Applied!'}
                  </span>
                </>
              ) : (
                <>
                  <Palette className="w-5 h-5" style={{ color: '#FFFFFF' }} />
                  <span style={{ color: '#FFFFFF', fontSize: '0.875rem' }}>
                    {i18n.language === 'vi' ? 'Áp dụng màu sắc' : 'Apply Colors'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="text-xs space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <p className="font-semibold text-blue-900 flex items-center gap-2">
              <span className="text-base">ℹ️</span>
              {i18n.language === 'vi' ? 'Cách sử dụng chức năng màu sắc:' : 'How to use color customization:'}
            </p>
            <ol className="space-y-1.5 ml-6 list-decimal text-blue-800 leading-relaxed">
              <li>
                {i18n.language === 'vi' 
                  ? 'Chọn màu bằng cách nhấn vào ô màu hoặc nhập mã HEX trực tiếp' 
                  : 'Pick colors by clicking the color box or entering HEX code directly'}
              </li>
              <li>
                {i18n.language === 'vi' 
                  ? 'Hoặc chọn nhanh từ 12 bộ màu có sẵn phía trên' 
                  : 'Or quickly select from 12 preset color schemes above'}
              </li>
              <li>
                {i18n.language === 'vi' 
                  ? 'Xem trước giao diện trong phần Preview' 
                  : 'Preview the interface in the Preview section'}
              </li>
              <li>
                {i18n.language === 'vi' 
                  ? 'Nhấn "Áp dụng màu sắc" để lưu và áp dụng cho toàn bộ hệ thống' 
                  : 'Click "Apply Colors" to save and apply to the entire system'}
              </li>
              <li>
                {i18n.language === 'vi' 
                  ? 'Màu sắc sẽ được lưu tự động và áp dụng khi bạn quay lại' 
                  : 'Colors will be automatically saved and applied when you return'}
              </li>
              <li className="text-blue-600 font-medium">
                {i18n.language === 'vi' 
                  ? '🔄 Dùng nút "Đặt lại" để khôi phục màu mặc định' 
                  : '🔄 Use "Reset" button to restore default colors'}
              </li>
            </ol>
            
            <div className="pt-2 border-t border-blue-200">
              <p className="font-semibold text-blue-900 mb-2">
                🎨 {i18n.language === 'vi' ? 'Màu sắc sẽ được áp dụng cho:' : 'Colors will be applied to:'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-blue-700">
                <div className="flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{i18n.language === 'vi' ? 'Sidebar menu' : 'Sidebar menu'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{i18n.language === 'vi' ? 'Tất cả buttons' : 'All buttons'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{i18n.language === 'vi' ? 'Cards & containers' : 'Cards & containers'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{i18n.language === 'vi' ? 'Links & icons' : 'Links & icons'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{i18n.language === 'vi' ? 'Charts & graphs' : 'Charts & graphs'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{i18n.language === 'vi' ? 'Badges & labels' : 'Badges & labels'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}