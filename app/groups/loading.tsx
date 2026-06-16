import { SkeletonBox } from '@/components/Skeleton'

export default function GroupsLoading() {
  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <SkeletonBox className="h-8 w-32 mb-2 rounded-lg" />
            <SkeletonBox className="h-4 w-28 rounded-md" />
          </div>
          <SkeletonBox className="h-9 w-32 rounded-lg" />
        </div>

        <div className="space-y-3 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-felt-800 rounded-xl border border-felt-600 px-5 py-4 flex items-center justify-between">
              <div>
                <SkeletonBox className="h-5 w-40 mb-2 rounded-md" />
                <SkeletonBox className="h-3 w-28 rounded-md" />
              </div>
              <SkeletonBox className="h-4 w-4 rounded" />
            </div>
          ))}
        </div>

        <div className="bg-felt-800 rounded-2xl p-6 border border-felt-600">
          <SkeletonBox className="h-5 w-32 mb-2 rounded-md" />
          <SkeletonBox className="h-4 w-56 mb-4 rounded-md" />
          <SkeletonBox className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </main>
  )
}
