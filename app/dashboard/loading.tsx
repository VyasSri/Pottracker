import { SkeletonBox, SkeletonListItem } from '@/components/Skeleton'

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <SkeletonBox className="h-8 w-64 mb-2 rounded-lg" />
          <SkeletonBox className="h-4 w-40 rounded-md" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-felt-800 rounded-xl border border-felt-600 p-5">
              <SkeletonBox className="h-3 w-20 mb-3 rounded-md" />
              <SkeletonBox className="h-7 w-24 rounded-md" />
            </div>
          ))}
        </div>

        <SkeletonBox className="h-5 w-28 mb-3 rounded-md" />
        <div className="space-y-2 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-felt-800 rounded-xl border border-felt-600 px-5 py-4 flex items-center justify-between">
              <div>
                <SkeletonBox className="h-4 w-36 mb-2 rounded-md" />
                <SkeletonBox className="h-3 w-24 rounded-md" />
              </div>
              <SkeletonBox className="h-4 w-4 rounded" />
            </div>
          ))}
        </div>

        <SkeletonBox className="h-5 w-36 mb-3 rounded-md" />
        <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden">
          {[1, 2, 3].map((i) => <SkeletonListItem key={i} />)}
        </div>
      </div>
    </main>
  )
}
