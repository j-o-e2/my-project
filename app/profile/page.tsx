"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, User, Mail, Phone, MapPin } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import AvatarUploader from "@/components/ui/avatar-uploader"

interface Profile {
  id?: string
  full_name: string
  email: string
  phone: string
  location: string
  avatar_url?: string | null
}

export default function ProfilePage() {
  const searchParams = useSearchParams()

  const [profile, setProfile] = useState<Profile>({
    full_name: "John Doe",
    email: "john@example.com",
    phone: "+254 712 345 678",
    location: "Nairobi",
    avatar_url: null,
  })

  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If the page is opened with ?edit=1 or ?edit=true, open edit mode
    try {
      const editParam = searchParams?.get("edit")
      if (editParam === "1" || editParam === "true") {
        setEditing(true)
      }
    } catch (e) {
      // ignore in environments where navigation isn't available
    }

    async function loadProfile() {
      setLoading(true)
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) throw new Error("You must be logged in to view your profile.")

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single<Profile>()

        if (profileError) throw profileError
        if (profileData) setProfile(profileData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    })
  }

  const handleSave = async () => {
    try {
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update(profile)
        .eq("id", profile.id)
        .select()
        .single()

      if (updateError) throw updateError
      if (updated) setProfile(updated)
      alert("Profile updated successfully!")
      setEditing(false)
    } catch (err: any) {
      alert("Error updating profile: " + err.message)
    }
  }

  // Avatar upload is handled by the AvatarUploader component below.

  if (loading) return <p>Loading profile...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/services" className="flex items-center gap-2 text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to services
          </Link>
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        </div>
      </header>

      {/* Profile */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/50 shadow-md">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center">
                  <User className="w-12 h-12 text-primary-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground">{profile.full_name}</h2>
              <p className="text-muted-foreground">Member since 2024</p>
            </div>
            <div className="ml-4">
              <AvatarUploader
                userId={profile.id || ""}
                currentUrl={profile.avatar_url}
                onUpload={(url) => setProfile((p) => ({ ...p, avatar_url: url }))}
                disabled={!profile.id}
              />
              {!profile.id && (
                <p className="text-xs text-muted-foreground mt-1">Avatar upload available after profile loads</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
              <Input type="text" name="full_name" value={profile.full_name} onChange={handleChange} disabled={!editing} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  disabled={!editing}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="tel"
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  disabled={!editing}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  name="location"
                  value={profile.location}
                  onChange={handleChange}
                  disabled={!editing}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              {editing ? (
                <>
                  <Button onClick={handleSave} className="flex-1">
                    Save Changes
                  </Button>
                  <Button onClick={() => setEditing(false)} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)} className="flex-1">
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
