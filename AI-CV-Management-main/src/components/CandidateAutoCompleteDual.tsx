"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { User, Mail, Search, Check, X, Loader2 } from 'lucide-react'
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

interface CandidateAutoCompleteDualProps {
  value?: string;
  onCandidateSelect: (candidate: Candidate | null) => void;
  placeholder?: string;
  className?: string;
}

export function CandidateAutoCompleteDual({
  value,
  onCandidateSelect,
  placeholder = "Nhập tên hoặc email ứng viên...",
  className = ""
}: CandidateAutoCompleteDualProps) {
  const [nameInputValue, setNameInputValue] = useState("")
  const [emailInputValue, setEmailInputValue] = useState("")
  const [nameSuggestions, setNameSuggestions] = useState<Candidate[]>([])
  const [emailSuggestions, setEmailSuggestions] = useState<Candidate[]>([])
  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false)
  const [isEmailDropdownOpen, setIsEmailDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const nameDropdownRef = useRef<HTMLDivElement>(null)
  const emailDropdownRef = useRef<HTMLDivElement>(null)

  // Xử lý click outside để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close name dropdown
      if (nameDropdownRef.current && !nameDropdownRef.current.contains(event.target as Node)) {
        setIsNameDropdownOpen(false)
      }
      // Close email dropdown
      if (emailDropdownRef.current && !emailDropdownRef.current.contains(event.target as Node)) {
        setIsEmailDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Tìm kiếm ứng viên theo tên
  const searchCandidatesByName = useCallback(async (searchValue: string) => {
    console.log('Searching by name:', searchValue)

    if (!searchValue || searchValue.trim().length < 2) {
      console.log('Name search too short or empty')
      setNameSuggestions([])
      setIsNameDropdownOpen(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
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
        .ilike('full_name', `%${searchValue.trim()}%`)
        .limit(10)
        .order('full_name')

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Name search results:', data)
      const candidates = (data as unknown as Candidate[]) || []
      setNameSuggestions(candidates)
      setIsNameDropdownOpen(candidates.length > 0)
    } catch (error) {
      console.error('Error searching candidates by name:', error)
      setNameSuggestions([])
      setIsNameDropdownOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Tìm kiếm ứng viên theo email
  const searchCandidatesByEmail = useCallback(async (searchValue: string) => {
    console.log('Searching by email:', searchValue)

    // Thay đổi điều kiện: chỉ cần 2 ký tự và không bắt buộc có @ để cho phép gợi ý sớm hơn
    if (!searchValue || searchValue.trim().length < 2) {
      console.log('Email search too short or empty')
      setEmailSuggestions([])
      setIsEmailDropdownOpen(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
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
        .ilike('email', `%${searchValue.trim()}%`)
        .limit(10)
        .order('full_name')

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Email search results:', data)
      const candidates = (data as unknown as Candidate[]) || []
      setEmailSuggestions(candidates)
      setIsEmailDropdownOpen(candidates.length > 0)
    } catch (error) {
      console.error('Error searching candidates by email:', error)
      setEmailSuggestions([])
      setIsEmailDropdownOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search cho tên
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCandidatesByName(nameInputValue)
    }, 300)

    return () => clearTimeout(timer)
  }, [nameInputValue, searchCandidatesByName])

  // Debounce search cho email
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCandidatesByEmail(emailInputValue)
    }, 300)

    return () => clearTimeout(timer)
  }, [emailInputValue, searchCandidatesByEmail])

  // Xử lý input change cho tên
  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNameInputValue(value)

    // Nếu input rỗng, reset selection
    if (!value.trim()) {
      handleClearSelection()
    }
  }

  // Xử lý input change cho email
  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmailInputValue(value)

    // Nếu input rỗng, reset selection
    if (!value.trim()) {
      handleClearSelection()
    }
  }

  // Xử lý chọn ứng viên từ gợi ý tên
  const handleSelectCandidateByName = (candidate: Candidate) => {
    console.log('Selected candidate by name:', candidate)
    setSelectedCandidate(candidate)

    // Cập nhật cả hai input value
    setNameInputValue(candidate.full_name)
    setEmailInputValue(candidate.email)

    // Đóng cả hai dropdown
    setIsNameDropdownOpen(false)
    setIsEmailDropdownOpen(false)

    // Gọi callback để thông báo cho component cha
    onCandidateSelect(candidate)

    // Log thông báo đã chọn ứng viên
    console.log(`✅ Đã chọn ứng viên: ${candidate.full_name} - Email: ${candidate.email}`)
  }

  // Xử lý chọn ứng viên từ gợi ý email
  const handleSelectCandidateByEmail = (candidate: Candidate) => {
    console.log('Selected candidate by email:', candidate)
    setSelectedCandidate(candidate)

    // Cập nhật cả hai input value
    setNameInputValue(candidate.full_name)
    setEmailInputValue(candidate.email)

    // Đóng cả hai dropdown
    setIsNameDropdownOpen(false)
    setIsEmailDropdownOpen(false)

    // Gọi callback để thông báo cho component cha
    onCandidateSelect(candidate)

    // Log thông báo đã chọn ứng viên
    console.log(`✅ Đã chọn ứng viên: ${candidate.full_name} - Email: ${candidate.email}`)
  }

  // Xử lý xóa lựa chọn
  const handleClearSelection = () => {
    setSelectedCandidate(null)
    setNameInputValue("")
    setEmailInputValue("")
    setIsNameDropdownOpen(false)
    setIsEmailDropdownOpen(false)
    onCandidateSelect(null)
  }

  // Hiển thị gợi ý
  const renderSuggestionItem = (candidate: Candidate, type: 'name' | 'email', onSelect: (candidate: Candidate) => void) => {
    return (
      <div
        key={`${candidate.id}-${type}`}
        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
        onClick={() => onSelect(candidate)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-medium text-gray-900 truncate">
                {candidate.full_name}
              </span>
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
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Ô nhập tên */}
      <div className="relative" ref={nameDropdownRef}>
        <label className="flex items-center gap-2 text-sm font-medium mb-2">
          <User className="w-4 h-4" />
          Tên ứng viên
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={nameInputRef}
            value={nameInputValue}
            onChange={handleNameInputChange}
            placeholder="Nhập tên ứng viên..."
            className="pl-10 bg-white pr-10"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {selectedCandidate && !loading && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={handleClearSelection}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Dropdown gợi ý theo tên */}
        {isNameDropdownOpen && nameSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {nameSuggestions.map((candidate) =>
              renderSuggestionItem(candidate, 'name', handleSelectCandidateByName)
            )}
          </div>
        )}

        {/* Hiển thị thông báo khi không tìm thấy kết quả */}
        {isNameDropdownOpen && nameSuggestions.length === 0 && nameInputValue.trim().length >= 2 && !loading && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
            <p className="text-sm text-gray-500">Không tìm thấy ứng viên nào với tên: "{nameInputValue}"</p>
          </div>
        )}
      </div>

      {/* Ô nhập email */}
      <div className="relative" ref={emailDropdownRef}>
        <label className="flex items-center gap-2 text-sm font-medium mb-2">
          <Mail className="w-4 h-4" />
          Email ứng viên
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={emailInputRef}
            value={emailInputValue}
            onChange={handleEmailInputChange}
            placeholder="Nhập email ứng viên..."
            className="pl-10 bg-white pr-10"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {selectedCandidate && !loading && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={handleClearSelection}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Dropdown gợi ý theo email */}
        {isEmailDropdownOpen && emailSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {emailSuggestions.map((candidate) =>
              renderSuggestionItem(candidate, 'email', handleSelectCandidateByEmail)
            )}
          </div>
        )}

        {/* Hiển thị thông báo khi không tìm thấy kết quả */}
        {isEmailDropdownOpen && emailSuggestions.length === 0 && emailInputValue.trim().length >= 2 && !loading && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
            <p className="text-sm text-gray-500">Không tìm thấy ứng viên nào với email: "{emailInputValue}"</p>
          </div>
        )}
      </div>

      {/* Hiển thị box thông tin ứng viên đã chọn (chỉ hiện khi đã chọn) */}
      {selectedCandidate && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div>
            <p className="text-sm font-medium text-blue-800">
              Đã chọn ứng viên:
            </p>
            <p className="text-base font-semibold text-blue-900">
              {selectedCandidate.full_name}
            </p>
            <p className="text-sm text-blue-700">
              Email: {selectedCandidate.email}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              ✅ Đã chọn ứng viên: {selectedCandidate.full_name} - Email: {selectedCandidate.email}
            </p>
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 p-0 h-auto text-xs"
              onClick={handleClearSelection}
            >
              <X className="w-4 h-4 mr-1" />
              Thay đổi ứng viên
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        💡 Gợi ý: Nhập ít nhất 2 ký tự cho tên hoặc email để tìm kiếm. Khi chọn một ứng viên, thông tin còn lại sẽ tự động được điền.
      </p>
    </div>
  )
}