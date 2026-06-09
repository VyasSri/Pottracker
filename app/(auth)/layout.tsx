export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f1117] px-4">
      <div className="w-full max-w-md">
        <h1 className="text-center text-3xl font-bold text-green-500 mb-8 tracking-tight">
          Poker Ledger
        </h1>
        <div className="bg-[#1a1f2e] rounded-2xl shadow-xl p-8">{children}</div>
      </div>
    </div>
  )
}
