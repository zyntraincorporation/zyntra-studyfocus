import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
}

export default function Input({ label, error, leftIcon, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#F8FAFC]">{label}</label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            {leftIcon}
          </span>
        )}
        <input
          {...props}
          className={[
            'w-full h-10 rounded-lg border bg-[#17202A] text-[#F8FAFC] placeholder-[#64748B] text-sm transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent',
            error ? 'border-[#EF4444]' : 'border-[#1E2A36] hover:border-[#2D3B4D]',
            leftIcon ? 'pl-10 pr-3' : 'px-3',
            className,
          ].join(' ')}
        />
      </div>
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
