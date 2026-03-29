"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Edit, Save, X, Shield, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabaseClient"

// ==================== TYPES ====================

export interface RoleItem {
  roles: number       // primary key của bảng cv_roles
  name: string
  description?: string
  color?: string
  icon?: string
}

interface RoleManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Gọi sau khi thêm/sửa/xóa để User.tsx fetch lại danh sách vai trò */
  onRolesUpdated: () => void
}

// ==================== PRESET OPTIONS ====================

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#6366f1', '#64748b',
]

const PRESET_ICONS = ['👤', '👑', '🎯', '📋', '🔐', '💼', '🛡️', '⚡', '🌟', '🔧']

// Admin (roles = 1) không thể xóa
const PROTECTED_ROLE_IDS = [1]

// ==================== COMPONENT ====================

export function RoleManagerDialog({
  open,
  onOpenChange,
  onRolesUpdated,
}: RoleManagerDialogProps) {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingData, setEditingData] = useState({
    name: '', description: '', color: '#6366f1', icon: '👤',
  })

  // add new state
  const [isAdding, setIsAdding] = useState(false)
  const [newRole, setNewRole] = useState({
    name: '', description: '', color: '#6366f1', icon: '👤',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (open) fetchRoles()
  }, [open])

  // -------- fetch --------

  async function fetchRoles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('cv_roles')
      .select('*')
      .order('roles', { ascending: true })
    if (data) setRoles(data)
    if (error) console.error('fetchRoles error:', error)
    setLoading(false)
  }

  // -------- add --------

  async function handleAdd() {
    const name = newRole.name.trim()
    if (!name) { alert('❌ Vui lòng nhập tên vai trò'); return }
    if (roles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      alert('❌ Tên vai trò này đã tồn tại!'); return
    }

    setSaving(true)
    const { error } = await supabase.from('cv_roles').insert([{
      name,
      description: newRole.description.trim() || null,
      color: newRole.color,
      icon: newRole.icon,
    }])

    if (error) {
      alert(`❌ Lỗi: ${error.message}`)
    } else {
      resetAddForm()
      await fetchRoles()
      onRolesUpdated()   // → User.tsx gọi fetchRoles() → dropdown "Vai trò" cập nhật
    }
    setSaving(false)
  }

  // -------- edit --------

  async function handleEdit(id: number) {
    const name = editingData.name.trim()
    if (!name) { alert('❌ Vui lòng nhập tên vai trò'); return }
    if (roles.some(r => r.roles !== id && r.name.toLowerCase() === name.toLowerCase())) {
      alert('❌ Tên vai trò này đã tồn tại!'); return
    }

    setSaving(true)
    const { error } = await supabase
      .from('cv_roles')
      .update({
        name,
        description: editingData.description.trim() || null,
        color: editingData.color,
        icon: editingData.icon,
      })
      .eq('roles', id)

    if (error) {
      alert(`❌ Lỗi: ${error.message}`)
    } else {
      setEditingId(null)
      await fetchRoles()
      onRolesUpdated()
    }
    setSaving(false)
  }

  // -------- delete --------

  async function handleDelete(role: RoleItem) {
    if (PROTECTED_ROLE_IDS.includes(role.roles)) {
      alert('⚠️ Không thể xóa vai trò Admin mặc định!'); return
    }

    // Kiểm tra có user nào đang dùng không
    const { count } = await supabase
      .from('cv_user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', role.roles)

    if (count && count > 0) {
      alert(`⚠️ Không thể xóa vai trò "${role.name}" vì có ${count} người dùng đang sử dụng!\n\nVui lòng đổi vai trò cho họ trước.`)
      return
    }

    if (!confirm(`Xóa vai trò "${role.name}"?\n\nVai trò này sẽ bị xóa khỏi hệ thống phân quyền.`)) return

    const { error } = await supabase.from('cv_roles').delete().eq('roles', role.roles)
    if (error) { alert(`❌ Lỗi: ${error.message}`); return }
    await fetchRoles()
    onRolesUpdated()
  }

  // -------- helpers --------

  function resetAddForm() {
    setNewRole({ name: '', description: '', color: '#6366f1', icon: '👤' })
    setIsAdding(false)
    setShowAdvanced(false)
  }

  function startEdit(role: RoleItem) {
    setEditingId(role.roles)
    setEditingData({
      name: role.name,
      description: role.description || '',
      color: role.color || '#6366f1',
      icon: role.icon || '👤',
    })
  }

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Quản lý vai trò
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Thêm, chỉnh sửa hoặc xóa vai trò. Vai trò mới sẽ xuất hiện ngay trong Phân quyền &amp; dropdown Thêm người dùng.
          </p>
        </DialogHeader>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Vai trò mới tự động xuất hiện trong <strong>Trang Phân quyền</strong> và <strong>dropdown Vai trò</strong> khi thêm người dùng.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 mt-4">

            {/* ---- Danh sách vai trò ---- */}
            {roles.map(role => (
              <div key={role.roles} className="border border-gray-200 rounded-lg overflow-hidden">
                {editingId === role.roles ? (
                  /* Edit mode */
                  <div className="p-3 bg-blue-50 space-y-3">
                    <div className="flex gap-2 items-center">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 border border-gray-200 bg-white"
                        style={{ backgroundColor: `${editingData.color}20` }}
                      >
                        {editingData.icon}
                      </div>
                      <Input
                        value={editingData.name}
                        onChange={e => setEditingData(p => ({ ...p, name: e.target.value }))}
                        className="h-9 bg-white text-sm font-medium"
                        placeholder="Tên vai trò"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEdit(role.roles)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                    </div>
                    <Input
                      value={editingData.description}
                      onChange={e => setEditingData(p => ({ ...p, description: e.target.value }))}
                      className="h-8 bg-white text-sm"
                      placeholder="Mô tả (tùy chọn)"
                    />
                    {/* Color */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Màu sắc</p>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${editingData.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setEditingData(p => ({ ...p, color: c }))}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Icon */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Icon</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_ICONS.map(ic => (
                          <button
                            key={ic}
                            className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border-2 transition-all hover:scale-110 ${editingData.icon === ic ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                            onClick={() => setEditingData(p => ({ ...p, icon: ic }))}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-8"
                        onClick={() => handleEdit(role.roles)}
                        disabled={saving}
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        {saving ? 'Đang lưu...' : 'Lưu'}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingId(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center gap-3 p-3 bg-white hover:bg-gray-50 transition-colors">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: `${role.color || '#6366f1'}20` }}
                    >
                      {role.icon || '👤'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{role.name}</span>
                        {PROTECTED_ROLE_IDS.includes(role.roles) && (
                          <Badge variant="secondary" className="text-xs bg-red-50 text-red-600 border-red-200 px-1.5 py-0">
                            Mặc định
                          </Badge>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-xs text-gray-500 truncate">{role.description}</p>
                      )}
                    </div>
                    {/* color dot */}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: role.color || '#6366f1' }}
                    />
                    {/* action buttons — ẩn với protected roles */}
                    {!PROTECTED_ROLE_IDS.includes(role.roles) && (
                      <>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => startEdit(role)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(role)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* ---- Thêm vai trò mới ---- */}
            {isAdding ? (
              <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50 space-y-3">
                <p className="text-sm font-semibold text-blue-900">Thêm vai trò mới</p>
                <div className="flex gap-2 items-center">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 bg-white border border-gray-200"
                    style={{ backgroundColor: `${newRole.color}20` }}
                  >
                    {newRole.icon}
                  </div>
                  <Input
                    placeholder="Tên vai trò *"
                    value={newRole.name}
                    onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))}
                    className="h-9 bg-white text-sm"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Escape') resetAddForm() }}
                  />
                </div>
                <Input
                  placeholder="Mô tả (tùy chọn)"
                  value={newRole.description}
                  onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))}
                  className="h-8 bg-white text-sm"
                />

                {/* Advanced toggle */}
                <button
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  onClick={() => setShowAdvanced(v => !v)}
                >
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAdvanced ? 'Ẩn' : 'Tùy chỉnh'} màu sắc &amp; icon
                </button>

                {showAdvanced && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Màu sắc</p>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${newRole.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setNewRole(p => ({ ...p, color: c }))}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Icon</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_ICONS.map(ic => (
                          <button
                            key={ic}
                            className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border-2 transition-all hover:scale-110 ${newRole.icon === ic ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                            onClick={() => setNewRole(p => ({ ...p, icon: ic }))}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9"
                    onClick={handleAdd}
                    disabled={saving || !newRole.name.trim()}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    {saving ? 'Đang thêm...' : 'Thêm vai trò'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-9" onClick={resetAddForm}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline" size="sm"
                className="w-full border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Thêm vai trò mới
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RoleManagerDialog