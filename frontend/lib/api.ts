import axios, { AxiosError, InternalAxiosRequestConfig } from "axios"
import { authClient } from "@/lib/auth-client"

export const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
})

let cached: { token: string; exp: number } | null = null
let inflight: Promise<string | null> | null = null

function expOf(token: string) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(atob(b64)).exp * 1000
  } catch { return 0 }
}

export function clearToken() { cached = null }

async function getToken(force = false) {
  if (!force && cached && cached.exp - Date.now() > 30_000) return cached.token
  inflight ??= authClient.token()
    .then(({ data }) => {
      const t = data?.token ?? null
      cached = t ? { token: t, exp: expOf(t) } : null
      return t
    })
    .catch(() => { cached = null; return null })
    .finally(() => { inflight = null })
  return inflight
}

api.interceptors.request.use(async (config) => {
  const token = await getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const req = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    if (error.response?.status === 401 && req && !req._retry) {
      req._retry = true
      const token = await getToken(true)          // force a fresh JWT once
      if (token) {
        req.headers.Authorization = `Bearer ${token}`
        return api(req)
      }
      const p = window.location.pathname
      if (!p.startsWith("/login") && !p.startsWith("/signup") && !p.startsWith("/embed")) {
        window.location.href = `/login?from=${encodeURIComponent(p)}`
      }
    }
    return Promise.reject(error)
  }
)