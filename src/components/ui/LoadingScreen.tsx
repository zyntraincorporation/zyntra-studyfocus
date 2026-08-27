import appIcon from '@/assets/icon.jpg'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0B0F14]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <img
            src={appIcon}
            alt="ZyntraFocus"
            className="w-12 h-12 rounded-xl object-cover ring-2 ring-[#6366F1]/30 animate-pulse shadow-lg"
          />
        </div>
        <p className="text-sm text-[#94A3B8] font-medium tracking-wide">ZyntraFocus</p>
      </div>
    </div>
  )
}
