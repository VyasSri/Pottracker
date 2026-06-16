export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-felt-900">

      <div className="absolute inset-0 bg-gradient-radial from-felt-700/40 via-felt-900 to-felt-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#2b0e12_0%,_transparent_60%)] pointer-events-none opacity-60" />

      {/* Card suit watermarks */}
      <div className="absolute top-6  left-6  text-9xl text-felt-600/50 select-none pointer-events-none font-display leading-none">♠</div>
      <div className="absolute bottom-6 right-6 text-9xl text-felt-600/50 select-none pointer-events-none font-display leading-none">♣</div>
      <div className="absolute top-6  right-8  text-7xl text-red-700/30   select-none pointer-events-none font-display leading-none">♥</div>
      <div className="absolute bottom-8 left-8  text-7xl text-red-700/30   select-none pointer-events-none font-display leading-none">♦</div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <p className="font-display text-5xl font-bold tracking-wide" style={{ background: 'linear-gradient(135deg, #e05050, #f99999, #c53030)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            ♠ PotTracker
          </p>
          <p className="text-felt-300 text-xs mt-2 tracking-[0.25em] uppercase">Home Game Tracker</p>
        </div>

        <div className="bg-felt-800/90 backdrop-blur-sm rounded-2xl border border-felt-600 shadow-[0_0_0_1px_rgba(224,80,80,0.1),0_8px_40px_rgba(0,0,0,0.7)] p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
