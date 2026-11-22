"use client"
import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatMessage } from "@/components/chat-message"   // adjust path
import { ChatInput } from "@/components/chat-input"       // adjust path
import type { Message } from "@/lib/services/chat"
import { askPublic, fetchConfig, fetchHistory, getVisitorId, PublicConfig } from "@/lib/services/public-chat"

export default function EmbedPage() {
  const { key } = useParams<{ key: string }>()
  const [cfg, setCfg] = useState<PublicConfig | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const vid = getVisitorId()
    Promise.all([fetchConfig(key), fetchHistory(key, vid)])
      .then(([c, history]) => {
        setCfg(c)
        const restored: Message[] = history.map((m, i) => ({ id: i + 1, role: m.role, content: m.content, created_at: "" }))
        setMessages(restored.length ? restored : [{ id: 0, role: "assistant", content: c.greeting, created_at: "" }])
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [key])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function handleSend(question: string) {
    const now = Date.now()
    setMessages(p => [...p,
      { id: now, role: "user", content: question, created_at: "" },
      { id: now + 1, role: "assistant", content: "", created_at: "" }])
    setSending(true)
    await askPublic(key, getVisitorId(), question, (token) =>
      setMessages(p => {
        const u = [...p]
        u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + token }
        return u
      }))
    setSending(false)
  }

  const closeWidget = () => window.parent.postMessage({ type: "paperchat:close" }, "*")

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (failed || !cfg) return <div className="flex h-screen items-center justify-center p-4 text-sm text-muted-foreground">Chat unavailable.</div>

  return (
    <div className="flex h-screen flex-col bg-background"
         style={cfg.theme?.color ? ({ "--primary": cfg.theme.color } as React.CSSProperties) : undefined}>
      <div className="flex h-12 items-center justify-between border-b bg-primary px-3 text-primary-foreground">
        <h2 className="truncate text-sm font-medium">{cfg.name}</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={closeWidget} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-3">
        {messages.map(m => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        {sending && <div className="px-1 text-sm text-muted-foreground">Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <ChatInput onSend={handleSend} disabled={sending} />
      </div>
    </div>
  )
}