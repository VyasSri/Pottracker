import { SkeletonBox, SkeletonListItem } from '@/components/Skeleton'

export default function PublicProfileLoading() {
  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <SkeletonBox className="w-10 h-10 rounded-full" />
          <SkeletonBox className="h-8 w-48 rounded-lg" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-felt-800 rounded-xl border border-felt-600 p-4">
              <SkeletonBox className="h-3 w-16 mb-2 rounded-md" />
              <SkeletonBox className="h-7 w-20 rounded-md" />
            </div>
          ))}
        </div>

        <div className="bg-felt-800 rounded-2xl border border-felt-600 p-5 mb-6">
          <SkeletonBox className="h-5 w-36 mb-4 rounded-md" />
          <SkeletonBox className="h-48 w-full rounded-lg" />
        </div>

        <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden">
          <div className="px-5 py-4 border-b border-felt-600">
            <SkeletonBox className="h-5 w-32 rounded-md" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonListItem key={i} />)}
        </div>
      </div>
    </main>
  )
}
