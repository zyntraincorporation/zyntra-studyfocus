import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  maxWidth?: string   // custom tailwind class e.g. 'max-w-3xl'
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' }

export default function Modal({ isOpen, onClose, title, children, size = 'md', maxWidth }: ModalProps) {

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal */}
      <div
        className={`relative w-full ${maxWidth ?? sizeMap[size]} bg-[#111820] border border-[#1E2A36] rounded-xl shadow-2xl animate-fade-in`}

        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1E2A36]">
            <h2 className="text-base font-semibold text-[#F8FAFC]">{title}</h2>
            <button
              onClick={onClose}
              className="text-[#64748B] hover:text-[#F8FAFC] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
