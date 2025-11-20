"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LogOut, Users, Briefcase, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

export default function AdminDashboard() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalJobs: 0,
    activeJobs: 0,
    totalJob_applications: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true)
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        const authUser = authData.user
        if (!authUser) {
          router.push("/login")
          return
        }

        // Fetch profile for logged-in user
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle()

        if (profileError) throw profileError

        // Only allow admin users
        if (profile?.role !== "admin") {
          router.push("/dashboard")
          return
        }

        setUserProfile(profile)

        // Fetch statistics
  const { count: usersCount } = await supabase.from("profiles").select("*", { count: "exact", head: true })
        const { count: jobsCount } = await supabase.from("jobs").select("*", { count: "exact", head: true })
        const { count: activeJobsCount } = await supabase
          .from("jobs")
          .select("*", { count: "exact", head: true })
          .eq("status", "open")
        const { count: applicationsCount } = await supabase
          .from("job_applications")
          .select("*", { count: "exact", head: true })

        setStats({
          totalUsers: usersCount || 0,
          totalJobs: jobsCount || 0,
          activeJobs: activeJobsCount || 0,
          totalJob_applications: applicationsCount || 0,
        })
      } catch (err: any) {
        console.error("Error fetching admin data:", err.message)
        setError(err.message || "Failed to fetch admin data")
      } finally {
        setLoading(false)
      }
    }

    fetchAdminData()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading admin dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-500">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Platform management and analytics</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2 bg-transparent">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalUsers}</p>
              </div>
              <Users className="w-12 h-12 text-primary/20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Jobs</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalJobs}</p>
              </div>
              <Briefcase className="w-12 h-12 text-primary/20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Jobs</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeJobs}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-600/20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">job_applications</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalJob_applications}</p>
              </div>
              <Users className="w-12 h-12 text-primary/20" />
            </div>
          </Card>
        </div>

        {/* Management Sections */}
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">User Management</h2>
            <p className="text-muted-foreground mb-4">Manage platform users, roles, and permissions</p>
            <Button variant="outline" className="w-full bg-transparent">
              Manage Users
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Job Moderation</h2>
            <p className="text-muted-foreground mb-4">Review and moderate job listings</p>
            <Button variant="outline" className="w-full bg-transparent">
              Review Jobs
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Reports</h2>
            <p className="text-muted-foreground mb-4">View complaints and feedback from users</p>
            <Button variant="outline" className="w-full bg-transparent">
              View Reports
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Analytics</h2>
            <p className="text-muted-foreground mb-4">Detailed platform analytics and insights</p>
            <Button variant="outline" className="w-full bg-transparent">
              View Analytics
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
