"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MapPin, Briefcase, Search, Filter, Plus } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

interface Job {
  id: string
  title: string
  description: string
  category: string
  required_skills: string[]
  budget: number | null
  pay: string | null
  budget_type?: string
  poster_id?: string
  location: string
  duration: string
  status: string
  created_at: string | null
  client_id: string
  profiles?: {
    full_name: string
    avatar_url: string | null
  }
}

const CATEGORIES = [
  "All",
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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    filterJobs()
  }, [jobs, searchTerm, selectedCategory, selectedSkills])

  const fetchJobs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })

      if (error) throw error

      // Fetch poster/client profiles for each job (some DBs use `poster_id`, others `client_id`).
      const jobsWithProfiles = await Promise.all(
        (data || []).map(async (job) => {
          const ownerId = job.poster_id ?? job.client_id
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", ownerId)
            .maybeSingle()

          return {
            ...job,
            profiles: profileData || { full_name: "Anonymous", avatar_url: null },
          }
        }),
      )

      setJobs(jobsWithProfiles)
    } catch (err) {
      console.error("Error fetching jobs:", err)
    } finally {
      setLoading(false)
    }
  }

  const filterJobs = () => {
    let filtered = jobs

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter((job) => job.category === selectedCategory)
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(term) ||
          job.description.toLowerCase().includes(term) ||
          job.location.toLowerCase().includes(term),
      )
    }

    // Filter by skills
    if (selectedSkills.length > 0) {
  filtered = filtered.filter((job) => selectedSkills.some((skill) => (job.required_skills || []).includes(skill)))
    }

    setFilteredJobs(filtered)
  }

  const toggleSkillFilter = (skill: string) => {
    setSelectedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  const allSkills = Array.from(new Set(jobs.flatMap((job) => job.required_skills || []))).sort()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Available Jobs</h1>
            <p className="text-muted-foreground mt-1">Find jobs that match your skills</p>
          </div>
          <Link href="/jobs/post">
            <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Post a Job
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="space-y-4 mb-8">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search jobs by title, description, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
          >
            <Filter className="w-5 h-5" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>

          {/* Skills Filter */}
          {showFilters && allSkills.length > 0 && (
            <div className="bg-secondary/50 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-3">Filter by Skills</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {allSkills.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => toggleSkillFilter(skill)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedSkills.includes(skill)
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground border border-border hover:border-primary"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Jobs List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading jobs...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">No jobs found matching your criteria</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-1">{job.title}</h3>
                      <p className="text-muted-foreground text-sm line-clamp-2">{job.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-primary">
                        KES {job.budget ? job.budget.toLocaleString() : "0"}
                      </div>
                      <p className="text-xs text-muted-foreground">{job.budget_type === "fixed" ? "Fixed" : "Hourly"}</p>
                    </div>
                  </div>

              <div className="flex flex-wrap gap-2 mb-4">
  {job.required_skills?.slice(0, 3)?.map((skill) => (
    <span key={skill} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
      {skill}
    </span>
  ))}
  {job.required_skills && job.required_skills.length > 3 && (
    <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-full">
      +{job.required_skills.length - 3} more
    </span>
  )}
</div>



                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {job.duration}
                      </div>
                    </div>
                    <div className="text-xs bg-secondary px-2 py-1 rounded">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
