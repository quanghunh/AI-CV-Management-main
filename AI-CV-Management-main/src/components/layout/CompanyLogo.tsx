import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';

interface CompanyLogoProps {
  className?: string;
  showName?: boolean;
  companyName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CompanyLogo({ 
  className = '', 
  showName = true, 
  companyName = 'Hệ thống',
  size = 'md' 
}: CompanyLogoProps) {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    const loadLogo = () => {
      const savedLogo = localStorage.getItem('company-logo');
      setLogo(savedLogo);
    };

    loadLogo();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'company-logo') {
        setLogo(e.newValue);
      }
    };

    const handleLogoUpdate = () => {
      loadLogo();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('logo-updated', handleLogoUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('logo-updated', handleLogoUpdate);
    };
  }, []);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const logoSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${logoSize} flex-shrink-0 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-1.5 flex items-center justify-center`}>
        {logo ? (
          <img 
            src={logo} 
            alt="Company Logo" 
            className="w-full h-full object-contain"
          />
        ) : (
          <Building2 className="w-full h-full text-white/80" />
        )}
      </div>

      {showName && (
        <div className="flex flex-col">
          <span className="text-white font-semibold text-base leading-tight">
            {companyName}
          </span>
          <span className="text-white/60 text-xs leading-tight">
            Management System
          </span>
        </div>
      )}
    </div>
  );
}