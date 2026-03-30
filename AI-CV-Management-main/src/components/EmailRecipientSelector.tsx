"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { User, Mail, Search, X, Loader2 } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabaseClient"

interface EmailRecipientSelectorProps {
  value: string; // Comma separated string of emails or IDs
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface Candidate {
  id: string;
  full_name: string;
  email: string;
}

export function EmailRecipientSelector({
  value,
  onChange,
  placeholder = "Nhập tên, email hoặc gõ email ngoài rồi Enter...",
  className = ""
}: EmailRecipientSelectorProps) {
  const [inputValue, setInputValue] = useState("")
  const [suggestions, setSuggestions] = useState<Candidate[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Track selected chips: { tempId: string, label: string, value: string, isCandidate: boolean }
  const [selectedChips, setSelectedChips] = useState<Array<{ id: string, label: string, value: string, isCandidate: boolean }>>([])
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize chips from existing string value (could be comma separated emails/ids)
  useEffect(() => {
    // This simple parsed doesn't hit DB to resolve IDs back to names
    // It just treats the comma separated string as separate chips
    if (!value) {
      if (selectedChips.length > 0) setSelectedChips([])
      return
    }
    
    // Only parse if value string does not match our current chips' derived string
    const currentValues = selectedChips.map(c => c.value).join(',')
    if (value !== currentValues) {
      const parts = value.split(',').map(s => s.trim()).filter(Boolean)
      const newChips = parts.map(p => ({
        id: Math.random().toString(36).substring(2, 9),
        label: p,
        value: p,
        isCandidate: !p.includes('@') // roughly if it doesn't have @ it's an ID
      }))
      setSelectedChips(newChips)

      // Fetch corresponding candidate details for raw IDs
      const candidateIds = newChips.filter(c => c.isCandidate).map(c => c.value);
      if (candidateIds.length > 0) {
        supabase
          .from('cv_candidates')
          .select('id, full_name, email')
          .in('id', candidateIds)
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              setSelectedChips(prev => prev.map(chip => {
                const matched = data.find(c => c.id === chip.value);
                if (matched) {
                  return { ...chip, label: `${matched.full_name} (${matched.email})`, isCandidate: true };
                }
                return chip;
              }));
            }
          });
      }
    }
  }, [value, selectedChips])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const updateParent = (chips: typeof selectedChips) => {
    onChange(chips.map(c => c.value).join(','))
  }

  const addChip = (chip: typeof selectedChips[0]) => {
    // Prevent duplicates by value
    if (selectedChips.some(c => c.value === chip.value)) {
      setInputValue("")
      setIsDropdownOpen(false)
      return;
    }
    const newChips = [...selectedChips, chip]
    setSelectedChips(newChips)
    updateParent(newChips)
    setInputValue("")
    setIsDropdownOpen(false)
    inputRef.current?.focus()
  }

  const removeChip = (idToRemove: string) => {
    const newChips = selectedChips.filter(c => c.id !== idToRemove)
    setSelectedChips(newChips)
    updateParent(newChips)
  }

  const searchCandidates = useCallback(async (searchValue: string) => {
    if (!searchValue || searchValue.trim().length < 2) {
      setSuggestions([])
      setIsDropdownOpen(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cv_candidates')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${searchValue.trim()}%,email.ilike.%${searchValue.trim()}%`)
        .limit(10)
        .order('full_name')

      if (error) throw error

      const candidates = (data as Candidate[]) || []
      setSuggestions(candidates)
      setIsDropdownOpen(true)
    } catch (error) {
      console.error('Error searching candidates:', error)
      setSuggestions([])
      setIsDropdownOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchCandidates(inputValue)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue, searchCandidates])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = inputValue.trim()
      if (val) {
        addChip({
          id: Math.random().toString(36).substring(2, 9),
          label: val,
          value: val,
          isCandidate: false
        })
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedChips.length > 0) {
      removeChip(selectedChips[selectedChips.length - 1].id)
    }
  }

  return (
    <div className={`space-y-1 relative ${className}`} ref={dropdownRef}>
      <div 
        className="min-h-[40px] flex flex-wrap items-center gap-2 p-1.5 bg-gray-50 border border-gray-200 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all cursor-text shadow-sm"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedChips.map(chip => (
          <Badge 
            key={chip.id} 
            variant="secondary" 
            className={`flex items-center gap-1.5 px-2 py-1 ${chip.isCandidate ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}`}
          >
            {chip.isCandidate ? <User className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
            <span className="truncate max-w-[200px]">{chip.label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeChip(chip.id);
              }}
              className="ml-1 text-gray-500 hover:text-red-500 rounded-full focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        
        <div className="flex-1 min-w-[200px] relative flex items-center gap-2">
          {!inputValue && selectedChips.length === 0 && (
            <Search className="h-4 w-4 text-gray-400 shrink-0 ml-1" />
          )}
          <input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedChips.length === 0 ? placeholder : "Thêm người nhận..."}
            className="w-full bg-transparent outline-none text-sm p-1 placeholder:text-gray-400"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {isDropdownOpen && (
        <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.length > 0 ? (
            suggestions.map(candidate => (
              <div
                key={candidate.id}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                onClick={() => addChip({
                  id: Math.random().toString(36).substring(2, 9),
                  label: `${candidate.full_name} (${candidate.email})`,
                  value: candidate.id,
                  isCandidate: true
                })}
              >
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-medium text-gray-900 truncate">
                    {candidate.full_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{candidate.email}</span>
                </div>
              </div>
            ))
          ) : (
            inputValue.trim().length >= 2 && !loading && (
              <div className="p-3 text-sm text-gray-500 flex items-center justify-between">
                <span>Không tìm thấy trong hệ thống...</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">Nhấn Enter để gửi đến "{inputValue}"</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
