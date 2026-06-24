'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type Message = { role: 'user' | 'assistant'; text: string }

const SUGGESTIONS = [
  'What\'s my all-time ROI?',
  'Which group am I most profitable in?',
  'What do I owe right now?',
  'How has my last month been?',
]

export default function AiQueryWidget() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  if (status === 'loading' || !session || session.user.isGuest) return null

  async function ask(question: string) {
    if (!question.trim() || loading) return
    setMessages((m) => [...m, { role: 'user', text: question }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json() as { answer?: string; error?: string }
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: data.answer ?? data.error ?? 'Something went wrong.' },
      ])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Network error. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div className="w-80 sm:w-96 bg-felt-900 border border-felt-600 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '70vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-felt-700 bg-felt-800">
            <div className="flex items-center gap-2">
              <span className="text-gold-400 text-lg">♠</span>
              <div>
                <p className="text-felt-100 text-sm font-semibold leading-none">Stats Assistant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="text-felt-400 hover:text-felt-100 transition-colors p-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-felt-400 text-xs text-center py-2">Ask anything about your poker stats</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)}
                    className="w-full text-left text-xs bg-felt-800 hover:bg-felt-700 border border-felt-600 hover:border-gold-500/50 text-felt-300 hover:text-gold-400 rounded-lg px-3 py-2 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-gold-400 text-felt-900 font-medium'
                      : 'bg-felt-800 border border-felt-600 text-felt-200'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-felt-800 border border-felt-600 rounded-xl px-4 py-2.5">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-felt-700 bg-felt-800">
            <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your stats..."
                disabled={loading}
                className="flex-1 bg-felt-700 border border-felt-600 rounded-lg px-3 py-2 text-sm text-felt-100 placeholder:text-felt-500 focus:outline-none focus:border-gold-500/60 disabled:opacity-50 transition-colors"
              />
              <button type="submit" disabled={loading || !input.trim()}
                className="bg-gold-400 hover:bg-gold-300 disabled:opacity-40 text-felt-900 rounded-lg px-3 py-2 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={() => setOpen((o) => !o)}
        className="w-13 h-13 bg-gold-400 hover:bg-gold-300 text-felt-900 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        style={{ width: 52, height: 52 }}
        aria-label="Open AI stats assistant">
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </button>
    </div>
  )
}
