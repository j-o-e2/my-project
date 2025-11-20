import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // Handle cookie setting errors
            }
          },
        },
      },
    )

    // Defensive: check for duplicates and use maybeSingle
    const { count, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("email", email)

    if (countError) {
      console.error("[v0] Error counting profiles by email", email, countError)
    } else if (typeof count === "number" && count > 1) {
      console.warn("[v0] Duplicate profiles found for email", email, "count=", count)
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Email not found in our system" }, { status: 404 })
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/forgot-password/reset`,
    })

    if (resetError) {
      console.error("[v0] Password reset error:", resetError)
      return NextResponse.json({ error: "Failed to send reset email" }, { status: 400 })
    }

    return NextResponse.json({ message: "Password reset email sent successfully" }, { status: 200 })
  } catch (error) {
    console.error("[v0] Forgot password API error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
