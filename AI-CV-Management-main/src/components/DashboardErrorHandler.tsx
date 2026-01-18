// src/components/DashboardErrorHandler.tsx
// Wrap this around your dashboard data fetching logic

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DashboardErrorHandlerProps {
  children: React.ReactNode;
}

export const DashboardErrorHandler: React.FC<DashboardErrorHandlerProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const validateSession = async () => {
      if (authLoading) return;
      
      try {
        console.log("🔍 Validating session for data fetching...");
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.error("❌ Invalid session:", error);
          setSessionValid(false);
        } else {
          console.log("✅ Session valid for data fetching");
          setSessionValid(true);
        }
      } catch (err) {
        console.error("❌ Session validation error:", err);
        setSessionValid(false);
      } finally {
        setChecking(false);
      }
    };

    validateSession();
  }, [user, authLoading]);

  const handleRefresh = () => {
    console.log("🔄 Refreshing page...");
    window.location.reload();
  };

  const handleRelogin = () => {
    console.log("🔄 Redirecting to login...");
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login";
  };

  // Still checking session
  if (checking || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  // Session invalid - show error
  if (sessionValid === false) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="outline" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tải lại trang
            </Button>
            <Button onClick={handleRelogin} className="flex-1">
              Đăng nhập lại
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Session valid - render children
  return <>{children}</>;
};