import { AuthProvider } from "@/context/AuthContext"
import { Sidebar1 } from "@/components/sidebar1"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthProvider><Sidebar1>{children}</Sidebar1></AuthProvider>
}