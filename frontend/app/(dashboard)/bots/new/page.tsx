"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createBot } from "@/lib/services/bots"

const ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/

function parseOrigins(text: string) {
  return text.split("\n").map((l) => l.trim().replace(/\/+$/, "")).filter(Boolean)
}

function errorMessage(err: any): string {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return "Could not create the bot. Please try again."
}

export default function NewBotPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [greeting, setGreeting] = useState("Hi! How can I help?")
  const [prompt, setPrompt] = useState("")
  const [color, setColor] = useState("#2563eb")
  const [origins, setOrigins] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const list = parseOrigins(origins)
    const bad = list.find((o) => !ORIGIN_RE.test(o))
    if (bad) {
      setError(`"${bad}" is not valid. Use the form https://example.com (no path).`)
      return
    }

    setSaving(true)
    try {
      const res = await createBot({
        name: name.trim(),
        greeting: greeting.trim() || undefined,
        system_prompt: prompt.trim() || null,
        theme: { color },
        allowed_origins: list,
      })
      router.push(`/bots/${res.data.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Create a bot</h1>
          <p className="text-sm text-muted-foreground">
            You can upload documents and get the embed code after creating it.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Support helper" maxLength={100} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="greeting">Greeting message</Label>
          <Input id="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)}
            maxLength={300} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Instructions (optional)</Label>
          <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. You are the assistant for Acme Store. Keep answers short and friendly."
            rows={4} maxLength={2000} />
          <p className="text-xs text-muted-foreground">
            Visitors can sometimes trick a bot into revealing this, so don't put secrets here.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Theme color</Label>
          <div className="flex items-center gap-3">
            <input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1" />
            <span className="text-sm text-muted-foreground">{color}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="origins">Websites allowed to embed this bot</Label>
          <Textarea id="origins" value={origins} onChange={(e) => setOrigins(e.target.value)}
            placeholder={"https://mysite.com\nhttp://localhost:5500"} rows={3} />
          <p className="text-xs text-muted-foreground">
            One per line. Include https:// and no path. You can change these later.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create bot
          </Button>
          <Button type="button" variant="outline" nativeButton={false} render={<Link href="/bots" />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}