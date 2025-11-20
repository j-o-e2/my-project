"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, X } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

interface JobPayload {
  poster_id: string
  title: string
  description: string
  category: string
  required_skills: string[]
  budget: number
  budget_type: 'fixed' | 'hourly'
  location: string
  duration: string
  status: 'open' | 'in-progress' | 'completed' | 'closed'
}

const CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Painting",
  "Cleaning",
  "Landscaping",
  "HVAC",
  "Roofing",
  "Masonry",
  "Welding",
  "Other",
]

const COMMON_SKILLS = [
  "Plumbing",
  "Electrical Work",
  "Carpentry",
  "Painting",
  "Tile Work",
  "Drywall",
  "Flooring",
  "Roofing",
  "HVAC",
  "Welding",
  "Masonry",
  "Landscaping",
  "Cleaning",
  "Handyman",
  "Problem Solving",
]

export default function PostJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    budget: "",
    budgetType: "fixed", // This will be transformed to budget_type when sending to DB
    location: "",
    duration: "one-time"
  })

  const makePrintable = (err: any) => {
    if (!err) return "Unknown error"
    if (typeof err === "string") return err
    if (err?.message) return err.message
    try {
      const names = Object.getOwnPropertyNames(err)
      const data: Record<string, any> = {}
      names.forEach((n) => (data[n] = err[n]))
      return JSON.stringify(data)
    } catch (e) {
      return String(err)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("You must be logged in to post a job")
        router.push("/login")
        return
      }

        // Validate required fields
        if (!formData.title?.trim() || !formData.description?.trim() || !formData.category || !formData.location?.trim()) {
          setError("Please fill in all required fields")
          return
        }
      
        // Validate budget
        const budget = parseFloat(formData.budget)
        if (isNaN(budget) || budget <= 0) {
          setError("Please enter a valid budget amount greater than 0")
        return
      }

      const jobPayload: Record<string, any> = {
        poster_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        required_skills: selectedSkills,
        budget: budget,
        budget_type: formData.budgetType === 'hourly' ? 'hourly' : 'fixed', // Only 'fixed' or 'hourly' allowed
        location: formData.location.trim(),
        duration: formData.duration,
        status: "open"
        // Let the database handle created_at with its DEFAULT NOW()
      }

      const { error: insertError } = await supabase.from("jobs").insert([jobPayload])

      // Handle schema-mismatch errors (PGRST204) by retrying without the offending column.
      // Do not log the full error immediately; first check if it's a recoverable schema-mismatch.
      if (insertError) {
        const msg: string = insertError?.message || ""

        if (insertError?.code === "PGRST204" && msg.includes("required_skills")) {
          // Recoverable: DB doesn't expose required_skills. Retry without it.
          console.warn("Schema mismatch: 'required_skills' not present. Retrying insert without it.")
          const fallback = { ...jobPayload }
          delete fallback.required_skills

          // Ensure budget_type conforms to the DB check constraint (allowed: 'fixed' | 'hourly').
          // If the value is missing or invalid, prefer to set the safe default 'fixed'.
          const allowedBudgetTypes = ["fixed", "hourly"]
          if (fallback.budget_type == null || !allowedBudgetTypes.includes(String(fallback.budget_type))) {
            // Prefer letting the DB default apply by deleting the key, but set 'fixed' explicitly
            // if you want deterministic client-side behavior.
            // We'll set 'fixed' to avoid violating the check constraint when the column exists.
            fallback.budget_type = "fixed"
          }

          // Ensure budget is a finite non-negative number. If not, set to 0 to satisfy NOT NULL
          // and any check constraints that require numeric budgets.
          const parsedBudget = Number(fallback.budget)
          if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
            fallback.budget = 0
          } else {
            fallback.budget = parsedBudget
          }

          const { error: fallbackError } = await supabase.from("jobs").insert([fallback])
          if (fallbackError) {
            console.error("Fallback job insert also failed:", makePrintable(fallbackError), fallbackError)
            setError(makePrintable(fallbackError))
            return
          }

          router.push("/jobs")
          return
        }

        // Handle schema cache mismatches for ownership column names (poster_id vs client_id).
        if (insertError?.code === "PGRST204") {
          // If the server reports poster_id is missing, retry using client_id instead.
          if (msg.includes("poster_id")) {
            console.warn("Schema mismatch: 'poster_id' not present. Retrying insert with 'client_id'.")
            const fallback = { ...jobPayload }
            // move poster_id -> client_id
            if (fallback.poster_id) {
              fallback.client_id = fallback.poster_id
              delete fallback.poster_id
            }

            // sanitize budget_type and budget as in other fallback
            const allowedBudgetTypes = ["fixed", "hourly"]
            if (fallback.budget_type == null || !allowedBudgetTypes.includes(String(fallback.budget_type))) {
              fallback.budget_type = "fixed"
            }
            const parsedBudget = Number(fallback.budget)
            if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
              fallback.budget = 0
            } else {
              fallback.budget = parsedBudget
            }

            const { error: fallbackError } = await supabase.from("jobs").insert([fallback])
            if (fallbackError) {
              // If the fallback failed because the DB doesn't have `required_skills`, retry without it.
              if (fallbackError?.code === "PGRST204" && String(fallbackError.message).includes("required_skills")) {
                console.warn("Schema mismatch: 'required_skills' not present. Retrying insert without it.")
                const secondFallback = { ...fallback }
                delete secondFallback.required_skills
                const { error: secondFallbackError } = await supabase.from("jobs").insert([secondFallback])
                if (secondFallbackError) {
                  // If the DB enforces a check constraint on budget_type, retry once more without sending budget_type
                  // so the DB default can apply (and to avoid constraint mismatches between environments).
                  if (secondFallbackError?.code === "23514" && String(secondFallbackError.message).includes("jobs_budget_type_check")) {
                    console.warn("Check constraint failed for budget_type. Retrying insert without budget_type.")
                    const thirdFallback = { ...secondFallback }
                    delete thirdFallback.budget_type
                    // ensure required_skills is also removed if DB doesn't have it
                    delete thirdFallback.required_skills
                    const { error: thirdFallbackError } = await supabase.from("jobs").insert([thirdFallback])
                    if (thirdFallbackError) {
                      console.error("Third fallback job insert also failed:", makePrintable(thirdFallbackError), thirdFallbackError)
                      setError(makePrintable(thirdFallbackError))
                      return
                    }

                    router.push("/jobs")
                    return
                  }

                  console.error("Second fallback job insert also failed:", makePrintable(secondFallbackError), secondFallbackError)
                  setError(makePrintable(secondFallbackError))
                  return
                }

                router.push("/jobs")
                return
              }

              console.error("Fallback job insert also failed:", makePrintable(fallbackError), fallbackError)
              setError(makePrintable(fallbackError))
              return
            }

            router.push("/jobs")
            return
          }

          // If the server reports client_id is missing, retry using poster_id instead.
          if (msg.includes("client_id")) {
            console.warn("Schema mismatch: 'client_id' not present. Retrying insert with 'poster_id'.")
            const fallback = { ...jobPayload }
            if (fallback.client_id) {
              fallback.poster_id = fallback.client_id
              delete fallback.client_id
            }

            const allowedBudgetTypes = ["fixed", "hourly"]
            if (fallback.budget_type == null || !allowedBudgetTypes.includes(String(fallback.budget_type))) {
              fallback.budget_type = "fixed"
            }
            const parsedBudget = Number(fallback.budget)
            if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
              fallback.budget = 0
            } else {
              fallback.budget = parsedBudget
            }

            const { error: fallbackError } = await supabase.from("jobs").insert([fallback])
            if (fallbackError) {
              // If the fallback failed because the DB doesn't have `required_skills`, retry without it.
              if (fallbackError?.code === "PGRST204" && String(fallbackError.message).includes("required_skills")) {
                console.warn("Schema mismatch: 'required_skills' not present. Retrying insert without it.")
                const secondFallback = { ...fallback }
                delete secondFallback.required_skills
                const { error: secondFallbackError } = await supabase.from("jobs").insert([secondFallback])
                if (secondFallbackError) {
                  // If the DB enforces a check constraint on budget_type, retry once more without sending budget_type
                  if (secondFallbackError?.code === "23514" && String(secondFallbackError.message).includes("jobs_budget_type_check")) {
                    console.warn("Check constraint failed for budget_type. Retrying insert without budget_type.")
                    const thirdFallback = { ...secondFallback }
                    delete thirdFallback.budget_type
                    delete thirdFallback.required_skills
                    const { error: thirdFallbackError } = await supabase.from("jobs").insert([thirdFallback])
                    if (thirdFallbackError) {
                      console.error("Third fallback job insert also failed:", makePrintable(thirdFallbackError), thirdFallbackError)
                      setError(makePrintable(thirdFallbackError))
                      return
                    }

                    router.push("/jobs")
                    return
                  }

                  console.error("Second fallback job insert also failed:", makePrintable(secondFallbackError), secondFallbackError)
                  setError(makePrintable(secondFallbackError))
                  return
                }

                router.push("/jobs")
                return
              }

              console.error("Fallback job insert also failed:", makePrintable(fallbackError), fallbackError)
              setError(makePrintable(fallbackError))
              return
            }

            router.push("/jobs")
            return
          }
        }

        // Not a recoverable schema-mismatch — log and surface the readable error message.
        console.error("Job insert error:", makePrintable(insertError), insertError)
        setError(makePrintable(insertError))
        return
      }

      router.push("/jobs")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post job")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/jobs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Post a New Job</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Job Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Fix leaking kitchen faucet"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Job Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the job in detail..."
                rows={5}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Required Skills */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">Required Skills</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {COMMON_SKILLS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedSkills.includes(skill)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
              {selectedSkills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSkills.map((skill) => (
                    <div
                      key={skill}
                      className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1"
                    >
                      <span className="text-sm text-primary">{skill}</span>
                      <button
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className="text-primary hover:text-primary/80"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budget */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Budget</label>
                <input
                  type="number"
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Budget Type</label>
                <select
                  name="budgetType"
                  value={formData.budgetType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., Nairobi, Kenya"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Job Duration</label>
              <select
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="one-time">One-time</option>
                <option value="short-term">Short-term (1-3 months)</option>
                <option value="long-term">Long-term (3+ months)</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary/90">
                {loading ? "Posting..." : "Post Job"}
              </Button>
              <Link href="/jobs" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
