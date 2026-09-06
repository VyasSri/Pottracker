export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10 relative bg-felt-900">
      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gold-400 shadow-sm mb-4">
            <span className="w-3 h-3 rounded-full bg-white/90" />
          </span>
          <p className="text-2xl font-semibold tracking-tight text-felt-50">PotTracker</p>
          <p className="text-felt-400 text-sm mt-1">Track the game. Settle up clean.</p>
        </div>

        <div className="bg-felt-800 rounded-2xl border border-felt-600 shadow-card p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
