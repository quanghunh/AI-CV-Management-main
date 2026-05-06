
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  TrendingUp,
  Loader2,
  ChevronRight
} from "lucide-react"

type Role = {
  roles: number
  name: string
  description: string
  color: string
  icon: string
}

type Permission = {
  id: number
  module: string
  action: string
  name: string
  description: string
}

type PermissionMatrix = {
  [roleId: number]: {
    [permissionId: number]: boolean
  }
}

type PermissionStats = {
  role_id: number
  role_name: string
  total_modules: number
  total_permissions: number
  viewable_modules: number
  create_permissions: number
  update_permissions: number
  delete_permissions: number
}

type MatrixItem = {
  role_id: number
  permission_id: number
  has_permission: boolean
}

const ADMIN_ROLE_ID = 1

const MODULE_METADATA: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Dashboard", icon: "📊" },
  jobs: { label: "Công việc", icon: "💼" },
  candidates: { label: "Ứng viên", icon: "👥" },
  interviews: { label: "Phỏng vấn", icon: "📅" },
  cv_filter: { label: "Lọc CV", icon: "🔍" },
  reviews: { label: "Đánh giá", icon: "⭐" },
  offers: { label: "Offer", icon: "📄" },
  email: { label: "Email", icon: "📧" },
  users: { label: "Người dùng", icon: "👤" },
  permissions: { label: "Phân quyền", icon: "🔐" },
  settings: { label: "Cài đặt", icon: "⚙️" },
  ai_tools: { label: "AI Tools", icon: "🤖" },
}

const ACTION_LABELS: Record<string, string> = {
  view: "Xem",
  create: "Tạo",
  update: "Sửa",
  delete: "Xóa",
}

const ToggleSwitch = ({
  checked,
  onChange,
  disabled = false,
  ariaLabel
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}) => {
  return (
    <label className={`toggle-switch ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        role="switch"
        aria-checked={checked}
      />
      <span className="toggle-slider small"></span>
      <style>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #ccc;
          transition: .3s;
          border-radius: 20px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .toggle-slider { background-color: #2563eb; }
        input:disabled + .toggle-slider { cursor: not-allowed; }
        input:checked + .toggle-slider:before { transform: translateX(16px); }
      `}</style>
    </label>
  )
}

const RoleSidebarItem = ({
  role,
  isSelected,
  isAdmin,
  permissionCount,
  onClick,
}: {
  role: Role
  isSelected: boolean
  isAdmin: boolean
  permissionCount: number
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    className="w-full text-left flex items-center gap-3 px-4 py-3 transition-colors border-b border-gray-100 group"
    style={{
      borderLeft: isSelected ? `3px solid ${role.color || "#2563eb"}` : "3px solid transparent",
      backgroundColor: isSelected ? "#f8faff" : "transparent",
    }}
  >
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
      style={{ backgroundColor: `${role.color || "#6b7280"}20` }}
    >
      {role.icon || "👤"}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{role.name}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {isAdmin ? "Toàn quyền" : `${permissionCount} quyền`}
      </p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {isAdmin && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
          Admin
        </span>
      )}
      <ChevronRight
        className={`w-3.5 h-3.5 transition-opacity ${isSelected ? "opacity-60" : "opacity-0 group-hover:opacity-40"}`}
      />
    </div>
  </button>
)

const RolePermissionPanel = ({
  role,
  groupedPermissions,
  permissionMatrix,
  onToggle,
}: {
  role: Role
  groupedPermissions: Record<string, Permission[]>
  permissionMatrix: PermissionMatrix
  onToggle: (roleId: number, permissionId: number) => void
}) => {
  const isAdmin = role.roles === ADMIN_ROLE_ID

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Role info banner */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 shrink-0"
        style={{ backgroundColor: `${role.color || "#6b7280"}08` }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: `${role.color || "#6b7280"}20` }}
        >
          {role.icon || "👤"}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{role.name}</p>
          <p className="text-xs text-gray-500">{role.description || "Chỉnh sửa quyền cho vai trò này"}</p>
        </div>
        {isAdmin && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            <Shield className="w-3.5 h-3.5" />
            Không thể chỉnh sửa
          </div>
        )}
      </div>

      {/* Permissions list */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedPermissions).map(([module, perms]) => {
          const meta = MODULE_METADATA[module]
          return (
            <div key={module} className="border-b border-gray-100 last:border-0">
              {/* Module header */}
              <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <span className="text-base">{meta?.icon || "📦"}</span>
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {meta?.label || module}
                </span>
              </div>

              {/* Permission toggles row */}
              <div className="flex items-center flex-wrap gap-x-8 gap-y-3 px-5 py-3.5">
                {perms.map((permission) => {
                  const isChecked = !!permissionMatrix[role.roles]?.[permission.id]
                  return (
                    <div key={permission.id} className="flex items-center gap-2.5">
                      <ToggleSwitch
                        checked={isChecked}
                        onChange={() => onToggle(role.roles, permission.id)}
                        disabled={isAdmin}
                        ariaLabel={`${role.name} - ${module} - ${permission.action}`}
                      />
                      <span className="text-sm text-gray-700 select-none">
                        {ACTION_LABELS[permission.action] || permission.action}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "matrix">("overview")
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>({})
  const [stats, setStats] = useState<PermissionStats[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState(false)

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (process.env.NODE_ENV === "development") {
        console.log("🔄 Loading permissions data...")
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from("cv_roles")
        .select("*")
        .order("roles", { ascending: true })

      if (rolesError) {
        console.error("❌ Roles error:", rolesError)
        if (rolesError.code === "PGRST116") {
          throw new Error("Bảng cv_roles không tồn tại. Vui lòng chạy migrations.")
        }
        throw new Error(`Lỗi load roles: ${rolesError.message}`)
      }

      const { data: permissionsData, error: permissionsError } = await supabase
        .from("cv_permissions")
        .select("*")
        .order("module, action")

      if (permissionsError) {
        console.error("❌ Permissions error:", permissionsError)
        if (permissionsError.code === "PGRST116") {
          throw new Error("Bảng cv_permissions không tồn tại. Vui lòng chạy migrations.")
        }
        throw new Error(`Lỗi load permissions: ${permissionsError.message}`)
      }

      const { data: matrixData, error: matrixError } = await supabase
        .rpc("get_permissions_matrix")

      if (matrixError) {
        console.error("❌ Matrix error:", matrixError)
        if (matrixError.code === "PGRST116" || matrixError.code === "42883") {
          throw new Error('RPC function "get_permissions_matrix" không tồn tại. Vui lòng chạy migrations.')
        }
        throw new Error(`Lỗi load matrix: ${matrixError.message}`)
      }

      const { data: statsData, error: statsError } = await supabase
        .from("v_role_permission_stats")
        .select("*")

      if (statsError && statsError.code !== "PGRST116") {
        console.warn("⚠️ Stats not available:", statsError)
      }

      if (process.env.NODE_ENV === "development") {
        console.log("✅ Loaded data:", {
          roles: rolesData?.length,
          permissions: permissionsData?.length,
          matrix: matrixData?.length,
          stats: statsData?.length,
        })
      }

      setRoles(rolesData || [])
      setPermissions(permissionsData || [])
      setStats(statsData || [])

      const matrix: PermissionMatrix = {}
      rolesData?.forEach((role) => {
        matrix[role.roles] = {}
        permissionsData?.forEach((perm) => {
          const hasPermission = matrixData?.some(
            (m: MatrixItem) =>
              m.role_id === role.roles &&
              m.permission_id === perm.id &&
              m.has_permission
          )
          matrix[role.roles][perm.id] = hasPermission || false
        })
      })
      setPermissionMatrix(matrix)
      setPendingChanges(false)

      if (rolesData && rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].roles)
      }
    } catch (err: any) {
      console.error("❌ Error loading data:", err)
      setError(err.message || "Không thể tải dữ liệu")
    } finally {
      setLoading(false)
    }
  }, [selectedRoleId])

  const togglePermission = useCallback((roleId: number, permissionId: number) => {
    if (roleId === ADMIN_ROLE_ID) {
      setError("⚠️ Không thể thay đổi quyền của Admin")
      setTimeout(() => setError(null), 3000)
      return
    }

    setPermissionMatrix((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permissionId]: !prev[roleId]?.[permissionId],
      },
    }))

    setPendingChanges(true)

    if (process.env.NODE_ENV === "development") {
      console.log(`🔄 Toggled permission: Role ${roleId}, Permission ${permissionId}`)
    }
  }, [])

  const handleSaveAll = useCallback(async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      if (process.env.NODE_ENV === "development") {
        console.log("💾 Saving all permissions...")
      }

      const savePromises = roles
        .filter((role) => role.roles !== ADMIN_ROLE_ID)
        .map(async (role) => {
          const enabledPermissions = Object.entries(permissionMatrix[role.roles] || {})
            .filter(([_, enabled]) => enabled)
            .map(([permId]) => parseInt(permId))

          if (process.env.NODE_ENV === "development") {
            console.log(`💾 Saving role ${role.name}:`, enabledPermissions)
          }

          const { error: updateError } = await supabase.rpc("update_role_permissions", {
            p_role_id: role.roles,
            p_permission_ids: enabledPermissions,
          })

          if (updateError) {
            throw new Error(`Lỗi cập nhật role ${role.name}: ${updateError.message}`)
          }
        })

      await Promise.all(savePromises)

      setSuccess("✅ Đã lưu tất cả thay đổi thành công!")
      setPendingChanges(false)

      await loadData()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error("❌ Error saving permissions:", err)
      setError(err.message || "Không thể lưu thay đổi")
    } finally {
      setSaving(false)
    }
  }, [roles, permissionMatrix, loadData])

  const groupedPermissions = useMemo(() => {
    return permissions.reduce(
      (acc, perm) => {
        if (!acc[perm.module]) acc[perm.module] = []
        acc[perm.module].push(perm)
        return acc
      },
      {} as Record<string, Permission[]>
    )
  }, [permissions])

  const totalPermissions = useMemo(() => permissions.length, [permissions])
  const totalModules = useMemo(() => Object.keys(groupedPermissions).length, [groupedPermissions])

  const rolePermissionCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    roles.forEach((role) => {
      counts[role.roles] = Object.values(permissionMatrix[role.roles] || {}).filter(Boolean).length
    })
    return counts
  }, [roles, permissionMatrix])

  const selectedRole = useMemo(
    () => roles.find((r) => r.roles === selectedRoleId) || null,
    [roles, selectedRoleId]
  )

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Đang tải dữ liệu phân quyền...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile fallback */}
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
        <div className="w-full min-h-screen bg-white">
          {/* Header */}
          <div className="flex items-start justify-between px-8 pt-6 pb-4 bg-white border-b border-gray-200">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Quản lý phân quyền</h1>
                  <p className="text-sm text-gray-600">Cấu hình quyền truy cập cho từng vai trò</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading || saving}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Tải lại
            </Button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mx-8 mt-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {success && (
            <div className="mx-8 mt-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            </div>
          )}

          {pendingChanges && (
            <div className="mx-8 mt-4">
              <Alert className="border-amber-200 bg-amber-50">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Bạn có thay đổi chưa lưu. Nhớ nhấn "Lưu tất cả" để áp dụng thay đổi.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-4 px-8 border-b border-gray-200 bg-white">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Tổng quan
            </button>
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "matrix"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Ma trận phân quyền
            </button>
          </div>

          {/* ==============================
              OVERVIEW TAB — GIỮ NGUYÊN
          ============================== */}
          {activeTab === "overview" && (
            <div className="p-8 space-y-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-[calc(100vh-180px)]">
              <Alert className="border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 shadow-sm">
                <Info className="h-5 w-5 text-blue-700" />
                <AlertDescription className="text-blue-900 font-medium">
                  <strong className="font-bold">Hệ thống phân quyền:</strong> Quản lý quyền truy cập vào{" "}
                  {totalModules} modules với {totalPermissions} quyền khác nhau. Admin có toàn quyền và không
                  thể chỉnh sửa.
                </AlertDescription>
              </Alert>

              {stats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {stats.map((stat) => {
                    const role = roles.find((r) => r.roles === stat.role_id)
                    return (
                      <Card
                        key={stat.role_id}
                        className="relative overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white border-2 border-gray-200"
                      >
                        <div
                          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
                          style={{ backgroundColor: role?.color }}
                        />
                        <div className="relative p-6">
                          <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-gray-100">
                            <div
                              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-4 ring-white"
                              style={{ backgroundColor: `${role?.color}30` }}
                            >
                              {role?.icon || "👤"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 text-sm truncate mb-1">
                                {stat.role_name}
                              </h3>
                              <p className="text-xs text-gray-500 font-medium">
                                {stat.total_permissions} quyền được cấp
                              </p>
                            </div>
                          </div>
                          <div className="mb-5">
                            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl">
                              <span className="text-gray-700 font-bold text-sm">📦 Modules</span>
                              <span className="font-black text-purple-700 text-lg">
                                {stat.viewable_modules}
                                <span className="text-gray-400">/{totalModules}</span>
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all">
                              <div className="text-2xl mb-1">➕</div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">Tạo</p>
                              <p className="text-2xl font-black text-green-700">{stat.create_permissions}</p>
                            </div>
                            <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all">
                              <div className="text-2xl mb-1">✏️</div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">Sửa</p>
                              <p className="text-2xl font-black text-blue-700">{stat.update_permissions}</p>
                            </div>
                            <div className="text-center p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all">
                              <div className="text-2xl mb-1">🗑️</div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">Xóa</p>
                              <p className="text-2xl font-black text-red-700">{stat.delete_permissions}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <Alert className="border-amber-300 bg-amber-50">
                  <Info className="h-5 w-5 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    Thống kê không khả dụng. View v_role_permission_stats có thể chưa được tạo.
                  </AlertDescription>
                </Alert>
              )}

              <Card className="p-8 shadow-xl border-2 border-gray-200 bg-white">
                <div className="mb-6 pb-4 border-b-2 border-gray-200">
                  <h3 className="font-black text-gray-900 text-2xl flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl shadow-md">
                      <TrendingUp className="h-7 w-7 text-blue-700" />
                    </div>
                    Phân tích quyền theo module
                  </h3>
                  <p className="text-gray-600 mt-2 ml-16">
                    Chi tiết phân quyền cho từng module trong hệ thống
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {Object.entries(groupedPermissions).map(([module, perms]) => {
                    const meta = MODULE_METADATA[module]
                    return (
                      <div key={module} className="group relative overflow-hidden">
                        <div className="flex items-center justify-between p-5 bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                              <span className="text-4xl">{meta?.icon || "📦"}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-lg truncate">
                                {meta?.label || module}
                              </p>
                              <p className="text-sm text-gray-500 font-medium">
                                {perms.length} quyền khả dụng
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap justify-end ml-4">
                            {perms.map((perm) => (
                              <Badge
                                key={perm.id}
                                className="text-xs font-bold px-4 py-1.5 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border-2 border-gray-300 hover:from-blue-100 hover:to-blue-200 hover:border-blue-400 hover:text-blue-900 transition-all cursor-default"
                              >
                                {ACTION_LABELS[perm.action] || perm.action}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* ==============================
              MATRIX TAB — LAYOUT MỚI
              Sidebar vai trò (trái) +
              Panel phân quyền (phải)
          ============================== */}
          {activeTab === "matrix" && (
            <div
              className="flex flex-col bg-gray-50"
              style={{ height: "calc(100vh - 180px)" }}
            >
              {/* Toolbar */}
              <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">Ma trận phân quyền</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chọn vai trò bên trái để chỉnh sửa. Admin không thể thay đổi.
                  </p>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={saving || !pendingChanges}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Lưu tất cả
                    </>
                  )}
                </Button>
              </div>

              {/* Body: sidebar + panel */}
              <div className="flex flex-1 overflow-hidden">
                {/* ---- LEFT SIDEBAR: Role list ---- */}
                <div
                  className="flex flex-col bg-white border-r border-gray-200 overflow-hidden shrink-0"
                  style={{ width: "220px" }}
                >
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Vai trò ({roles.length})
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {roles.map((role) => (
                      <RoleSidebarItem
                        key={role.roles}
                        role={role}
                        isSelected={selectedRoleId === role.roles}
                        isAdmin={role.roles === ADMIN_ROLE_ID}
                        permissionCount={rolePermissionCounts[role.roles] || 0}
                        onClick={() => setSelectedRoleId(role.roles)}
                      />
                    ))}
                  </div>
                </div>

                {/* ---- RIGHT PANEL: Permissions for selected role ---- */}
                <div className="flex-1 overflow-hidden bg-white">
                  {selectedRole ? (
                    <RolePermissionPanel
                      role={selectedRole}
                      groupedPermissions={groupedPermissions}
                      permissionMatrix={permissionMatrix}
                      onToggle={togglePermission}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                      <Shield className="w-10 h-10 opacity-30" />
                      <p className="text-sm">Chọn một vai trò để xem và chỉnh sửa quyền</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}