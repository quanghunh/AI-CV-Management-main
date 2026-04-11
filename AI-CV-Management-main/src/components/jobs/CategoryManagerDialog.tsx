"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Edit, Save, X, Tag, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabaseClient"

// ==================== TYPES ====================

export interface JobCategory {
  id: string
  type: string
  value: string
  label: string
  is_default: boolean
  sort_order: number
  metadata?: {
    color?: string
    priority?: number
    description?: string
    default_weight?: number
  }
}

interface CategoryGroup {
  type: string
  label: string
  icon: string
  items: JobCategory[]
}

interface CategoryManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCategoriesUpdated: () => void
}

// ==================== CATEGORY TYPE CONFIG ====================

const CATEGORY_TYPES: Record<string, { label: string; icon: string }> = {
  title: { label: "Vị trí công việc", icon: "💼" },
  department: { label: "Phòng ban", icon: "🏢" },
  level: { label: "Cấp độ", icon: "📊" },
  work_location: { label: "Địa điểm", icon: "📍" },
  job_type: { label: "Loại hình", icon: "⏰" },
  status: { label: "Trạng thái", icon: "🔖" },
  rubric_level: { label: "Mức đánh giá tiêu chí", icon: "⭐" },
}

// ==================== MAIN COMPONENT ====================

export function CategoryManagerDialog({
  open,
  onOpenChange,
  onCategoriesUpdated,
}: CategoryManagerDialogProps) {
  const [categories, setCategories] = useState<JobCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState("")
  const [editingMetadata, setEditingMetadata] = useState<{
    color?: string
    priority?: number
    description?: string
    default_weight?: number
  }>({})
  const [addingType, setAddingType] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState("")
  const [newMetadata, setNewMetadata] = useState<{
    color?: string
    priority?: number
    description?: string
    default_weight?: number
  }>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) fetchCategories()
  }, [open])

  // ==================== DATA FETCHING ====================

  async function fetchCategories() {
    setLoading(true)
    const { data, error } = await supabase
      .from("cv_job_categories")
      .select("*")
      .order("sort_order", { ascending: true })

    if (data) setCategories(data)
    if (error) console.error("Error fetching categories:", error)
    setLoading(false)
  }

  // ==================== GROUP BY TYPE ====================

  const groupedCategories: CategoryGroup[] = Object.entries(CATEGORY_TYPES).map(
    ([type, config]) => ({
      type,
      label: config.label,
      icon: config.icon,
      items: categories.filter((c) => c.type === type),
    })
  )

  // ==================== TOGGLE EXPAND ====================

  const toggleExpand = (type: string) => {
    setExpandedTypes((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  // ==================== ADD CATEGORY ====================

  const handleAdd = async (type: string) => {
    if (!newLabel.trim()) return

    setSaving(true)
    const value = newLabel.trim()
    const maxOrder = Math.max(
      0,
      ...categories.filter((c) => c.type === type).map((c) => c.sort_order)
    )

    const insertData: any = {
      type,
      value,
      label: value,
      is_default: false,
      sort_order: maxOrder + 1,
    }

    if (type === 'rubric_level' && Object.keys(newMetadata).length > 0) {
      insertData.metadata = newMetadata
    }

    const { error } = await supabase.from("cv_job_categories").insert([insertData])

    if (error) {
      if (error.code === "23505") {
        alert("❌ Giá trị này đã tồn tại!")
      } else {
        alert(`❌ Lỗi: ${error.message}`)
      }
    } else {
      setNewLabel("")
      setAddingType(null)
      await fetchCategories()
      onCategoriesUpdated()
    }
    setSaving(false)
  }

  // ==================== EDIT CATEGORY ====================

  const handleEdit = async (id: string) => {
    if (!editingLabel.trim()) return

    setSaving(true)
    const updateData: any = { label: editingLabel.trim(), value: editingLabel.trim() }
    if (Object.keys(editingMetadata).length > 0) {
      updateData.metadata = editingMetadata
    }

    const { error } = await supabase
      .from("cv_job_categories")
      .update(updateData)
      .eq("id", id)
      .eq("is_default", false) // Only allow editing non-default items

    if (error) {
      alert(`❌ Lỗi: ${error.message}`)
    } else {
      setEditingId(null)
      setEditingLabel("")
      await fetchCategories()
      onCategoriesUpdated()
    }
    setSaving(false)
  }

  // ==================== DELETE CATEGORY ====================

  const handleDelete = async (item: JobCategory) => {
    if (item.is_default) {
      alert("⚠️ Không thể xóa danh mục mặc định!")
      return
    }

    if (!confirm(`Xóa "${item.label}"?`)) return

    const { error } = await supabase
      .from("cv_job_categories")
      .delete()
      .eq("id", item.id)

    if (error) {
      alert(`❌ Lỗi: ${error.message}`)
    } else {
      await fetchCategories()
      onCategoriesUpdated()
    }
  }

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Quản lý danh mục
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Thêm, chỉnh sửa hoặc xóa các tùy chọn trong form tạo JD
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {groupedCategories.map((group) => (
              <div
                key={group.type}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Group Header */}
                <button
                  className="w-full flex items-center justify-between p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  onClick={() => toggleExpand(group.type)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{group.icon}</span>
                    <span className="font-semibold text-gray-800 text-sm sm:text-base">
                      {group.label}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {group.items.length}
                    </Badge>
                  </div>
                  {expandedTypes[group.type] ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {/* Group Items */}
                {expandedTypes[group.type] && (
                  <div className="p-3 sm:p-4 space-y-2">
                    {/* Existing Items */}
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200"
                      >
                        {editingId === item.id ? (
                          // Edit Mode
                          <>
                            <div className="flex-1 space-y-2">
                              <Input
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleEdit(item.id)
                                  if (e.key === "Escape") {
                                    setEditingId(null)
                                    setEditingLabel("")
                                    setEditingMetadata({})
                                  }
                                }}
                              />
                              {group.type === 'rubric_level' && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <label className="block text-gray-600 mb-1">Màu sắc</label>
                                    <Select
                                      value={editingMetadata.color || '#3b82f6'}
                                      onValueChange={(v) => setEditingMetadata(prev => ({ ...prev, color: v }))}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="#ef4444">🔴 Đỏ</SelectItem>
                                        <SelectItem value="#3b82f6">🔵 Xanh dương</SelectItem>
                                        <SelectItem value="#10b981">🟢 Xanh lá</SelectItem>
                                        <SelectItem value="#f59e0b">🟡 Vàng</SelectItem>
                                        <SelectItem value="#8b5cf6">🟣 Tím</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="block text-gray-600 mb-1">Độ ưu tiên</label>
                                    <Select
                                      value={editingMetadata.priority?.toString() || '1'}
                                      onValueChange={(v) => setEditingMetadata(prev => ({ ...prev, priority: parseInt(v) }))}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">Thấp</SelectItem>
                                        <SelectItem value="2">Trung bình</SelectItem>
                                        <SelectItem value="3">Cao</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-gray-600 mb-1">Mô tả quy tắc</label>
                                    <Textarea
                                      value={editingMetadata.description || ''}
                                      onChange={(e) => setEditingMetadata(prev => ({ ...prev, description: e.target.value }))}
                                      placeholder="Mô tả quy tắc đánh giá cho mức này..."
                                      className="min-h-[60px] text-sm resize-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-gray-600 mb-1">Trọng số mặc định (%)</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={editingMetadata.default_weight || 0}
                                      onChange={(e) => setEditingMetadata(prev => ({ ...prev, default_weight: parseInt(e.target.value) || 0 }))}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleEdit(item.id)}
                              disabled={saving}
                            >
                              <Save className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-gray-500 hover:text-gray-700"
                              onClick={() => {
                                setEditingId(null)
                                setEditingLabel("")
                                setEditingMetadata({})
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          // View Mode
                          <>
                            <span className="flex-1 text-sm text-gray-800">
                              {item.label}
                            </span>
                            {item.is_default && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-blue-50 text-blue-600 border-blue-200"
                              >
                                Mặc định
                              </Badge>
                            )}
                            {!item.is_default && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                  onClick={() => {
                                    setEditingId(item.id)
                                    setEditingLabel(item.label)
                                    setEditingMetadata(item.metadata || {})
                                  }}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleDelete(item)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}

                    {/* Add New Item */}
                    {addingType === group.type ? (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-3">
                        <div className="space-y-2">
                          <Input
                            placeholder={`Nhập ${group.label.toLowerCase()} mới...`}
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            className="h-8 text-sm bg-white"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAdd(group.type)
                              if (e.key === "Escape") {
                                setAddingType(null)
                                setNewLabel("")
                                setNewMetadata({})
                              }
                            }}
                          />
                          {group.type === 'rubric_level' && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-gray-600 mb-1">Màu sắc</label>
                                <Select
                                  value={newMetadata.color || '#3b82f6'}
                                  onValueChange={(v) => setNewMetadata(prev => ({ ...prev, color: v }))}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="#ef4444">🔴 Đỏ</SelectItem>
                                    <SelectItem value="#3b82f6">🔵 Xanh dương</SelectItem>
                                    <SelectItem value="#10b981">🟢 Xanh lá</SelectItem>
                                    <SelectItem value="#f59e0b">🟡 Vàng</SelectItem>
                                    <SelectItem value="#8b5cf6">🟣 Tím</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="block text-gray-600 mb-1">Độ ưu tiên</label>
                                <Select
                                  value={newMetadata.priority?.toString() || '1'}
                                  onValueChange={(v) => setNewMetadata(prev => ({ ...prev, priority: parseInt(v) }))}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">Thấp</SelectItem>
                                    <SelectItem value="2">Trung bình</SelectItem>
                                    <SelectItem value="3">Cao</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-gray-600 mb-1">Mô tả quy tắc</label>
                                <Textarea
                                  value={newMetadata.description || ''}
                                  onChange={(e) => setNewMetadata(prev => ({ ...prev, description: e.target.value }))}
                                  placeholder="Mô tả quy tắc đánh giá cho mức này..."
                                  className="min-h-[60px] text-sm resize-none"
                                />
                              </div>
                              <div>
                                <label className="block text-gray-600 mb-1">Trọng số mặc định (%)</label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={newMetadata.default_weight || 0}
                                  onChange={(e) => setNewMetadata(prev => ({ ...prev, default_weight: parseInt(e.target.value) || 0 }))}
                                  className="h-8"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleAdd(group.type)}
                            disabled={saving || !newLabel.trim()}
                          >
                            <Save className="w-3.5 h-3.5 mr-1" />
                            Thêm
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-500"
                            onClick={() => {
                              setAddingType(null)
                              setNewLabel("")
                              setNewMetadata({})
                            }}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Hủy
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 mt-1"
                        onClick={() => {
                          setAddingType(group.type)
                          setNewLabel("")
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Thêm {group.label.toLowerCase()}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CategoryManagerDialog