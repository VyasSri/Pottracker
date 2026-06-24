import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getGroq } from '@/lib/ai/groq'

export const dynamic = 'force-dynamic'
import { toolDefinitions, executeTool } from '@/lib/ai/tools'
import type Groq from 'groq-sdk'

const schema = z.object({ question: z.string().min(1).max(500) })

const SYSTEM_PROMPT = `You are a poker statistics assistant embedded in PotTracker, a home poker tracker app.
You have tools to fetch the current user's data. Always call the appropriate tool(s) before answering — never guess numbers.
Answer conversationally and concisely. You're talking to a poker player, not writing a report.
Format dollars as "$X.XX", percentages as "X.X%", and keep responses under 3 sentences unless a list is clearly better.
Only discuss the authenticated user's own data.`

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.isGuest) return NextResponse.json({ error: 'Create a full account to use AI insights.' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { question } = parsed.data
  const userId = session.user.id

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question },
  ]

  // Agentic tool-use loop — max 5 iterations to prevent runaway calls
  for (let i = 0; i < 5; i++) {
    const response = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
      max_tokens: 512,
    })

    const choice = response.choices[0]
    messages.push(choice.message as Groq.Chat.Completions.ChatCompletionMessageParam)

    if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
      return NextResponse.json({ answer: choice.message.content ?? 'No answer generated.' })
    }

    const toolResults = await Promise.all(
      choice.message.tool_calls.map(async (tc) => {
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
        const result = await executeTool(tc.function.name, args, userId)
        return {
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        }
      })
    )

    messages.push(...toolResults)
  }

  return NextResponse.json({ error: 'Could not generate an answer.' }, { status: 500 })
}
