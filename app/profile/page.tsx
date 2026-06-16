import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, displayName: true, zelleHandle: true, avatarUrl: true, dashboardPublic: true },
  })
  if (!user) redirect('/login')

  const host = headers().get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const publicUrl = `${protocol}://${host}/u/${user.id}`

  return (
    <main className="min-h-screen bg-felt-900 px-6 py-12">
      <div className="max-w-lg mx-auto">
        <h1 className="font-display text-2xl font-bold text-felt-50 mb-1">Your Profile</h1>
        <p className="text-felt-400 text-sm mb-8">
          Update your display name, Zelle handle, and privacy settings.
        </p>
        <div className="bg-felt-800 rounded-2xl shadow-card border border-felt-600 p-8">
          <ProfileForm initialValues={user} />
        </div>

        {user.dashboardPublic && (
          <div className="mt-4 bg-felt-800 rounded-xl border border-felt-600 px-5 py-4">
            <p className="text-felt-300 text-sm font-semibold mb-1">Your public dashboard</p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-400 hover:text-gold-300 text-sm break-all transition-colors"
            >
              {publicUrl}
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
