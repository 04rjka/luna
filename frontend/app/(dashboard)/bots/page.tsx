"use client"
import { fetchBots, Bot } from "@/lib/services/bots";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Bot as BotIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBots()
      .then((res) => setBots(res.data))
      .catch(() => setBots([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="flex flex-col flex-1 items-center justify-start bg-background font-sans p-3">
      {bots.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <BotIcon className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-medium">No bots yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Create a bot, upload your documents, and embed it on your website.
          </p>
          <Button nativeButton={false} render={<Link href="/bots/new" />}>Create a bot</Button>
        </div>
      ) : (
        bots.map((bot) => (
          <Link
            key={bot.id}
            href={`/bots/${bot.id}`}
            className="mb-2 flex w-full max-w-xl flex-col gap-2 rounded-lg border border-border p-3 hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{bot.name}</p>
              <p className="text-xs text-muted-foreground">
                Created {new Date(bot.created_at).toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </p>
            </div>
            <span className="text-sm text-primary whitespace-nowrap">Manage →</span>
          </Link>
        ))
      )}
    </div>
  )
}