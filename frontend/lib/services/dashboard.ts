import { api } from "@/lib/api"

export interface DashboardStats {
  totals: {
    bots: number
    documents: number
    failed_documents: number
    conversations: number
    questions: number
  }
  daily: { date: string; count: number }[]
  bots: { id: number; name: string; documents: number; conversations: number; questions: number }[]
  recent: { bot_id: number; bot_name: string; question: string; created_at: string }[]
}

export async function fetchDashboard() {
  return api.get<DashboardStats>("/dashboard")
}