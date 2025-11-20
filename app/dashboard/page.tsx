"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const redirectToDashboard = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/login")
          return
        }

        // Fetch user profile to get role
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError) {
          console.error("Failed to fetch user profile:", profileError)
          setError("Failed to fetch user profile")
          return
        }

        // Redirect based on role
        const role = profile?.role || "worker"
        if (role === "client") {
          router.push("/dashboard/client")
        } else if (role === "admin") {
          router.push("/dashboard/admin")
        } else {
          router.push("/dashboard/worker")
        }
      } catch (err) {
        console.error("[v0] Dashboard redirect error:", err)
        setError("An error occurred")
      } finally {
        setLoading(false)
      }
    }

    redirectToDashboard()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return null
}
