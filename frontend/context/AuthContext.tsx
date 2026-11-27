"use client"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { clearToken } from "@/lib/api"

export function useAuth() {
  const { data, isPending } = authClient.useSession()
  const router = useRouter()
  const logout = async () => {
    await authClient.signOut()
    clearToken()
    router.push("/login")
  }
  return { user: data?.user ?? null, loading: isPending, logout }
}