// src/pages/SettingsPage.tsx
"use client"

import { useState, useEffect } from "react"
import { Building2, Bot, Mail, Bell, FolderTree, Users, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanySettings } from "@/components/settings/CompanySettings"
import AiSettings from "@/components/settings/AiSettings"
import { supabase } from "@/lib/supabaseClient"
import { EmailSettings } from "@/components/settings/EmailSettings"
import { useTranslation } from 'react-i18next'
import UsersPage from "@/pages/User"
import { toast } from "sonner"

interface CompanyProfile {
  id?: string;
  company_name?: string;
  website?: string;
  company_description?: string;
  company_address?: string;
  contact_email?: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("company");
  const [profile, setProfile] = useState<CompanyProfile>({});
  const [loading, setLoading] = useState(true);
  const tabs = [
    { id: "company", label: t('settings.tabs.company'), icon: Building2 },
    { id: "ai", label: t('settings.tabs.ai'), icon: Bot },
    { id: "email", label: t('settings.tabs.email'), icon: Mail },
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("cv_company_profile")
          .select("*")
          .single();
        
        if (error && error.code !== "PGRST116") throw error;
        if (data) setProfile(data);
      } catch (err: any) {
        console.error(err);
        toast.error("Lỗi tải thông tin công ty: " + (err?.message ?? ""));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setProfile((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    if (activeTab !== "company") {
      return;
    }

    if (!profile.company_name || profile.company_name.trim() === '') {
      toast.error(t('settings.messages.nameRequired'));
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('cv_company_profile')
        .upsert({ 
          ...profile, 
          id: profile.id || undefined,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error("Save error:", error);
        toast.error(t('settings.messages.saveError') + ' ' + error.message);
      } else {
        toast.success(t('settings.messages.saveSuccess'));
        
        const { data: updatedData } = await supabase
          .from('cv_company_profile')
          .select('*')
          .single();
        
        if (updatedData) {
          setProfile(updatedData);
        }
      }
    } catch (error: any) {
      console.error("Unexpected error:", error);
      toast.error(t('settings.messages.unexpectedError') + ' ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestApiKey = async () => {
    try {
      const { data, error } = await supabase.from('cv_email_settings').select('resend_api_key').single();
      if (error) throw error;
      if (!data || !data.resend_api_key) {
        toast.error('Không tìm thấy API Key hoặc lỗi khi lấy');
        return;
      }

      const response = await fetch('/api/test-resend-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: data.resend_api_key })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`API Key hợp lệ! ${result.message}`);
      } else {
        const err = await response.json();
        toast.error(`Kiểm tra API Key thất bại: ${err.message}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    }
  };

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
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground">{t('settings.subtitle')}</p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-1 sm:gap-2 overflow-x-auto border-b">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "company" && (
            <CompanySettings profile={profile} handleInputChange={handleInputChange} />
          )}

          {activeTab === "ai" && <AiSettings />}


          {activeTab === "email" && (
            <div>
              <EmailSettings />
              <div className="pt-4 flex justify-end">
                <Button onClick={handleTestApiKey}>Kiểm tra API Key Resend</Button>
              </div>
            </div>
          )}
         

          {activeTab === "users" && (
            <div className="pt-6">
              <UsersPage />
            </div>
          )}
        </div>

        {/* Save Button (only for company tab) */}
        {activeTab === "company" && (
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
              disabled={loading}
            >
              {t('settings.buttons.cancel')}
            </Button>
            <Button 
              size="lg" 
              onClick={handleSave} 
              disabled={loading || !profile.company_name}
            >
              {loading ? t('settings.buttons.saving') : t('settings.buttons.save')}
            </Button>
          </div>
        )}
      </div>
    </div>  
      </div>
    </>
  );
}