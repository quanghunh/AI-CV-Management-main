// src/components/layout/Header.tsx
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

// Fixed UUID cho company profile (chung cho toàn hệ thống)
const COMPANY_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

interface HeaderProps {
  onMenuClick: () => void;
  companyName?: string;
}

export function Header({ onMenuClick, companyName = 'Recruit AI' }: HeaderProps) {
  const [logo, setLogo] = useState<string | null>(null);

  // Load logo từ localStorage cache
  const cachedLogo = localStorage.getItem('company-logo');
  if (cachedLogo && !logo) {
    setLogo(cachedLogo);
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-[#1a237e] to-[#283593] shadow-md z-50 flex items-center justify-between px-4 lg:hidden">
      {/* Logo bên trái */}
      <div className="flex items-center gap-3">
        {/* Logo Container */}
        <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-white/15 backdrop-blur-sm border border-white/30 p-1.5 flex items-center justify-center">
          {logo ? (
            <img
              src={logo}
              alt="Company Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12h6M9 8h6M9 16h6" />
            </svg>
          )}
        </div>

        {/* Company Name */}
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
            {companyName}
          </h1>
          <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide">
            Management System
          </p>
        </div>
      </div>

      {/* Hamburger Menu bên phải */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
        aria-label="Toggle menu"
      >
        <Menu className="w-6 h-6" />
      </button>
    </header>
  );
}

export default Header;
