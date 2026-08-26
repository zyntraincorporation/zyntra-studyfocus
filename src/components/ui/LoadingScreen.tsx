export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0B0F14]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#94A3B8] font-medium tracking-wide">ZyntraFocus</p>
      </div>
    </div>
  )
}
