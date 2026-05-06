
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Lock, AlertCircle, Shield } from "lucide-react";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {

    if (authLoading) {
      console.log("⏳ Auth is initializing, waiting...");
      return;
    }

    if (user) {
      console.log("✅ User already logged in, redirecting to dashboard");
      const from = (location.state as any)?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmedEmail = email.trim();

      if (!trimmedEmail || !password) {
        setError("Vui lòng điền đầy đủ thông tin");
        setLoading(false);
        return;
      }

      console.log("🔐 Attempting login:", trimmedEmail);

      const result = await signIn(trimmedEmail, password);

      if (result?.error) {
        console.error("❌ Login error:", result.error);
        setError(result.error.message || "Đăng nhập thất bại");
        setLoading(false);
        return;
      }

      if (!result?.data?.user) {
        setError("Không thể đăng nhập. Vui lòng thử lại.");
        setLoading(false);
        return;
      }

      console.log("✅ Login successful!");
      console.log("👤 User:", result.data.user);

      await new Promise(resolve => setTimeout(resolve, 100));

      const from = (location.state as any)?.from?.pathname || "/dashboard";
      console.log("🔀 Redirecting to:", from);
      navigate(from, { replace: true });

    } catch (ex: any) {
      console.error("❌ Login exception:", ex);
      setError(ex?.message ?? "Có lỗi xảy ra. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Recruit AI</h1>
          <p className="text-gray-600">Hệ thống quản lý tuyển dụng</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Đăng nhập</h2>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-gray-600">Ghi nhớ đăng nhập</span>
              </label>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </Button>
          </form>

          {/* Thông báo liên hệ Admin */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Chưa có tài khoản?</span>
              </div>
            </div>
            
            <div className="mt-4 text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-900">
                  Tài khoản do Admin cấp
                </p>
              </div>
              <p className="text-xs text-blue-700">
                Vui lòng liên hệ với Quản trị viên hoặc bộ phận HR để được cấp quyền truy cập vào hệ thống
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          © 2025 Recruit AI. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;