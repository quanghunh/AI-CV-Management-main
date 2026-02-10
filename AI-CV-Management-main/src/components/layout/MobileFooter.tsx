// src/components/layout/MobileFooter.tsx
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Filter,
} from "lucide-react";
import { useTranslation } from 'react-i18next';
import { usePermissions } from "@/contexts/PermissionsContext";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permissionKey: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permissionKey: "dashboard",
  },
  {
    to: "/mo-ta-cong-viec",
    label: "Công việc",
    icon: Briefcase,
    permissionKey: "jobs",
  },
  {
    to: "/ung-vien",
    label: "Ứng viên",
    icon: Users,
    permissionKey: "candidates",
  },
  {
    to: "/phong-van",
    label: "Lịch",
    icon: Calendar,
    permissionKey: "interviews",
  },
  {
    to: "/loc-cv",
    label: "Lọc CV",
    icon: Filter,
    permissionKey: "cv_filter",
  },
];

export function MobileFooter() {
  const location = useLocation();
  const { t } = useTranslation();
  const { canView } = usePermissions();

  // Filter nav items based on permissions
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    canView(item.permissionKey)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 shadow-lg z-40 lg:hidden">
      <div className="flex items-center justify-around h-full">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
                isActive
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`}
              />
              <span className="text-[10px] font-medium mt-1">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileFooter;
