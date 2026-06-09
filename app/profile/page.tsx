import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      zelleHandle: true,
      avatarUrl: true,
      dashboardPublic: true,
    },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-[#0f1117] px-6 py-12">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Your profile</h1>
        <p className="text-gray-400 text-sm mb-8">
          Update your display name, Zelle handle, and privacy settings.
        </p>

        <div className="bg-[#1a1f2e] rounded-2xl shadow-xl p-8">
          <ProfileForm initialValues={user} />
        </div>
      </div>
    </main>
  )
}
