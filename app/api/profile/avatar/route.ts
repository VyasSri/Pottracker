import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BUCKET = 'avatars'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// Server-side Supabase client using the service role key so we can write to storage
function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const file = formData.get('avatar')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 422 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be under 5 MB' }, { status: 422 })
  }

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${session.user.id}/avatar.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const sb = serverSupabase()
  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}` // cache-bust on re-upload

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
  })

  return NextResponse.json({ avatarUrl })
}
