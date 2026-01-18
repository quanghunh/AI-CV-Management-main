import * as React from "react"
import { cn } from "@/lib/utils"

export interface ToastProps {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Toast({ title, description, action }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 min-w-[240px] rounded-lg bg-white shadow-lg border p-4">
      {title && <div className="font-medium">{title}</div>}
      {description && <div className="text-sm text-gray-600 mt-1">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ToastViewport() {
  return <div className="fixed bottom-4 right-4 z-50" />
}
