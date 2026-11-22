import { api } from "@/lib/api";

export interface Bot {
    id: number;
    owner_id: number;
    name: string;
    greeting: string;
    theme: { color?: string };
    public_key: string;
    system_prompt: string | null;
    allowed_origins: string[];
    created_at: string;
}

export type BotInput = {
    name: string
    greeting?: string
    system_prompt?: string | null
    theme?: { color?: string }
    allowed_origins?: string[]
}

export interface BotDocument {
  id: number
  filename: string
  status: "processing" | "ready" | "failed"
  created_at: string
}

export async function fetchBots() {
    return api.get<Bot[]>("/bots")
}

export async function fetchBot(id: number) { 
    return api.get<Bot>(`/bots/${id}`) 
}

export async function createBot(data: BotInput) { 
    return api.post<Bot>("/bots", data) 
}

export async function updateBot(id: number, data: Partial<BotInput>) { 
    return api.patch<Bot>(`/bots/${id}`, data) 
}

export async function deleteBot(id: number) { 
    return api.delete(`/bots/${id}`) 
}

export async function fetchBotDocuments(id: number) {
  return api.get<BotDocument[]>(`/bots/${id}/documents`)
}

export async function uploadBotDocument(id: number, file: File) {
  const form = new FormData()
  form.append("file", file)
  return api.post<BotDocument>(`/bots/${id}/documents`, form, {
    headers: { "Content-Type": undefined },
  })
}

export async function deleteDocument(documentId: number) {
  return api.delete(`/documents/${documentId}`)
}