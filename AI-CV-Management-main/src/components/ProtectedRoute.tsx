
import React from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { usePermissions } from "@/contexts/PermissionsContext"
import { Loader2, Shield, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  children: React.ReactNode
  requiredRole?: string | string[]
  requiredPermission?: { module: string; action: string }
}

export const ProtectedRoute: React.FC<Props> = ({ 
  children, 
  requiredRole,
  requiredPermission 
}) => {
  const { user, profile, loading: authLoading } = useAuth()
  const { hasPermission, loading: permLoading } = usePermissions()
  const location = useLocation()

  if (authLoading || permLoading) {
    console.log("⏳ Loading authentication and permissions...")
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Đang xác thực...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log("❌ No user found, redirecting to login")
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  console.log("✅ User authenticated:", user.email)

  

  if (requiredPermission) {
    const { module, action } = requiredPermission
    const hasRequiredPermission = hasPermission(module, action)

    console.log(`🔐 Checking permission: ${module}.${action}`)
    console.log(`🔐 Has permission: ${hasRequiredPermission}`)

    if (!hasRequiredPermission) {
      console.log("❌ Access denied - missing required permission")
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-100 rounded-full">
                <Shield className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Không có quyền truy cập
            </h1>
            <p className="text-gray-600 mb-4">
              Bạn không có quyền truy cập chức năng này.
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2 text-left">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-700 font-medium mb-1">
                    Quyền yêu cầu:
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                      {module}.{action}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.history.back()}
              >
                Quay lại
              </Button>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = '/dashboard'}
              >
                Về trang chủ
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Liên hệ Admin nếu bạn cần quyền truy cập này
            </p>
          </div>
        </div>
      )
    }

    console.log("✅ Access granted - user has required permission")
  }

  if (requiredRole) {
    let userRole: string | undefined

    if ('isCustomAuth' in user && user.isCustomAuth) {
      userRole = (user as any).role?.toUpperCase()
    } else if (profile?.cv_user_roles?.[0]?.cv_roles?.name) {
      userRole = profile.cv_user_roles[0].cv_roles.name.toUpperCase()
    } else if (profile?.role) {
      userRole = profile.role.toUpperCase()
    }

    const allowedRoles = Array.isArray(requiredRole) 
      ? requiredRole.map(r => r.toUpperCase()) 
      : [requiredRole.toUpperCase()]

    console.log("🔐 Required role(s):", allowedRoles)
    console.log("🔐 User role:", userRole)

    if (!userRole || !allowedRoles.includes(userRole)) {
      console.log("❌ Access denied - insufficient role")
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-100 rounded-full">
                <Shield className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Không có quyền truy cập
            </h1>
            <p className="text-gray-600 mb-2">
              Bạn không có vai trò phù hợp để truy cập trang này.
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2">
              <p className="text-sm text-gray-700">
                <strong>Vai trò của bạn:</strong>{" "}
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {userRole || "Không xác định"}
                </span>
              </p>
              <p className="text-sm text-gray-700">
                <strong>Vai trò yêu cầu:</strong>{" "}
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  {Array.isArray(requiredRole) ? requiredRole.join(", ") : requiredRole}
                </span>
              </p>
            </div>
            <div className="mt-6 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.history.back()}
              >
                Quay lại
              </Button>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = '/dashboard'}
              >
                Về trang chủ
              </Button>
            </div>
          </div>
        </div>
      )
    }

    console.log("✅ Access granted - user has required role")
  }

  console.log("✅ Access granted")
  return <>{children}</>
}