import { SkeletonBox, SkeletonListItem } from '@/components/Skeleton'

export default function GroupLoading() {
  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <SkeletonBox className="h-4 w-32 mb-6 rounded-md" />

        <div className="flex items-start justify-between mb-8">
          <div>
            <SkeletonBox className="h-8 w-48 mb-2 rounded-lg" />
            <SkeletonBox className="h-4 w-32 rounded-md" />
          </div>
          <SkeletonBox className="h-9 w-28 rounded-lg" />
        </div>

        {/* Leaderboard skeleton */}
        <div className="bg-felt-800 rounded-2xl border border-felt-600 mb-6 overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-felt-600">
            <SkeletonBox className="h-5 w-28 rounded-md" />
          </div>
          {[1, 2, 3, 4].map((i) => <SkeletonListItem key={i} />)}
        </div>

        {/* Sessions skeleton */}
        <SkeletonBox className="h-5 w-28 mb-3 rounded-md" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-felt-800 rounded-xl border border-felt-600 px-5 py-4 flex items-center justify-between">
              <div>
                <SkeletonBox className="h-4 w-32 mb-2 rounded-md" />
                <SkeletonBox className="h-3 w-20 rounded-md" />
              </div>
              <SkeletonBox className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
