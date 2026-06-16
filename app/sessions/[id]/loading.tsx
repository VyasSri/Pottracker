import { SkeletonBox } from '@/components/Skeleton'

export default function SessionLoading() {
  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <SkeletonBox className="h-4 w-48 mb-6 rounded-md" />

        <div className="flex items-center gap-3 mb-7">
          <SkeletonBox className="h-6 w-20 rounded-full" />
          <div>
            <SkeletonBox className="h-5 w-40 mb-1.5 rounded-md" />
            <SkeletonBox className="h-3 w-52 rounded-md" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-felt-800 rounded-xl border border-felt-600 p-4 text-center">
              <SkeletonBox className="h-3 w-16 mx-auto mb-2 rounded-md" />
              <SkeletonBox className="h-6 w-20 mx-auto rounded-md" />
            </div>
          ))}
        </div>

        <SkeletonBox className="h-5 w-24 mb-3 rounded-md" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-felt-800 rounded-xl border border-felt-600 p-4 flex items-center justify-between">
              <div>
                <SkeletonBox className="h-4 w-28 mb-2 rounded-md" />
                <SkeletonBox className="h-3 w-36 rounded-md" />
              </div>
              <SkeletonBox className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
