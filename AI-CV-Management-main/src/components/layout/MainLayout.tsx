// src/components/layout/MainLayout.tsx
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileFooter } from "./MobileFooter";
import FloatingChatbot from "@/components/FloatingChatbot";
import { supabase } from "@/lib/supabaseClient";

// Fixed UUID cho company profile (chung cho toàn hệ thống)
const COMPANY_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyName, setCompanyName] = useState('Recruit AI');

  useEffect(() => {
    // Load company name từ database
    async function loadCompanyName() {
      const { data, error } = await supabase
        .from('cv_company_profile')
        .select('company_name')
        .eq('id', COMPANY_PROFILE_ID)
        .single();

      if (data && data.company_name) {
        setCompanyName(data.company_name);
      }

      if (error && error.code !== 'PGRST116') {
        console.error("Error loading company name:", error);
      }
    }

    loadCompanyName();

    // Subscribe để cập nhật real-time khi company name thay đổi
    const channel = supabase
      .channel('company_profile_changes_main')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cv_company_profile',
          filter: `id=eq.${COMPANY_PROFILE_ID}`
        },
        (payload) => {
          if (payload.new && payload.new.company_name) {
            setCompanyName(payload.new.company_name);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex relative min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 relative">
        {/* Mobile Header */}
        <Header onMenuClick={toggleSidebar} companyName={companyName} />

        {/* Page Content */}
        <div className="pt-16 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
          <Outlet />
        </div>

        {/* Mobile Footer Navigation */}
        <MobileFooter />
      </main>

      {/* Floating Chatbot - Sẽ xuất hiện ở tất cả các trang */}
      <FloatingChatbot />
    </div>
  );
}