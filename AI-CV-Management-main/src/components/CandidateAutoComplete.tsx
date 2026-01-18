"use client"

import { useState, useEffect, useRef } from "react"
import { User, Mail, Search, Check } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabaseClient"

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  job_id?: string;
  cv_jobs?: {
    id: string;
    title: string;
    level: string;
  } | null;
}

interface CandidateAutoCompleteProps {
  value?: string;
  onCandidateSelect: (candidate: Candidate | null) => void;
  placeholder?: string;
  className?: string;
}

export function CandidateAutoComplete({
  value,
  onCandidateSelect,
  placeholder = "Nhập tên hoặc email ứng viên...",
  className = ""
}: CandidateAutoCompleteProps) {
  const [inputValue, setInputValue] = useState(value || "")
  const [suggestions, setSuggestions] = useState<Candidate[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [searchMode, setSearchMode] = useState<"name" | "email" | "both">("both")
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Xử lý click outside để đóng dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Tìm kiếm ứng viên
  const searchCandidates = async (searchValue: string) => {
    if (!searchValue.trim()) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    setLoading(true)
    try {
      // Kiểm tra xem input có phải là email không
      const isEmail = searchValue.includes('@')

      let query = supabase
        .from('cv_candidates')
        .select(`
          id,
          full_name,
          email,
          job_id,
          cv_jobs (
            id,
            title,
            level
          )
        `)
        .limit(10)

      // Tìm kiếm theo tên hoặc email
      if (isEmail) {
        query = query.ilike('email', `%${searchValue}%`)
      } else {
        query = query.ilike('full_name', `%${searchValue}%`)
      }

      const { data, error } = await query.order('full_name')

      if (error) throw error
      setSuggestions((data as unknown as Candidate[]) || [])
      setIsOpen(true)
    } catch (error) {
      console.error('Error searching candidates:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCandidates(inputValue)
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue])

  // Xử lý input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Nếu input rỗng, reset selection
    if (!value.trim()) {
      setSelectedCandidate(null)
      onCandidateSelect(null)
    }
  }

  // Xử lý chọn ứng viên
  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate)
    setInputValue(candidate.full_name)
    setIsOpen(false)
    onCandidateSelect(candidate)
  }

  // Xử lý khi có nhiều ứng viên cùng tên
  const handleShowEmailOptions = (name: string) => {
    const filteredSuggestions = suggestions.filter(s => s.full_name === name)
    if (filteredSuggestions.length > 1) {
      // Hiển thị tất cả các ứng viên có cùng tên với email khác nhau
      setSuggestions(filteredSuggestions)
    }
  }

  // Hiển thị gợi ý
  const renderSuggestionItem = (candidate: Candidate) => {
    const hasSameName = suggestions.some(s => s.full_name === candidate.full_name && s.email !== candidate.email)

    return (
      <div
        key={candidate.id}
        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
        onClick={() => handleSelectCandidate(candidate)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-medium text-gray-900 truncate">
                {candidate.full_name}
              </span>
              {hasSameName && (
                <Badge variant="outline" className="text-xs">
                  {candidate.email}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{candidate.email}</span>
            </div>
            {candidate.cv_jobs && (
              <div className="mt-1">
                <Badge variant="secondary" className="text-xs">
                  {candidate.cv_jobs.title}
                </Badge>
              </div>
            )}
          </div>
          {selectedCandidate?.id === candidate.id && (
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
          )}
        </div>

        {/* Nếu có nhiều ứng viên cùng tên, hiển thị nút xem thêm */}
        {hasSameName && suggestions.findIndex(s => s.full_name === candidate.full_name) === 0 && (
          <div className="mt-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-blue-600 hover:text-blue-700 p-0 h-auto"
              onClick={(e) => {
                e.stopPropagation()
                handleShowEmailOptions(candidate.full_name)
              }}
            >
              Xem tất cả ứng viên tên "{candidate.full_name}"
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-10 bg-white pr-10"
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true)
            }
          }}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
        {selectedCandidate && !loading && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => {
              setSelectedCandidate(null)
              setInputValue("")
              onCandidateSelect(null)
            }}
          >
            <span className="sr-only">Clear</span>
            ×
          </Button>
        )}
      </div>

      {/* Dropdown suggestions */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map(renderSuggestionItem)}
        </div>
      )}

      {/* Hiển thị ứng viên đã chọn */}
      {selectedCandidate && !isOpen && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-800">
              Đã chọn: {selectedCandidate.full_name}
            </span>
            <span className="text-green-600">({selectedCandidate.email})</span>
          </div>
          {selectedCandidate.cv_jobs && (
            <div className="mt-1 ml-6">
              <Badge variant="outline" className="text-xs">
                Vị trí: {selectedCandidate.cv_jobs.title}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  )
}