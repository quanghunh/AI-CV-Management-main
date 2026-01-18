// src/components/layout/Sidebar.tsx - FIXED VERSION
import { useState, useEffect } from 'react';
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Star,
  Mail,
  Settings,
  Building2,
  FileText,
  Filter,
  Shield,
  UserCog,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { supabase } from "@/lib/supabaseClient";
import { useTranslation } from 'react-i18next';
import { usePermissions } from "@/contexts/PermissionsContext";

// Fixed UUID cho company profile (chung cho toàn hệ thống)
const COMPANY_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  badge?: string;
}

const NavItem = ({ to, icon: Icon, label, isActive, badge }: NavItemProps) => (
  <Link
    to={to}
    className={`flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
      isActive
        ? "bg-white text-primary shadow-md font-semibold"
        : "text-white/90 hover:bg-white/15 hover:text-white hover:translate-x-1"
    }`}
    aria-current={isActive ? 'page' : undefined}
  >
    <div className="flex items-center">
      <Icon className="w-5 h-5 mr-3" />
      <span className="truncate">{label}</span>
    </div>
    {badge && (
      <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white">
        {badge}
      </span>
    )}
  </Link>
);

// Skeleton cho nav items khi đang loading
const NavItemSkeleton = () => (
  <div className="h-10 bg-white/10 rounded-lg animate-pulse" />
);

// Component hiển thị Logo công ty - Load từ Supabase
function CompanyLogo({ companyName }: { companyName: string }) {
  const [logo, setLogo] = useState<string | null>(null);
  const [isLoadingLogo, setIsLoadingLogo] = useState(true);

  useEffect(() => {
    // Load logo từ Supabase
    const loadLogoFromSupabase = async () => {
      try {
        setIsLoadingLogo(true);
        
        // Thử load từ localStorage trước (cache)
        const cachedLogo = localStorage.getItem('company-logo');
        if (cachedLogo) {
          setLogo(cachedLogo);
        }
        
        // Load từ Supabase để đảm bảo sync
        const { data, error } = await supabase
          .from('cv_company_profile')
          .select('logo_url')
          .eq('id', COMPANY_PROFILE_ID)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error("Error loading logo:", error);
        }
        
        if (data?.logo_url) {
          setLogo(data.logo_url);
          localStorage.setItem('company-logo', data.logo_url);
        } else {
          // No logo or no row, clear
          setLogo(null);
          localStorage.removeItem('company-logo');
        }
      } catch (error) {
        console.error("Error loading logo:", error);
        // Fallback to localStorage nếu có lỗi
        const cachedLogo = localStorage.getItem('company-logo');
        if (cachedLogo) {
          setLogo(cachedLogo);
        }
      } finally {
        setIsLoadingLogo(false);
      }
    };

    loadLogoFromSupabase();

    // Listen for storage changes (cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'company-logo') {
        setLogo(e.newValue);
      }
    };

    // Listen for custom event (same-tab updates from Settings)
    const handleLogoUpdate = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Logo update event received, reloading...');
      }
      loadLogoFromSupabase();
    };

    // Subscribe to realtime changes in Supabase
    const channel = supabase
      .channel('company_logo_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cv_company_profile',
          filter: `id=eq.${COMPANY_PROFILE_ID}`
        },
        (payload) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📡 Realtime update received:', payload);
          }
          if (payload.new && (payload.new as any).logo_url !== undefined) {
            const newLogo = (payload.new as any).logo_url;
            setLogo(newLogo);
            if (newLogo) {
              localStorage.setItem('company-logo', newLogo);
            } else {
              localStorage.removeItem('company-logo');
            }
          }
        }
      )
      .subscribe((status) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('📡 Realtime subscription status:', status);
        }
      });

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('logo-updated', handleLogoUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('logo-updated', handleLogoUpdate);
      supabase.removeChannel(channel);
    };
  }, []);

  // Nếu đang loading logo, hiển thị skeleton
  if (isLoadingLogo) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-white/15 animate-pulse shadow-lg" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="h-6 bg-white/20 rounded animate-pulse w-36 mb-2" />
          <div className="h-3 bg-white/15 rounded animate-pulse w-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Logo Container */}
      <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-white/15 backdrop-blur-sm border border-white/30 p-2 flex items-center justify-center shadow-lg">
        {logo ? (
          <img 
            src={logo} 
            alt="Company Logo" 
            className="w-full h-full object-contain"
            onError={(e) => {
              console.error('Logo image failed to load');
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <Building2 className="w-full h-full text-white" />
        )}
      </div>

      {/* Company Name */}
      <div className="flex flex-col flex-1 min-w-0">
        <h1 
          className="text-2xl font-extrabold text-white tracking-tight truncate" 
          style={{
            textShadow: '0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)',
            letterSpacing: '-0.02em'
          }}
          title={companyName}
        >
          {companyName}
        </h1>
        <p className="text-[11px] font-medium text-white/90 truncate tracking-wide uppercase mt-0.5">
          Management System
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { t } = useTranslation();
  const { canView, loading: permLoading, error: permError } = usePermissions();
  const [companyName, setCompanyName] = useState('Recruit AI');
  const [loading, setLoading] = useState(true);

  // ========================================
  // PERMISSION-BASED NAVIGATION ITEMS
  // ========================================
  // NOTE: Quyền được kiểm soát hoàn toàn bởi database
  // Không hardcode roles ở đây
  const navItems = [
    ...(canView('dashboard') ? [{
      to: "/",
      label: t('nav.dashboard'),
      icon: LayoutDashboard
    }] : []),
    
    ...(canView('jobs') ? [{
      to: "/mo-ta-cong-viec",
      label: t('nav.jobs'),
      icon: Briefcase
    }] : []),
    
    ...(canView('candidates') ? [{
      to: "/ung-vien",
      label: t('nav.candidates'),
      icon: Users
    }] : []),
    
    ...(canView('interviews') ? [{
      to: "/phong-van",
      label: t('nav.interviews'),
      icon: Calendar
    }] : []),
    
    ...(canView('reviews') ? [{
      to: "/danh-gia",
      label: t('nav.reviews'),
      icon: Star
    }] : []),
    
    ...(canView('cv_filter') ? [{
      to: "/loc-cv",
      label: "Lọc CV",
      icon: Filter
    }] : []),
    
    //...(canView('offers') ? [{
    //  to: "/offers",
    //  label: "Offer Management",
    //  icon: FileText
    //}] : []),
    
    ...(canView('email') ? [{
      to: "/quan-ly-email",
      label: t('nav.email'),
      icon: Mail
    }] : []),
    
    ...(canView('users') ? [{
      to: "/nguoi-dung",
      label: "Người dùng",
      icon: UserCog
    }] : []),
    
    //...(canView('ai_tools') ? [{
    //  to: "/ai",
    //  label: "AI Tools",
    //  icon: Sparkles,
    //  badge: "NEW"
    //}] : []),
    
    ...(canView('permissions') ? [{
      to: "/phan-quyen",
      label: "Phân quyền",
      icon: Shield,
      badge: "ADMIN"
    }] : []),
    
    ...(canView('settings') ? [{
      to: "/cai-dat",
      label: t('nav.settings'),
      icon: Settings
    }] : []),
  ];

  useEffect(() => {
    // Load company name từ database
    async function loadCompanyName() {
      setLoading(true);
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
      
      setLoading(false);
    }
    
    loadCompanyName();
    
    // Subscribe để cập nhật real-time khi company name thay đổi
    const channel = supabase
      .channel('company_profile_changes')
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

  // ========================================
  // RENDER SIDEBAR
  // ========================================
  return (
    <aside 
      className="w-64 h-screen bg-gradient-to-b from-primary to-primary/90 shadow-xl flex flex-col p-4 fixed"
      style={{
        background: `linear-gradient(180deg, 
          var(--sidebar-bg, hsl(var(--primary))) 0%, 
          var(--sidebar-bg, hsl(var(--primary))) 100%)`
      }}
    >
      {/* Company Header với Logo */}
      <div className="px-4 py-4 mb-6 border-b border-white/20">
        {loading ? (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 animate-pulse shadow-lg" />
            <div className="flex-1 space-y-2.5">
              <div className="h-6 bg-white/20 rounded animate-pulse w-36" />
              <div className="h-3 bg-white/15 rounded animate-pulse w-28" />
            </div>
          </div>
        ) : (
          <CompanyLogo companyName={companyName} />
        )}
      </div>

      {/* Navigation - Permission-Based */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto scrollbar-thin">
        {permLoading ? (
          // ✅ Show skeleton while loading permissions
          <>
            {[...Array(6)].map((_, i) => (
              <NavItemSkeleton key={i} />
            ))}
          </>
        ) : permError ? (
          // ✅ Show error if permissions failed to load
          <div className="text-center py-8 px-4">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <p className="text-white/70 text-sm mb-2">
              Lỗi tải quyền
            </p>
            <p className="text-white/50 text-xs">
              {permError}
            </p>
          </div>
        ) : navItems.length === 0 ? (
          // ✅ Show message if no permissions
          <div className="text-center py-8 px-4">
            <Shield className="w-12 h-12 mx-auto mb-3 text-white/40" />
            <p className="text-white/70 text-sm mb-2">
              Không có quyền truy cập
            </p>
            <p className="text-white/50 text-xs">
              Liên hệ Admin để được cấp quyền
            </p>
          </div>
        ) : (
          // ✅ Show actual nav items
          navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                isActive={active}
                badge={(item as any).badge}
              />
            );
          })
        )}
      </nav>

      {/* User Profile Section */}
      <div className="mt-auto pt-4 border-t border-white/20">
        <UserMenu />
      </div>

      {/* Decorative gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
    </aside>
  );
}

export default Sidebar;