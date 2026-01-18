"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabaseClient"
import {
  Users,
  Plus,
  RefreshCw,
  Activity,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  Shield,
  Mail,
  UserCircle
} from "lucide-react"

type User = {
  id: string
  name: string
  email: string
  role: string
  status: "ACTIVE" | "INACTIVE"
  synced: boolean
  created_at: string
  auth_user_id?: string
}

type Role = {
  roles: number
  name: string
  description?: string
}

type ActivityLog = {
  id: string
  user_id?: string
  user_name?: string
  action: string
  details?: string
  created_at: string
}

export default function UsersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false)
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [lastSync, setLastSync] = useState<string>("")
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string
    password: string
    name: string
  } | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role_id: "",
    status: "ACTIVE",
  })

  const [editFormData, setEditFormData] = useState({
    name: "",
    role_id: "",
    status: "ACTIVE",
  })

  useEffect(() => {
    fetchUsers()
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      console.log('📄 Fetching roles from cv_roles...')
      const { data, error } = await supabase
        .from('cv_roles')
        .select('*')
        .order('roles', { ascending: true })

      if (error) {
        console.error('❌ Error fetching roles:', error)
        if (error.message.includes('policy')) {
          setError('Không có quyền đọc danh sách vai trò. Vui lòng kiểm tra RLS policies.')
        }
        throw error
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No roles found in cv_roles table')
        setError('Không tìm thấy vai trò nào. Vui lòng thêm vai trò vào bảng cv_roles.')
        setRoles([])
        return
      }

      console.log('✅ Successfully fetched roles:', data)
      setRoles(data)

      if (data && data.length > 0) {
        const defaultRole = data.find((r: Role) => r.name.toLowerCase() === 'user')
        const defaultRoleId = defaultRole ? defaultRole.roles.toString() : data[0].roles.toString()
        setFormData(prev => ({ ...prev, role_id: defaultRoleId }))
      }
    } catch (error: unknown) {
      console.error('❌ Error in fetchRoles:', error)
      setRoles([])
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: usersData, error: usersError } = await supabase
        .from('cv_profiles')
        .select(`
          *,
          cv_user_roles (
            role_id,
            cv_roles (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (usersError) {
        console.error('❌ Error fetching users:', usersError)
        throw usersError
      }

      const formattedUsers = (usersData || []).map((user: any) => {
        const userRole = user.cv_user_roles?.[0]
        const roleName = userRole?.cv_roles?.name || user.role || 'USER'

        return {
          id: user.id,
          name: user.full_name || user.name || 'Không có tên',
          email: user.email || 'Không có email',
          role: roleName.toUpperCase(),
          status: (user.status || 'active').toUpperCase() as "ACTIVE" | "INACTIVE",
          synced: user.synced !== undefined ? user.synced : true,
          created_at: user.created_at || new Date().toISOString(),
          auth_user_id: user.auth_user_id || user.id
        }
      })

      setUsers(formattedUsers)
      setLastSync(new Date().toLocaleString('vi-VN'))
    } catch (error: unknown) {
      console.error('❌ Error in fetchUsers:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Không thể tải danh sách người dùng: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      await fetchUsers()
      setTimeout(() => setSyncing(false), 500)
    } catch (error) {
      console.error('Error syncing:', error)
      setSyncing(false)
    }
  }

  const fetchActivityLogs = async () => {
    try {
      setActivityLoading(true)
      setIsActivityDialogOpen(true)

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.log('Activity logs table not found or error:', error)
        setActivities([])
      } else {
        setActivities(data || [])
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      setActivities([])
    } finally {
      setActivityLoading(false)
    }
  }

  const generatePassword = () => {
    const length = 12
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleCreateUser = async () => {
    try {
      setCreating(true)
      setError(null)

      if (!formData.name.trim()) {
        setError("❌ Vui lòng nhập họ tên")
        return
      }
      
      if (!formData.email.trim()) {
        setError("❌ Vui lòng nhập email")
        return
      }
      
      if (!validateEmail(formData.email.trim())) {
        setError("❌ Email không hợp lệ")
        return
      }
      
      if (!formData.role_id) {
        setError("❌ Vui lòng chọn vai trò")
        return
      }

      const password = formData.password.trim() || generatePassword()
      
      if (password.length < 6) {
        setError("❌ Mật khẩu phải có ít nhất 6 ký tự")
        return
      }

      const { data: existingUsers, error: checkError } = await supabase
        .from('cv_profiles')
        .select('email')
        .ilike('email', formData.email.trim())
        .limit(1)

      if (existingUsers && existingUsers.length > 0) {
        setError("❌ Email này đã tồn tại trong hệ thống")
        return
      }

      console.log('🚀 Creating user with RPC function...')
      
      const { data, error: rpcError } = await supabase.rpc('create_cv_user_simple', {
        p_email: formData.email.trim(),
        p_password: password,
        p_full_name: formData.name.trim(),
        p_role_id: parseInt(formData.role_id),
        p_status: formData.status.toLowerCase(),
      })

      if (rpcError) {
        console.error('❌ RPC error:', rpcError)
        
        const errorMessage = rpcError.message || ''
        
        if (errorMessage.includes('Email đã tồn tại')) {
          setError("❌ Email này đã được sử dụng")
        } else if (errorMessage.includes('gen_salt') || errorMessage.includes('pgcrypto')) {
          setError("❌ Lỗi hệ thống: Thiếu extension pgcrypto. Vui lòng chạy SQL trong artifact.")
        } else if (errorMessage.includes('undefined_function') || rpcError.code === '42883') {
          setError("❌ Function create_cv_user_simple chưa được tạo. Vui lòng chạy SQL setup.")
        } else if (errorMessage.includes('permission denied')) {
          setError("❌ Không có quyền thực hiện. Vui lòng kiểm tra RLS policies.")
        } else {
          setError(`❌ Lỗi: ${errorMessage}`)
        }
        return
      }

      if (!data) {
        setError("❌ Không nhận được phản hồi từ server")
        return
      }

      console.log('✅ User created successfully with ID:', data)

      setCreatedCredentials({
        email: formData.email.trim(),
        password: password,
        name: formData.name.trim()
      })
      setIsSuccessDialogOpen(true)
      setIsDialogOpen(false)

      setFormData({
        name: "",
        email: "",
        password: "",
        role_id: roles.find((r: Role) => r.name.toLowerCase() === 'user')?.roles.toString() || roles[0]?.roles.toString() || "",
        status: "ACTIVE",
      })
      
      await fetchUsers()

    } catch (error: unknown) {
      console.error('❌ Unexpected error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`❌ Lỗi không xác định: ${errorMessage}`)
    } finally {
      setCreating(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditFormData({
      name: user.name,
      role_id: roles.find((r: Role) => r.name.toUpperCase() === user.role)?.roles.toString() || "",
      status: user.status,
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    try {
      setUpdating(true)
      setError(null)

      if (!editFormData.name.trim()) {
        setError("❌ Vui lòng nhập họ tên")
        return
      }

      if (!editFormData.role_id) {
        setError("❌ Vui lòng chọn vai trò")
        return
      }

      console.log('🔄 Updating user...')

      const { data, error: rpcError } = await supabase.rpc('update_cv_user', {
        p_user_id: editingUser.id,
        p_full_name: editFormData.name.trim(),
        p_role_id: parseInt(editFormData.role_id),
        p_status: editFormData.status.toLowerCase(),
      })

      if (rpcError) {
        console.error('❌ Update error:', rpcError)
        setError(`❌ Lỗi cập nhật: ${rpcError.message}`)
        return
      }

      console.log('✅ User updated successfully')

      setIsEditDialogOpen(false)
      setEditingUser(null)
      await fetchUsers()

      alert("✅ Đã cập nhật thông tin người dùng thành công!")

    } catch (error: unknown) {
      console.error('❌ Unexpected error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`❌ Lỗi: ${errorMessage}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const user = users.find((u: User) => u.id === userId)

    if (!confirm(`⚠️ Bạn có chắc chắn muốn xóa người dùng "${user?.name}"?\n\nLưu ý: Thao tác này không thể hoàn tác.`)) {
      return
    }

    try {
      await supabase
        .from('cv_user_roles')
        .delete()
        .eq('user_id', userId)

      const { error: deleteError } = await supabase
        .from('cv_profiles')
        .delete()
        .eq('id', userId)

      if (deleteError) throw deleteError

      if (user?.auth_user_id) {
        try {
          await supabase.auth.admin.deleteUser(user.auth_user_id)
        } catch (authDeleteError) {
          console.log('Could not delete auth user:', authDeleteError)
        }
      }

      await fetchUsers()
      alert("✅ Đã xóa người dùng thành công!")
    } catch (error: unknown) {
      console.error('Error deleting user:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`❌ Không thể xóa người dùng: ${errorMessage}`)
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role.toUpperCase()) {
      case "ADMIN":
        return "bg-red-100 text-red-700 hover:bg-red-100"
      case "INTERVIEWER":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100"
      case "HR":
        return "bg-purple-100 text-purple-700 hover:bg-purple-100"
      case "USER":
        return "bg-gray-100 text-gray-700 hover:bg-gray-100"
      default:
        return "bg-gray-100 text-gray-700 hover:bg-gray-100"
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role.toUpperCase()) {
      case "ADMIN":
        return <Shield className="h-3 w-3" />
      case "INTERVIEWER":
        return <UserCircle className="h-3 w-3" />
      case "HR":
        return <Users className="h-3 w-3" />
      default:
        return <UserCircle className="h-3 w-3" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getActionLabel = (action: string) => {
    const labels: { [key: string]: string } = {
      'CREATE_USER': 'Tạo người dùng',
      'UPDATE_USER': 'Cập nhật người dùng',
      'DELETE_USER': 'Xóa người dùng',
    }
    return labels[action] || action
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            Quản lý người dùng
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý tài khoản và phân quyền người dùng trong hệ thống
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Thêm người dùng
          </Button>
          <Button variant="outline" onClick={fetchActivityLogs}>
            <Activity className="h-4 w-4 mr-2" /> Lịch sử
          </Button>
        </div>
      </div>

      {lastSync && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          <span>Đồng bộ lần cuối: {lastSync}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 mb-4">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="rounded-lg border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="font-semibold">Họ tên</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Vai trò</TableHead>
              <TableHead className="font-semibold">Trạng thái</TableHead>
              <TableHead className="font-semibold">Ngày tạo</TableHead>
              <TableHead className="w-[120px] text-center font-semibold">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-muted-foreground">Đang tải...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-12 w-12 text-gray-300" />
                    <p className="text-muted-foreground">Chưa có người dùng nào</p>
                    <Button onClick={() => setIsDialogOpen(true)} variant="outline" size="sm" className="mt-2">
                      <Plus className="h-4 w-4 mr-2" /> Tạo người dùng đầu tiên
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getRoleBadgeColor(user.role)} flex items-center gap-1 w-fit`}>
                      {getRoleIcon(user.role)}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"} className="w-fit">
                      {user.status === "ACTIVE" ? "Hoạt động" : "Không hoạt động"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-blue-100 hover:text-blue-700"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-red-100 hover:text-red-700"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Plus className="h-5 w-5 text-blue-600" />
              </div>
              Thêm người dùng mới
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Tạo tài khoản mới để người dùng có thể đăng nhập vào hệ thống
            </p>
          </DialogHeader>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1">
                <span>Họ và tên</span> <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Nguyễn Văn A"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <span>Email</span> <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="example@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Email sẽ được dùng để đăng nhập</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                <span>Mật khẩu</span> <span className="text-xs text-muted-foreground">(Tùy chọn)</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Để trống để tạo tự động"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Hệ thống sẽ tự động tạo mật khẩu mạnh nếu bạn để trống
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center gap-1">
                <span>Vai trò</span> <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={formData.role_id} 
                onValueChange={(value) => setFormData({ ...formData, role_id: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Chọn vai trò">
                    {formData.role_id && roles.length > 0 ? (
                      <div className="flex items-center gap-2">
                        {getRoleIcon(roles.find((r: Role) => r.roles.toString() === formData.role_id)?.name || '')}
                        <span>{roles.find((r: Role) => r.roles.toString() === formData.role_id)?.name}</span>
                      </div>
                    ) : (
                      "Chọn vai trò"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={5}
                  className="bg-white border shadow-lg max-h-80 overflow-y-auto"
                  style={{ zIndex: 9999, width: 'var(--radix-select-trigger-width)' }}
                >
                  {roles.map((role) => (
                    <SelectItem 
                      key={role.roles} 
                      value={role.roles.toString()}
                      className="cursor-pointer hover:bg-accent focus:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role.name)}
                        <span>{role.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {roles.length} vai trò khả dụng
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Trạng thái</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue>
                    {formData.status === "ACTIVE" ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        Hoạt động
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        Không hoạt động
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={5}
                  className="bg-white border shadow-lg"
                  style={{ zIndex: 9999, width: 'var(--radix-select-trigger-width)' }}
                >
                  <SelectItem value="ACTIVE" className="cursor-pointer hover:bg-accent focus:bg-accent">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      Hoạt động
                    </div>
                  </SelectItem>
                  <SelectItem value="INACTIVE" className="cursor-pointer hover:bg-accent focus:bg-accent">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                      Không hoạt động
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDialogOpen(false)
                setError(null)
              }} 
              disabled={creating}
            >
              Hủy
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700" 
              onClick={handleCreateUser} 
              disabled={creating}
            >
              {creating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Tạo tài khoản
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Edit className="h-5 w-5 text-orange-600" />
              </div>
              Chỉnh sửa người dùng
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Cập nhật thông tin người dùng: {editingUser?.name}
            </p>
          </DialogHeader>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="flex items-center gap-1">
                <span>Họ và tên</span> <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="Nguyễn Văn A"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="h-11 px-3 py-2 bg-gray-50 border rounded-md flex items-center text-gray-500">
                <Mail className="h-4 w-4 mr-2" />
                {editingUser?.email}
              </div>
              <p className="text-xs text-muted-foreground">Email không thể thay đổi</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role" className="flex items-center gap-1">
                <span>Vai trò</span> <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={editFormData.role_id} 
                onValueChange={(value) => setEditFormData({ ...editFormData, role_id: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Chọn vai trò">
                    {editFormData.role_id && roles.length > 0 ? (
                      <div className="flex items-center gap-2">
                        {getRoleIcon(roles.find((r: Role) => r.roles.toString() === editFormData.role_id)?.name || '')}
                        <span>{roles.find((r: Role) => r.roles.toString() === editFormData.role_id)?.name}</span>
                      </div>
                    ) : (
                      "Chọn vai trò"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={5}
                  className="bg-white border shadow-lg max-h-80 overflow-y-auto"
                  style={{ zIndex: 9999, width: 'var(--radix-select-trigger-width)' }}
                >
                  {roles.map((role) => (
                    <SelectItem 
                      key={role.roles} 
                      value={role.roles.toString()}
                      className="cursor-pointer hover:bg-accent focus:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role.name)}
                        <span>{role.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Trạng thái</Label>
              <Select 
                value={editFormData.status} 
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue>
                    {editFormData.status === "ACTIVE" ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        Hoạt động
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        Không hoạt động
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={5}
                  className="bg-white border shadow-lg"
                  style={{ zIndex: 9999, width: 'var(--radix-select-trigger-width)' }}
                >
                  <SelectItem value="ACTIVE" className="cursor-pointer hover:bg-accent focus:bg-accent">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      Hoạt động
                    </div>
                  </SelectItem>
                  <SelectItem value="INACTIVE" className="cursor-pointer hover:bg-accent focus:bg-accent">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                      Không hoạt động
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingUser(null)
                setError(null)
              }} 
              disabled={updating}
            >
              Hủy
            </Button>
            <Button 
              className="bg-orange-600 hover:bg-orange-700" 
              onClick={handleUpdateUser} 
              disabled={updating}
            >
              {updating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Đang cập nhật...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Cập nhật
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Tạo tài khoản thành công!</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Thông tin đăng nhập đã được tạo
                </p>
              </div>
            </div>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900">Thông tin đăng nhập</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-blue-700 uppercase">Họ tên</Label>
                    <div className="p-3 bg-white rounded-md border border-blue-200">
                      <p className="font-medium text-gray-900">{createdCredentials.name}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-blue-700 uppercase">Email</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-3 bg-white rounded-md border border-blue-200 flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <p className="font-medium text-gray-900">{createdCredentials.email}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(createdCredentials.email, 'email')}
                        className="h-11 w-11 border-blue-200 hover:bg-blue-50"
                      >
                        {copiedField === 'email' ? 
                          <Check className="h-4 w-4 text-green-600" /> : 
                          <Copy className="h-4 w-4 text-blue-600" />
                        }
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-blue-700 uppercase">Mật khẩu</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-3 bg-white rounded-md border border-blue-200">
                        <p className="font-mono text-sm font-semibold text-gray-900">
                          {showPassword ? createdCredentials.password : '••••••••••••'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowPassword(!showPassword)}
                        className="h-11 w-11 border-blue-200 hover:bg-blue-50"
                      >
                        {showPassword ? 
                          <EyeOff className="h-4 w-4 text-blue-600" /> : 
                          <Eye className="h-4 w-4 text-blue-600" />
                        }
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                        className="h-11 w-11 border-blue-200 hover:bg-blue-50"
                      >
                        {copiedField === 'password' ? 
                          <Check className="h-4 w-4 text-green-600" /> : 
                          <Copy className="h-4 w-4 text-blue-600" />
                        }
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Lưu ý quan trọng</p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Thông tin này chỉ hiển thị <strong>một lần duy nhất</strong>. 
                      Vui lòng sao chép và gửi cho người dùng ngay qua email hoặc các kênh liên lạc khác.
                      <br/><br/>
                      Người dùng có thể đăng nhập bằng email và mật khẩu này tại trang <strong>/login</strong>.
                      Khuyến nghị người dùng đổi mật khẩu sau khi đăng nhập lần đầu.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 w-full h-11" 
              onClick={() => {
                setIsSuccessDialogOpen(false)
                setCreatedCredentials(null)
                setShowPassword(false)
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Đã lưu thông tin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Lịch sử hoạt động</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Theo dõi các thao tác quản lý người dùng gần đây
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => setIsActivityDialogOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            {activityLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">Đang tải lịch sử...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Activity className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-base text-foreground font-medium">Chưa có hoạt động nào</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Các thao tác quản lý người dùng sẽ được ghi lại tại đây
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                      <Activity className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground">
                          {activity.user_name || 'Hệ thống'}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {getActionLabel(activity.action)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {activity.details}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}