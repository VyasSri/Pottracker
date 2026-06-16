export function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`bg-felt-700 animate-pulse rounded-xl ${className}`} />
}

export function SkeletonCard({ rows = 1 }: { rows?: number }) {
  return (
    <div className="bg-felt-800 rounded-xl border border-felt-600 p-5 shadow-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${i > 0 ? 'mt-3' : ''}`}>
          <SkeletonBox className="h-3 w-24 mb-2 rounded-md" />
          <SkeletonBox className="h-5 w-40 rounded-md" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonListItem({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-felt-800 border-b border-felt-700 px-5 py-4 flex items-center justify-between ${className}`}>
      <div className="space-y-2">
        <SkeletonBox className="h-4 w-32 rounded-md" />
        <SkeletonBox className="h-3 w-20 rounded-md" />
      </div>
      <SkeletonBox className="h-5 w-16 rounded-md" />
    </div>
  )
}
