"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Check, Copy, FileText, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Bot, BotDocument, deleteBot, deleteDocument, fetchBot,
  fetchBotDocuments, updateBot, uploadBotDocument,
} from "@/lib/services/bots"
import { errorMessage } from "@/lib/errors"

const ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/
const MAX_MB = 10

const parseOrigins = (t: string) =>
  t.split("\n").map((l) => l.trim().replace(/\/+$/, "")).filter(Boolean)

export default function BotPage() {
  const { id } = useParams<{ id: string }>()
  const botId = Number(id)
  const router = useRouter()

  const [bot, setBot] = useState<Bot | null>(null)
  const [docs, setDocs] = useState<BotDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // settings form
  const [name, setName] = useState("")
  const [greeting, setGreeting] = useState("")
  const [prompt, setPrompt] = useState("")
  const [color, setColor] = useState("#2563eb")
  const [origins, setOrigins] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // upload + copy
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function fillForm(b: Bot) {
    setName(b.name)
    setGreeting(b.greeting ?? "")
    setPrompt(b.system_prompt ?? "")
    setColor(b.theme?.color ?? "#2563eb")
    setOrigins((b.allowed_origins ?? []).join("\n"))
  }

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetchBotDocuments(botId)
      setDocs(res.data)
    } catch { /* keep the old list */ }
  }, [botId])

  useEffect(() => {
    Promise.all([fetchBot(botId), fetchBotDocuments(botId)])
      .then(([b, d]) => { setBot(b.data); fillForm(b.data); setDocs(d.data) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [botId])

  // poll while any document is still being indexed
  const hasProcessing = docs.some((d) => d.status === "processing")
  useEffect(() => {
    if (!hasProcessing) return
    const t = setInterval(loadDocs, 3000)
    return () => clearInterval(t)
  }, [hasProcessing, loadDocs])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploadError(null)
    if (file.type !== "application/pdf") return setUploadError("Only PDF files are allowed.")
    if (file.size > MAX_MB * 1024 * 1024) return setUploadError(`File is too large (max ${MAX_MB} MB).`)

    setUploading(true)
    try {
      await uploadBotDocument(botId, file)
      await loadDocs()
    } catch (err) {
      setUploadError(errorMessage(err, "Upload failed."))
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteDoc(doc: BotDocument) {
    if (!confirm(`Delete "${doc.filename}"? The bot will forget its contents.`)) return
    try {
      await deleteDocument(doc.id)
      setDocs((p) => p.filter((d) => d.id !== doc.id))
    } catch (err) {
      setUploadError(errorMessage(err, "Could not delete the document."))
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveMsg(null)
    const list = parseOrigins(origins)
    const bad = list.find((o) => !ORIGIN_RE.test(o))
    if (bad) return setSaveMsg({ ok: false, text: `"${bad}" is not valid. Use https://example.com (no path).` })

    setSaving(true)
    try {
      const res = await updateBot(botId, {
        name: name.trim(),
        greeting: greeting.trim(),
        system_prompt: prompt.trim() || null,
        theme: { color },
        allowed_origins: list,
      })
      setBot(res.data)
      setSaveMsg({ ok: true, text: "Saved." })
    } catch (err) {
      setSaveMsg({ ok: false, text: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBot() {
    if (!confirm("Delete this bot, its documents and all chats? This cannot be undone.")) return
    try {
      await deleteBot(botId)
      router.push("/bots")
    } catch (err) {
      setSaveMsg({ ok: false, text: errorMessage(err, "Could not delete the bot.") })
    }
  }

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
  if (notFound || !bot) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="text-sm text-muted-foreground">Bot not found.</p>
      <Button variant="outline" nativeButton={false} render={<Link href="/bots" />}>Back to bots</Button>
    </div>
  )

  const snippet =
    `<script src="${window.location.origin}/widget.js" data-bot="${bot.public_key}" ` +
    `data-color="${bot.theme?.color ?? "#2563eb"}" async></script>`

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked: user can select the text manually */ }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto w-full max-w-2xl space-y-8 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <Link href="/bots" className="text-xs text-muted-foreground hover:underline">← All bots</Link>
            <h1 className="truncate text-xl font-semibold">{bot.name}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleDeleteBot}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>

        {/* Embed code */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Embed code</h2>
          <p className="text-xs text-muted-foreground">
            Paste this before the closing &lt;/body&gt; tag of your website. Add the site under
            "Allowed websites" below first, or the chat will not load there.
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border bg-muted p-3 pr-12 text-xs">{snippet}</pre>
            <Button size="icon" variant="ghost" className="absolute right-1 top-1 h-8 w-8"
              onClick={copySnippet} aria-label="Copy embed code">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button variant="outline" size="sm" nativeButton={false}
            render={<a href={`/embed/${bot.public_key}`} target="_blank" rel="noreferrer" />}>
            Open chat preview
          </Button>
        </section>

        {/* Documents */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Documents</h2>
            <>
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
              <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                Upload PDF
              </Button>
            </>
          </div>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

          {docs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No documents yet. Upload a PDF so your bot has something to answer from.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.status === "processing" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Indexing
                      </span>
                    )}
                    {d.status === "ready" && <span className="text-xs text-green-600">Ready</span>}
                    {d.status === "failed" && <span className="text-xs text-destructive">Failed</span>}
                    <Button size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => handleDeleteDoc(d)} aria-label={`Delete ${d.filename}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Settings */}
        <form onSubmit={handleSave} className="space-y-4">
          <h2 className="text-sm font-medium">Settings</h2>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="greeting">Greeting message</Label>
            <Input id="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Instructions</Label>
            <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={2000} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Theme color</Label>
            <input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="origins">Allowed websites</Label>
            <Textarea id="origins" value={origins} onChange={(e) => setOrigins(e.target.value)} rows={3}
              placeholder={"https://mysite.com\nhttp://localhost:5500"} />
            <p className="text-xs text-muted-foreground">One per line. Include https:// and no path.</p>
          </div>

          {saveMsg && (
            <p className={saveMsg.ok ? "text-sm text-green-600" : "text-sm text-destructive"}>{saveMsg.text}</p>
          )}
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </form>
      </div>
    </div>
  )
}