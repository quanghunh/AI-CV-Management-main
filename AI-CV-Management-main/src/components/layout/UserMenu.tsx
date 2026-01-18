// src/components/layout/UserMenu.tsx

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, LogOut, ChevronUp, Shield, Users, User } from 'lucide-react';

export const UserMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Đóng menu khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleProfileSettings = () => {
    navigate('/cai-dat/thong-tin-ca-nhan');
    setIsOpen(false);
  };

  if (!user) return null;

  // Check if this is custom auth user
  const isCustomAuth = 'isCustomAuth' in user && (user as any).isCustomAuth;

  // Get user role
  let userRole = 'USER';
  if (isCustomAuth) {
    userRole = (user as any).role?.toUpperCase() || 'USER';
  } else if (profile?.cv_user_roles?.[0]?.cv_roles?.name) {
    userRole = profile.cv_user_roles[0].cv_roles.name.toUpperCase();
  } else if (profile?.role) {
    userRole = profile.role.toUpperCase();
  }

  // Get user info - handle both CustomUser and Supabase User types
  let displayName = 'User';
  let displayEmail = 'user@example.com';
  let avatarUrl: string | undefined;

  if (isCustomAuth) {
    // Custom auth user
    displayName = (user as any).full_name || user.email?.split('@')[0] || 'User';
    displayEmail = user.email || 'user@example.com';
  } else {
    // Supabase auth user
    displayName = profile?.full_name || 
                  ((user as any).user_metadata?.full_name) || 
                  user.email?.split('@')[0] || 
                  'User';
    displayEmail = user.email || 'user@example.com';
    avatarUrl = profile?.avatar_url || ((user as any).user_metadata?.avatar_url);
  }

  // Lấy tên viết tắt
  const getInitials = () => {
    if (displayName) {
      const names = displayName.split(' ').filter((n: string) => n.length > 0);
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return displayEmail[0].toUpperCase();
  };

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return 'bg-red-500 text-white';
      case 'HR':
        return 'bg-purple-500 text-white';
      case 'INTERVIEWER':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return <Shield className="w-3 h-3" />;
      case 'HR':
        return <Users className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  return (
    <div ref={menuRef} className="relative">
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors"
      >
        {/* Avatar with profile support */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm overflow-hidden ring-2 ring-white/20">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Avatar failed to load:', avatarUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            getInitials()
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {displayName}
          </p>
          <p className="text-xs text-white/70 truncate">
            {displayEmail}
          </p>
        </div>

        {/* Chevron Icon */}
        <ChevronUp 
          className={`w-4 h-4 text-white/60 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-[250px]">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold overflow-hidden">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  getInitials()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {displayEmail}
                </p>
                {/* Role Badge */}
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(userRole)}`}>
                    {getRoleIcon(userRole)}
                    <span>{userRole}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleProfileSettings}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span>Cài đặt tài khoản</span>
            </button>

            <div className="border-t border-gray-100 my-1"></div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 w-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};