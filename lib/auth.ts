import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      zelleHandle?: string | null
      isGuest?: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    zelleHandle?: string | null
    isGuest?: boolean
  }
}

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      })

      if (!user || !user.password) return null

      const passwordMatch = await bcrypt.compare(credentials.password, user.password)
      if (!passwordMatch) return null

      return {
        id: user.id,
        email: user.email,
        name: user.displayName,
        image: user.avatarUrl ?? null,
        zelleHandle: user.zelleHandle ?? null,
        isGuest: user.isGuest,
      }
    },
  }),
]

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        const u = user as typeof user & { zelleHandle?: string | null; isGuest?: boolean }
        token.zelleHandle = u.zelleHandle ?? null
        token.isGuest     = u.isGuest ?? false
      }
      return token
    },
    async session({ session, token }) {
      session.user.id          = token.id
      session.user.zelleHandle = token.zelleHandle ?? null
      session.user.isGuest     = token.isGuest ?? false
      return session
    },
  },
}

export async function getSession() {
  return getServerSession(authOptions)
}
