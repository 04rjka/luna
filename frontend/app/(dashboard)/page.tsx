"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bot as BotIcon, FileText, Loader2, MessageSquare, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardStats, fetchDashboard } from "@/lib/services/dashboard"

function StatCard({ label, value, icon: Icon }: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetchDashboard()
      .then((res) => setData(res.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
  if (failed || !data) return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Could not load the dashboard.
    </div>
  )

  const { totals, daily, bots, recent } = data

  if (totals.bots === 0) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
      <BotIcon className="h-10 w-10 text-muted-foreground" />
      <h2 className="text-lg font-medium">Welcome! Create your first bot</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        Upload your documents, then embed the bot on your website as a helper.
      </p>
      <Button nativeButton={false} render={<Link href="/bots/new" />}>Create a bot</Button>
    </div>
  )

  const max = Math.max(...daily.map((d) => d.count), 1)
  const weekTotal = daily.reduce((s, d) => s + d.count, 0)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto w-full max-w-4xl space-y-8 pb-10">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <Button size="sm" nativeButton={false} render={<Link href="/bots/new" />}>
            <Plus className="mr-1 h-4 w-4" /> New bot
          </Button>
        </div>

        {totals.failed_documents > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {totals.failed_documents} document{totals.failed_documents > 1 ? "s" : ""} failed to
            index. Open the bot to delete and re-upload.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Bots" value={totals.bots} icon={BotIcon} />
          <StatCard label="Documents" value={totals.documents} icon={FileText} />
          <StatCard label="Visitors' chats" value={totals.conversations} icon={Users} />
          <StatCard label="Questions asked" value={totals.questions} icon={MessageSquare} />
        </div>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Questions, last 7 days</h2>
            <span className="text-xs text-muted-foreground">{weekTotal} total</span>
          </div>
          <div className="flex h-32 items-end gap-2 rounded-lg border p-3">
            {daily.map((d) => (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-muted-foreground">{d.count || ""}</span>
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 2, opacity: d.count ? 1 : 0.2 }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Your bots</h2>
          <ul className="space-y-2">
            {bots.map((b) => (
              <li key={b.id}>
                <Link href={`/bots/${b.id}`}
                  className="flex flex-col gap-1 rounded-lg border p-3 hover:bg-muted sm:flex-row sm:items-center sm:justify-between">
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.documents} docs · {b.conversations} chats · {b.questions} questions
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Recent questions from visitors</h2>
          {recent.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No questions yet. Embed a bot on your site and they will show up here.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {recent.map((r, i) => (
                <li key={i} className="p-3">
                  <p className="text-sm">{r.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.bot_name} · {new Date(r.created_at).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}