"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Mail, Lock, ArrowLeft, Github, Chrome } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import AnimatedBackground from "@/components/ui/animated-shader-background"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // roleSelection: 'auto' => use profile.role; 'worker'|'client'|'admin' => force redirect (UI-only)
  const [roleSelection, setRoleSelection] = useState<"auto" | "worker" | "client" | "admin">("auto")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      console.log("[v0] Login successful:", data)

      // ✅ Fetch user profile after successful login
      // signInWithPassword may return data.user or data.session.user depending on flow
      const authUser = data?.user ?? data?.session?.user

      if (!authUser) {
        console.warn("No authenticated user returned after sign in")
        setLoading(false)
        router.push("/dashboard")
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle()

  let resolvedRole: string | undefined = undefined

  if (profileError) {
        // Some Supabase/PostgREST error objects have non-enumerable props and
        // appear as empty objects when logged directly. Build a printable
        // representation that includes non-enumerable properties where possible.
        const makePrintable = (err: any) => {
          if (!err) return "Unknown error"
          if (typeof err === "string") return err
          if (err.message) return err.message
          try {
            const names = Object.getOwnPropertyNames(err)
            const data: Record<string, any> = {}
            names.forEach((n) => (data[n] = err[n]))
            return JSON.stringify(data)
          } catch (e) {
            return String(err)
          }
        }

        console.error("Error fetching profile:", makePrintable(profileError), profileError)

        // Optional: attempt a single fallback using the freshest auth user
        try {
          const {
            data: { user: freshUser },
          } = await supabase.auth.getUser()
          if (freshUser) {
            const { data: secondTryData, error: secondTryError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", freshUser.id)
              .maybeSingle()

            if (!secondTryError && secondTryData) {
              console.log("User profile data (second try):", secondTryData)
              resolvedRole = secondTryData.role
            } else if (secondTryError) {
              console.warn("Second attempt to fetch profile failed:", makePrintable(secondTryError))
            }
          }
        } catch (e) {
          console.warn("Profile fallback attempt failed:", e)
        }
      } else {
        console.log("User profile data:", profileData)
        resolvedRole = profileData?.role
      }

      // Decide where to redirect based on resolved role or user selection
      const effectiveRole = roleSelection !== "auto" ? roleSelection : resolvedRole || "worker"
      setLoading(false)
      if (effectiveRole === "client") {
        router.push("/dashboard/client")
      } else if (effectiveRole === "admin") {
        router.push("/dashboard/admin")
      } else {
        router.push("/dashboard/worker")
      }
    } catch (err) {
      setError("An unexpected error occurred")
      console.error("[v0] Login error:", err)
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <Card className="p-8 bg-card/80 backdrop-blur-sm border border-primary/20 shadow-lg">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to your LocalFix Kenya account</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-sm text-muted-foreground">
              <label className="block mb-2">Role (optional)</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="auto"
                    checked={roleSelection === "auto"}
                    onChange={() => setRoleSelection("auto")}
                    className="form-radio text-primary focus:ring-primary"
                  />
                  Auto (use account role)
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="worker"
                    checked={roleSelection === "worker"}
                    onChange={() => setRoleSelection("worker")}
                    className="form-radio text-primary focus:ring-primary"
                  />
                  Worker
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="client"
                    checked={roleSelection === "client"}
                    onChange={() => setRoleSelection("client")}
                    className="form-radio text-primary focus:ring-primary"
                  />
                  Client
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Selecting a role here only affects the dashboard you land on; it does not change your account role on the server.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-input/50 border-primary/30 focus:border-primary focus:ring-primary transition-all duration-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-input/50 border-primary/30 focus:border-primary focus:ring-primary transition-all duration-300"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg transform transition-transform hover:scale-105" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 space-y-4 text-center">
            <p className="text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:text-primary/80 font-medium">
                Sign up
              </Link>
            </p>
            <p className="text-muted-foreground">
              <Link href="/forgot-password" className="text-primary hover:text-primary/80 font-medium">
                Forgot password?
              </Link>
            </p>
          </div>

          <div className="mt-8 text-center">
            <div className="relative flex items-center justify-center my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <Button variant="outline" className="flex items-center gap-2 text-foreground hover:bg-primary/10 border-primary/30">
                <Chrome className="w-5 h-5" />
                Google
              </Button>
              <Button variant="outline" className="flex items-center gap-2 text-foreground hover:bg-primary/10 border-primary/30">
                <Github className="w-5 h-5" />
                GitHub
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
