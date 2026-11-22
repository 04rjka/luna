const BASE = "/api/v1/public/bots"

export type PublicConfig = {
  name: string
  greeting: string
  theme: { color?: string }
}

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem("pc_visitor")
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem("pc_visitor", id)
    }
    return id
  } catch {
    return crypto.randomUUID() // storage blocked: chat works, history won't persist
  }
}

export async function fetchConfig(key: string): Promise<PublicConfig> {
  const r = await fetch(`${BASE}/${key}/config`)
  if (!r.ok) throw new Error("not found")
  return r.json()
}

export async function fetchHistory(key: string, visitorId: string) {
  const r = await fetch(`${BASE}/${key}/history?visitor_id=${visitorId}`)
  if (!r.ok) return [] as { role: "user" | "assistant"; content: string }[]
  return (await r.json()).messages
}

export async function askPublic(
  key: string, visitorId: string, message: string,
  onToken: (t: string) => void,
) {
  const res = await fetch(`${BASE}/${key}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, visitor_id: visitorId }),
  })
  if (res.status === 429) return onToken("You're sending messages too fast. Please wait a moment.")
  if (!res.ok || !res.body) return onToken("Something went wrong. Please try again.")

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parts = buf.split("\n\n")
    buf = parts.pop()!
    for (const p of parts) {
      const data = p.replace(/^data: /, "")
      if (data === "[DONE]") return
      try {
        const j = JSON.parse(data)
        if (j.type === "token" || j.type === "error") onToken(j.content)
      } catch { /* ignore malformed chunk */ }
    }
  }
}