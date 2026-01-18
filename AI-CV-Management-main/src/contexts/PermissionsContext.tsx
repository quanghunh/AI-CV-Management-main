// src/contexts/PermissionsContext.tsx - OPTIMIZED VERSION
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"

type Permission = {
  module: string
  action: string
  name: string
  description: string
}

type GroupedPermissions = {
  [module: string]: {
    view: boolean
    create: boolean
    update: boolean
    delete: boolean
  }
}

type PermissionsContextType = {
  permissions: Permission[]
  groupedPermissions: GroupedPermissions
  loading: boolean
  error: string | null
  hasPermission: (module: string, action: string) => boolean
  canView: (module: string) => boolean
  canCreate: (module: string) => boolean
  canUpdate: (module: string) => boolean
  canDelete: (module: string) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

// ========================================
// SESSION STORAGE KEYS
// ========================================
const CACHE_KEY_PERMISSIONS = 'cached_permissions'
const CACHE_KEY_GROUPED = 'cached_grouped_permissions'
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

type CachedData<T> = {
  data: T
  timestamp: number
}

// ========================================
// CACHE HELPERS
// ========================================
function getCachedData<T>(key: string): T | null {
  try {
    const cached = sessionStorage.getItem(key)
    if (!cached) return null
    
    const parsed: CachedData<T> = JSON.parse(cached)
    const now = Date.now()
    
    // Check if expired
    if (now - parsed.timestamp > CACHE_EXPIRY_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    
    return parsed.data
  } catch (e) {
    console.error('Error reading cache:', e)
    return null
  }
}

function setCachedData<T>(key: string, data: T): void {
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now()
    }
    sessionStorage.setItem(key, JSON.stringify(cached))
  } catch (e) {
    console.error('Error writing cache:', e)
  }
}

// ========================================
// PROVIDER COMPONENT
// ========================================
export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadPermissions()
    } else {
      // Clear permissions when user logs out
      setPermissions([])
      setGroupedPermissions({})
      setLoading(false)
      setError(null)
      sessionStorage.removeItem(CACHE_KEY_PERMISSIONS)
      sessionStorage.removeItem(CACHE_KEY_GROUPED)
    }
  }, [user])

  const loadPermissions = async () => {
    if (!user?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ No user ID available')
      }
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Loading permissions for user:', user.id)
      }

      // ✅ Try to load from cache first
      const cachedPerms = getCachedData<Permission[]>(CACHE_KEY_PERMISSIONS)
      const cachedGrouped = getCachedData<GroupedPermissions>(CACHE_KEY_GROUPED)
      
      if (cachedPerms && cachedGrouped) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Loaded permissions from cache')
        }
        setPermissions(cachedPerms)
        setGroupedPermissions(cachedGrouped)
        setLoading(false)
        return
      }

      // ✅ Load from database
      const { data: permsData, error: permsError } = await supabase
        .rpc('get_user_permissions', { p_user_id: user.id })

      if (permsError) {
        console.error('❌ Error loading permissions:', permsError)
        
        // ✅ Better error handling
        if (permsError.code === 'PGRST116') {
          throw new Error('RPC function "get_user_permissions" không tồn tại. Vui lòng chạy migrations.')
        } else if (permsError.message.includes('permission denied')) {
          throw new Error('Không có quyền truy cập permissions. Liên hệ Admin.')
        }
        
        throw new Error(`Không thể tải permissions: ${permsError.message}`)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Permissions loaded:', permsData?.length || 0)
      }
      
      const loadedPermissions = permsData || []
      setPermissions(loadedPermissions)

      // ✅ Load grouped permissions
      const { data: groupedData, error: groupedError } = await supabase
        .rpc('get_user_permissions_grouped', { p_user_id: user.id })

      if (groupedError) {
        console.error('❌ Error loading grouped permissions:', groupedError)
        
        if (groupedError.code === 'PGRST116') {
          throw new Error('RPC function "get_user_permissions_grouped" không tồn tại.')
        }
        
        throw new Error(`Không thể tải grouped permissions: ${groupedError.message}`)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Grouped permissions loaded:', groupedData?.length || 0)
      }

      // ✅ Convert array to object for easier access
      const grouped: GroupedPermissions = {}
      groupedData?.forEach((item: any) => {
        grouped[item.module] = {
          view: item.can_view || false,
          create: item.can_create || false,
          update: item.can_update || false,
          delete: item.can_delete || false,
        }
      })
      setGroupedPermissions(grouped)

      // ✅ Cache the results
      setCachedData(CACHE_KEY_PERMISSIONS, loadedPermissions)
      setCachedData(CACHE_KEY_GROUPED, grouped)

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Permissions loaded and cached successfully')
      }

    } catch (err: any) {
      console.error('❌ Error in loadPermissions:', err)
      setError(err.message || 'Không thể tải permissions')
      setPermissions([])
      setGroupedPermissions({})
    } finally {
      setLoading(false)
    }
  }

  // ✅ Memoized functions - Avoid re-creating on every render
  const hasPermission = useCallback((module: string, action: string): boolean => {
    const result = permissions.some(p => p.module === module && p.action === action)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 hasPermission(${module}, ${action}):`, result)
    }
    
    return result
  }, [permissions])

  const canView = useCallback((module: string): boolean => {
    const result = groupedPermissions[module]?.view || false
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`👁️ canView(${module}):`, result)
    }
    
    return result
  }, [groupedPermissions])

  const canCreate = useCallback((module: string): boolean => {
    const result = groupedPermissions[module]?.create || false
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`➕ canCreate(${module}):`, result)
    }
    
    return result
  }, [groupedPermissions])

  const canUpdate = useCallback((module: string): boolean => {
    const result = groupedPermissions[module]?.update || false
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✏️ canUpdate(${module}):`, result)
    }
    
    return result
  }, [groupedPermissions])

  const canDelete = useCallback((module: string): boolean => {
    const result = groupedPermissions[module]?.delete || false
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🗑️ canDelete(${module}):`, result)
    }
    
    return result
  }, [groupedPermissions])

  const refreshPermissions = useCallback(async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Refreshing permissions...')
    }
    
    // Clear cache before refresh
    sessionStorage.removeItem(CACHE_KEY_PERMISSIONS)
    sessionStorage.removeItem(CACHE_KEY_GROUPED)
    
    await loadPermissions()
  }, [user?.id])

  // ✅ Memoize context value to avoid unnecessary re-renders
  const contextValue = useMemo(() => ({
    permissions,
    groupedPermissions,
    loading,
    error,
    hasPermission,
    canView,
    canCreate,
    canUpdate,
    canDelete,
    refreshPermissions,
  }), [
    permissions,
    groupedPermissions,
    loading,
    error,
    hasPermission,
    canView,
    canCreate,
    canUpdate,
    canDelete,
    refreshPermissions,
  ])

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  )
}

// ========================================
// HOOKS
// ========================================

// ✅ Safe hook with fallback
export const usePermissions = () => {
  const context = useContext(PermissionsContext)
  
  if (!context) {
    // ✅ Fallback instead of throwing error
    console.warn('⚠️ usePermissions used outside PermissionsProvider, returning safe defaults')
    
    return {
      permissions: [],
      groupedPermissions: {},
      loading: false,
      error: 'Context not available',
      hasPermission: () => false,
      canView: () => false,
      canCreate: () => false,
      canUpdate: () => false,
      canDelete: () => false,
      refreshPermissions: async () => {},
    }
  }
  
  return context
}

// ✅ Hook tiện ích để check quyền cho một module cụ thể
export const useModulePermissions = (module: string) => {
  const { groupedPermissions, hasPermission } = usePermissions()
  
  const result = useMemo(() => ({
    canView: groupedPermissions[module]?.view || false,
    canCreate: groupedPermissions[module]?.create || false,
    canUpdate: groupedPermissions[module]?.update || false,
    canDelete: groupedPermissions[module]?.delete || false,
    hasPermission: (action: string) => hasPermission(module, action),
  }), [groupedPermissions, module, hasPermission])

  if (process.env.NODE_ENV === 'development') {
    console.log(`🎯 useModulePermissions(${module}):`, result)
  }
  
  return result
}