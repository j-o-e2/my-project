"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import ReviewModal from "@/components/ui/review-modal"
import { Card } from "@/components/ui/card"
import { LogOut, MapPin, Bell, User, Plus, Pencil } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import ConfirmModal from '@/components/ui/confirm-modal'
import { updateJobStatus } from '@/lib/job-utils'
import { canTransitionJobStatus, getJobStatusColor, type JobStatus } from '@/lib/job-types'
import { Input } from "@/components/ui/input"


interface Job {
  id: string
  title: string
  location: string
  budget: number
  duration: string
  category: string
  client_id?: string
  status: string  // Make status required
}

interface Application {
  id: string
  job_id: string
  status: string
  proposed_rate: number
  jobs?: Job
  client_contact_revealed?: boolean
}

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  client_id?: string
  booking_id?: string
  job_id?: string
  profiles: {
    full_name: string
    avatar_url: string | null
  }
}

interface Service {
  id: string
  name: string
  description: string
  price: number
  duration: string
  provider_id: string
  location?: string
  status?: string
}

interface Booking {
  id: string
  service_id: string
  booking_date: string
  status: string
  notes?: string
  client_id: string
  profiles: {
    full_name: string
    avatar_url: string | null
    email: string
  }
  services: {
    name: string
    price: number
    duration: string
  }
}

export default function WorkerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  const [locationFilter, setLocationFilter] = useState<string>("")
  const [job_applications, setJob_applications] = useState<Application[]>([])
  const [workerServices, setWorkerServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceBookings, setServiceBookings] = useState<Booking[]>([])
  const [recentClientBookings, setRecentClientBookings] = useState<Booking[]>([])
  const [workerReviews, setWorkerReviews] = useState<Review[]>([])
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewContext, setReviewContext] = useState<{
    type: 'booking' | 'job'
    id: string
    client_id?: string
  } | null>(null)
  const [reviewedBookingIdsWorker, setReviewedBookingIdsWorker] = useState(() => new Set<string>())
  const [reviewedJobIdsWorker, setReviewedJobIdsWorker] = useState(() => new Set<string>())
  const [confirm, setConfirm] = useState<{
    jobId: string
    newStatus: JobStatus
    title?: string
    message?: string
  } | null>(null)

  const makePrintable = (err: any) => {
    if (!err) return 'Unknown error'
    if (typeof err === 'string') return err
    if (err?.message) return err.message
    try {
      const names = Object.getOwnPropertyNames(err)
      const data: Record<string, any> = {}
      names.forEach((n) => (data[n] = err[n]))
      return JSON.stringify(data)
    } catch {
      return String(err)
    }
  }
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Get authenticated user
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          router.push("/login")
          return
        }

        setUser(authUser)

        // Fetch user profile from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle()

        if (profileError) {
          console.error("Profile fetch error:", profileError)
          console.log("Auth user ID:", authUser.id)
        } else {
          setProfile(profileData || null)
        }

        // Fetch available jobs (all open jobs)
        const { data: jobsData, error: jobsError } = await supabase
          .from("jobs")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })

        if (jobsError) {
          console.error("Error fetching open jobs:", jobsError)
        } else {
          setAvailableJobs(jobsData || [])
        }

        // Fetch user's job_applications from job_applications table
        const { data: applicationsData } = await supabase
          .from("job_applications")
          .select("*, jobs(*)")
          .eq("provider_id", authUser.id)
          .order("created_at", { ascending: false })

          setJob_applications(applicationsData || [])

        // Fetch worker's services (include status & location)
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('provider_id', authUser.id)
          .order('created_at', { ascending: false })

        if (servicesError) {
          console.error('Error fetching services:', servicesError)
        } else {
          setWorkerServices(servicesData || [])
          // Fetch bookings for these services
          await fetchBookings(servicesData || [])
          
          // Fetch reviews for this worker
          const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            .select(`
              *,
              profiles:client_id (
                full_name,
                avatar_url
              )
            `)
            .eq('provider_id', authUser.id)
            .order('created_at', { ascending: false })

          if (reviewsError) {
            console.error('Error fetching reviews:', makePrintable(reviewsError))
          } else {
            setWorkerReviews(reviewsData || [])
            // Create Sets from the review data
            const bookingIds = new Set((reviewsData || [])
              .filter(r => r.booking_id)
              .map(r => r.booking_id))
            const jobIds = new Set((reviewsData || [])
              .filter(r => r.job_id)
              .map(r => r.job_id))
            
            setReviewedBookingIdsWorker(() => new Set(bookingIds))
            setReviewedJobIdsWorker(() => new Set(jobIds))
          }
        }
      } catch (err) {
        console.error("[v0] Error fetching dashboard data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()

    // Realtime subscriptions for jobs and bookings
    let sub: any = null
    const handleNewOrUpdatedJob = (job: Job) => {
      if (!job) return
      // Only consider open jobs
      if ((job as any).status !== "open") return
      setAvailableJobs((prev) => {
        const exists = prev.find((j) => j.id === job.id)
        if (exists) {
          return prev.map((j) => (j.id === job.id ? { ...j, ...job } : j))
        }
        return [job, ...prev]
      })
    }

    const handleBookingChange = async (payload: any) => {
      try {
        const booking = payload.new
        if (!booking) return

        // Fetch related profile and service data
        const [{ data: profileData }, { data: serviceData }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url, email').eq('id', booking.client_id),
          supabase.from('services').select('id, provider_id, name, price, duration').eq('id', booking.service_id)
        ])

        const enrichedBooking = {
          ...booking,
          profiles: (profileData || [])[0] || null,
          services: (serviceData || [])[0] || null
        }

        // Update recent bookings list
        setRecentClientBookings(prev => {
          const exists = prev.find(b => b.id === booking.id)
          if (exists) {
            return prev.map(b => b.id === booking.id ? enrichedBooking : b)
          }
          return [enrichedBooking, ...prev.slice(0, 9)] // Keep last 10
        })

        // Also update service bookings if the service belongs to this worker
        const serviceRow = (serviceData || [])[0] || null
        if (serviceRow && serviceRow.provider_id === user?.id) {
          setServiceBookings(prev => {
            const exists = prev.find(b => b.id === booking.id)
            if (exists) {
              return prev.map(b => b.id === booking.id ? enrichedBooking : b)
            }
            return [enrichedBooking, ...prev]
          })
        }
      } catch (err) {
        console.error('Error handling booking change:', err)
      }
    }

    // Feature-detect newer channel API vs older from().on() subscription
    try {
      if ((supabase as any).channel) {
        // Subscribe to jobs changes
        const jobsSub = (supabase as any)
          .channel("public:jobs")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs" }, (payload: any) => {
            handleNewOrUpdatedJob(payload.new)
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs" }, (payload: any) => {
            handleNewOrUpdatedJob(payload.new)
          })
          .subscribe()

        // Subscribe to all booking changes for real-time updates
        const bookingsSub = (supabase as any)
          .channel("public:bookings")
          .on("postgres_changes", 
            { event: "*", schema: "public", table: "bookings" },
            async (payload: any) => {
              try {
                // Handle all booking changes
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  const bookingRow = payload.new;
                  await handleBookingChange(payload);

                  // Also update service-specific bookings if applicable
                  const myServiceIds = workerServices.map((s: Service) => s.id);
                  if (bookingRow && myServiceIds.includes(bookingRow.service_id)) {
                    const [profileRes, serviceRes] = await Promise.all([
                      supabase.from('profiles').select('id, full_name, avatar_url, email').eq('id', bookingRow.client_id),
                      supabase.from('services').select('id, provider_id, name, price, duration').eq('id', bookingRow.service_id),
                    ]);

                    const profileRow = profileRes?.data?.[0] ?? null;
                    const serviceRow = serviceRes?.data?.[0] ?? null;

                    // If service belongs to this worker, update service bookings
                    if (serviceRow && serviceRow.provider_id === user?.id) {
                      const enrichedBooking = {
                        ...bookingRow,
                        profiles: profileRow || null,
                        services: serviceRow || null,
                      };

                      setServiceBookings((current) =>
                        current.some((b) => b.id === enrichedBooking.id)
                          ? current.map((b) => (b.id === enrichedBooking.id ? enrichedBooking : b))
                          : [enrichedBooking, ...current]
                      );
                    }
                  }
                } else if (payload.eventType === 'DELETE') {
                  setServiceBookings((current) => current.filter((b) => b.id !== payload.old.id));
                  setRecentClientBookings((current) => current.filter((b) => b.id !== payload.old.id));
                }
              } catch (e) {
                console.error('Error handling booking realtime payload:', makePrintable(e));
              }
            }
          )
          .subscribe()

        sub = { jobsSub, bookingsSub }
      } else if ((supabase as any).from) {
        // older API
        const insertSub = (supabase as any)
          .from("jobs")
          .on("INSERT", (payload: any) => {
            handleNewOrUpdatedJob(payload.new)
          })
          .subscribe()

        const updateSub = (supabase as any)
          .from("jobs")
          .on("UPDATE", (payload: any) => {
            handleNewOrUpdatedJob(payload.new)
          })
          .subscribe()

        sub = { insertSub, updateSub }
      }
    } catch (e) {
      console.warn("Realtime subscription failed:", e)
    }

    return () => {
      // cleanup realtime subscriptions
      try {
        if (!sub) return
        if ((supabase as any).channel && sub.unsubscribe) {
          sub.unsubscribe()
        } else if (sub.insertSub || sub.updateSub) {
          sub.insertSub.unsubscribe()
          sub.updateSub.unsubscribe()
        }
      } catch (e) {
        console.warn("Error unsubscribing realtime:", e)
      }
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleEditService = (service: Service) => {
    router.push(`/services/offer?edit=${service.id}`)
  }

  const applyToJob = async (jobId: string) => {
    try {
      // quick prompt for proposed rate
      const rateStr = window.prompt('Enter your proposed rate (KES):')
      if (!rateStr) return
      const proposed_rate = Number(rateStr.replace(/[^0-9.]/g, ''))
      if (Number.isNaN(proposed_rate) || proposed_rate <= 0) {
        alert('Please enter a valid positive number for the rate')
        return
      }

      const provider_id = user?.id
      if (!provider_id) {
        alert('You must be logged in to apply')
        return
      }

      const { data, error } = await supabase
        .from('job_applications')
        .insert({ job_id: jobId, provider_id, proposed_rate, status: 'pending' })
        .select()
        .single()

      if (error) {
        console.error('Error applying to job:', makePrintable(error))
        alert('Failed to apply to job: ' + (error.message || 'Unknown error'))
        return
      }

      // Add to local list
      setJob_applications((prev) => [data, ...prev])
      alert('Application submitted')
    } catch (err) {
      console.error('Error in applyToJob:', err)
      alert('An unexpected error occurred')
    }
  }

    const handleToggleServiceStatus = async (serviceId: string, isOpen: boolean) => {
      try {
        const newStatus = isOpen ? 'open' : 'closed';
        const { data, error } = await supabase
          .from('services')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', serviceId)
          .eq('provider_id', user?.id)
          .select('*')
          .single();

        if (error) {
          console.error('Error toggling service status:', makePrintable(error));
          alert(`Failed to update service status: ${error.message || String(error)}`);
          return;
        }

        if (data) {
          setWorkerServices((prev) => prev.map((service) => (service.id === serviceId ? { ...service, status: newStatus } : service)));
          alert(`Service ${newStatus} successfully`);
        }
      } catch (err: any) {
        console.error('Error toggling service:', err?.message || err);
        alert('An unexpected error occurred while updating service status');
      }
    };

    const fetchBookings = async (services: Service[]) => {
      if (!services.length) return;

      const serviceIds = services.map((s) => s.id);
      try {
        // Fetch bookings for worker's services with joined profile/service data
        console.log('Debug: fetching bookings, user id =', user?.id, 'serviceIds =', serviceIds);
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,
            profiles:client_id (
              id,
              full_name,
              avatar_url,
              email
            ),
            services (
              id,
              provider_id,
              name,
              price,
              duration
            )
          `)
          .in('service_id', serviceIds)
          .order('booking_date', { ascending: false });

        if (bookingsError) {
          console.error('Error fetching bookings:', makePrintable(bookingsError));
          return;
        }

        let allBookings = bookingsData || [];

        // If the batched .in() returned nothing, try per-service fetch to help debugging (RLS may block batched query)
        if ((!allBookings || allBookings.length === 0) && serviceIds.length > 0) {
          console.warn('Batched fetch returned no bookings — trying per-service fetch as fallback for debugging');
          const perServiceResults = await Promise.all(
            serviceIds.map((sid) =>
              supabase
                .from('bookings')
                .select(`
                  *,
                  profiles:client_id (
                    id,
                    full_name,
                    avatar_url,
                    email
                  ),
                  services (
                    id,
                    provider_id,
                    name,
                    price,
                    duration
                  )
                `)
                .eq('service_id', sid)
                .order('booking_date', { ascending: false })
                .then((r) => ({ sid, ...r }))
            )
          );

          perServiceResults.forEach((r: any) => {
            if (r.error) {
              console.warn('Per-service fetch error for', r.sid, makePrintable(r.error));
            } else if (r.data && r.data.length) {
              allBookings = allBookings.concat(r.data);
            }
          });
        }

        if (allBookings && allBookings.length) {
          const filtered = allBookings.filter((b: any) =>
            b.services && services.some((s) => s.id === b.services.id)
          );

          setServiceBookings(filtered);

          const recentBookings = [...filtered]
            .sort((a: any, b: any) => new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime())
            .slice(0, 10);

          setRecentClientBookings(recentBookings);
        } else {
          console.info('No bookings found for services:', serviceIds);
        }
      } catch (err) {
        console.error('Error fetching bookings:', makePrintable(err));
      }
    };

    const handleApproveBooking = async (bookingId: string) => {
      try {
        const res = await fetch('/api/bookings/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        });

        const updated = await res.json();

        if (!res.ok) {
          const errorMessage = updated?.error 
            ? `${updated.error}${updated.details ? `: ${updated.details}` : ''}`
            : 'Unknown error';
          console.error('Failed to approve booking:', errorMessage);
          alert(`Failed to approve booking: ${errorMessage}`);
          return;
        }

        setServiceBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
        setRecentClientBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

        alert('Booking approved successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('Error approving booking:', err);
        alert(`Failed to approve booking: ${errorMessage}`);
      }
    };

  const handleApproveService = async (serviceId: string) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .update({ status: 'approved' })
        .eq('id', serviceId)

      if (error) {
        alert('Failed to approve service: ' + error.message)
        return
      }

      // update local state
      setWorkerServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, status: 'approved' } : s)))
      alert('Service approved successfully')
    } catch (err) {
      console.error('Error approving service:', err)
      alert('An unexpected error occurred')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {profile?.full_name || "Worker"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your services and monitor bookings
            </p>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="flex justify-end max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 mb-4">
        <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2 bg-transparent">
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>

      {/* Service Status Controls */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">My Services Status</h2>
            <Link href="/services/offer">
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Add New Service
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workerServices?.map((service) => (
              <Card key={service.id} className="p-4 bg-card/50">
                <div className="flex flex-col space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        KES {service.price.toLocaleString()} • {service.duration}
                      </p>
                      {service.location && (
                        <p className="text-sm text-muted-foreground flex items-center mt-1">
                          <MapPin className="w-4 h-4 mr-1" />
                          {service.location}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      service.status === 'open' 
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {service.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleToggleServiceStatus(service.id, service.status === 'closed')}
                      variant={service.status === 'open' ? 'destructive' : 'default'}
                      className="flex-1"
                    >
                      {service.status === 'open' ? 'Close Service' : 'Open Service'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/services/offer?edit=${service.id}`)}
                      className="px-3"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Available Jobs */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-foreground">Available Jobs</h2>
                    <Input
                      placeholder="Filter by location"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter((e.target as HTMLInputElement).value)}
                      className="w-64"
                    />

                              {/* Review modal (worker) - was imported but not rendered previously */}
                              <ReviewModal
                                open={reviewModalOpen}
                                title={reviewContext?.type === 'booking' ? 'Review Client' : 'Review Job'}
                                revieweeId={reviewContext?.client_id || ''}
                                onClose={() => setReviewModalOpen(false)}
                                onSubmit={async ({ rating, comment, revieweeId }) => {
                                  try {
                                    if (!reviewContext) return;
                                    if (!revieweeId) {
                                      throw new Error('revieweeId is required');
                                    }
                                    const payload: any = { rating, comment, revieweeId };
                                    if (reviewContext.type === 'booking') {
                                      payload.booking_id = reviewContext.id;
                                      payload.client_id = reviewContext.client_id;
                                    } else {
                                      payload.job_id = reviewContext.id;
                                    }

                                    // Attach access token if available so server can authenticate when cookies aren't present
                                    const { data: { session } = {} as any } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
                                    const token = session?.access_token || (session as any)?.accessToken || null;
                                    if (token) payload.accessToken = token;

                                    const res = await fetch('/api/reviews', {
                                      method: 'POST',
                                      credentials: 'include',
                                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                      body: JSON.stringify(payload),
                                    });
                                    console.log('[DEBUG SEND /api/reviews] worker payload:', payload, 'hasToken:', !!token)

                                    if (!res.ok) {
                                      const err = await res.json().catch(() => ({}));
                                      throw new Error(err.error || 'Failed to submit review');
                                    }

                                    const created = await res.json();

                                    // Update local reviewed sets so the button disappears
                                    if (reviewContext.type === 'booking') {
                                      setReviewedBookingIdsWorker((prev) => new Set(prev).add(String(reviewContext.id)));
                                    } else {
                                      setReviewedJobIdsWorker((prev) => new Set(prev).add(String(reviewContext.id)));
                                    }

                                    // Optionally refresh reviews list
                                    setWorkerReviews((prev) => [created, ...prev]);
                                  } catch (e) {
                                    console.error('Failed to submit review from worker dashboard', e);
                                    throw e;
                                  }
                                }}
                              />
                  </div>
                <Link href="/jobs">
                  <Button variant="outline">View All</Button>
                </Link>
              </div>
              <div className="space-y-3">
                {availableJobs.filter(j => !locationFilter || j.location.toLowerCase().includes(locationFilter.toLowerCase())).length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-muted-foreground">No jobs available at the moment</p>
                  </Card>
                ) : (
                  availableJobs
                    .filter((j) => !locationFilter || j.location.toLowerCase().includes(locationFilter.toLowerCase()))
                    .map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}>
                      <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer bg-card/50 backdrop-blur-sm border-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{job.title}</h3>
                            <p className="text-sm text-muted-foreground">{job.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">KES {job.budget.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{job.duration}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location}
                          </div>
                          <div className="ml-auto">
                            {job_applications.some((a) => a.job_id === job.id) ? (
                              <Button size="sm" variant="outline" disabled>Applied</Button>
                            ) : (
                              <Button size="sm" onClick={(e) => { e.preventDefault(); applyToJob(job.id) }}>Apply</Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* My job_applications */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">My job_applications</h2>
              <div className="space-y-3">
                {job_applications.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-muted-foreground">You haven't applied for any jobs yet</p>
                  </Card>
                ) : (
                  job_applications.map((app) => (
                    <Card key={app.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{app.jobs?.title}</h3>
                            <p className="text-sm text-muted-foreground">Proposed Rate: KES {app.proposed_rate}</p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                app.status === "accepted"
                                  ? "bg-green-100 text-green-700"
                                  : app.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                            </span>
                          </div>
                        </div>

                        {/* Buttons for accepted applications: complete + review */}
                        <div className="mt-3 flex flex-col gap-2">
                          {app.status === 'accepted' && app.jobs?.status === 'open' && (
                            <Button
                              onClick={() => setConfirm({ jobId: app.job_id, newStatus: 'completed', title: 'Complete Job', message: 'Mark this job as completed? This will allow reviews.' })}
                              size="sm"
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Mark Job as Completed
                            </Button>
                          )}

                          {app.status === 'accepted' && !app.client_contact_revealed && (
                            <Button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/job-applications/${app.id}/reveal`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                                  const json = await res.json()
                                  if (!res.ok) {
                                    alert('Failed to reveal contact: ' + (json?.error || 'Unknown'))
                                    return
                                  }
                                  // update local application to mark revealed
                                  setJob_applications(prev => prev.map(p => p.id === app.id ? { ...p, client_contact_revealed: true } : p))
                                  alert('Poster contact revealed')
                                } catch (e) {
                                  console.error('Reveal contact failed', e)
                                  alert('Failed to reveal contact')
                                }
                              }}
                              size="sm"
                              className="w-full bg-primary text-white"
                            >
                              View Poster Details
                            </Button>
                          )}

                          {app.status === 'accepted' && app.jobs?.status === 'completed' && !reviewedJobIdsWorker.has(app.job_id) && (
                            <Button
                              onClick={() => {
                                setReviewContext({ type: 'job', id: app.job_id, client_id: app.jobs?.client_id })
                                setReviewModalOpen(true)
                              }}
                              size="sm"
                              className="w-full bg-primary hover:bg-primary/90 text-white"
                            >
                              Review Client
                            </Button>
                          )}
                        </div>
                      </Card>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Profile Card */}
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-0">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{profile?.full_name || "No Name"}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email || user?.email}</p>
                </div>
              </div>
              <Link href="/profile?edit=1">
                <Button variant="outline" className="w-full bg-transparent">
                  Edit Profile
                </Button>
              </Link>
            </Card>

            {/* My Services */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">My Services</h3>
                <Button
                  variant="outline"
                  className="text-sm"
                  onClick={() => router.push('/services/offer')}
                >
                  Offer New Service
                </Button>
              </div>
              <div className="space-y-3">
                {workerServices?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No services offered yet</p>
                ) : (
                  workerServices?.map((service) => (
                    <div key={service.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">KES {service.price} • {service.location || 'No location'}</p>
                        <p className="text-xs mt-1">Status: <strong>{service.status || 'pending'}</strong></p>
                      </div>
                      <div className="flex gap-2">
                        {service.status === 'pending' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleApproveService(service.id)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditService(service)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Service Bookings */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Recent Bookings</h3>
              </div>
              <div className="space-y-4">
                {serviceBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings yet</p>
                ) : (
                  serviceBookings.map((booking) => (
                    <div key={booking.id} className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                            {/* Only reveal client identity after the worker approves the booking */}
                            {booking.status === 'approved' ? (
                              booking.profiles.avatar_url ? (
                                <img
                                  src={booking.profiles.avatar_url}
                                  alt={booking.profiles.full_name}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-primary" />
                              )
                            ) : (
                              <span className="text-sm text-primary">?</span>
                            )}
                          </div>
                          <div>
                            {booking.status === 'approved' ? (
                              <>
                                <p className="font-medium text-foreground">{booking.profiles.full_name}</p>
                                <p className="text-xs text-muted-foreground">{booking.profiles.email}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-foreground">Client details hidden</p>
                                <p className="text-xs text-muted-foreground">You will see the client's contact info after approving the booking.</p>
                              </>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          booking.status === 'approved' 
                            ? 'bg-green-500/20 text-green-400'
                            : booking.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{booking.services.name}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Date:</span>
                          <span className="text-foreground">{new Date(booking.booking_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Price:</span>
                          <span className="text-foreground">KES {booking.services.price.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="text-foreground">{booking.services.duration}</span>
                        </div>
                      </div>

                      {booking.notes && (
                        <p className="text-sm text-muted-foreground italic">
                          "{booking.notes}"
                        </p>
                      )}

                      {booking.status === 'pending' && (
                        <Button
                          onClick={() => handleApproveBooking(booking.id)}
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                        >
                          Approve Booking
                        </Button>
                      )}

                      {booking.status === 'approved' && (
                        <Button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/bookings/complete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bookingId: booking.id }),
                              });
                              
                              if (!res.ok) {
                                const error = await res.json();
                                throw new Error(error.error || 'Failed to complete booking');
                              }
                              
                              const updated = await res.json();
                              setServiceBookings(prev => prev.map(b => b.id === booking.id ? updated : b));
                              alert('Booking marked as completed. You can now submit a review!');
                            } catch (err) {
                              console.error('Error completing booking:', err);
                              alert('Failed to complete booking: ' + (err instanceof Error ? err.message : String(err)));
                            }
                          }}
                          size="sm"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
                        >
                          Mark as Completed
                        </Button>
                      )}

                      {booking.status === 'completed' && !reviewedBookingIdsWorker.has(booking.id) && (
                        <Button
                          onClick={() => {
                            setReviewContext({ type: 'booking', id: booking.id, client_id: booking.client_id })
                            setReviewModalOpen(true)
                          }}
                          size="sm"
                          className="w-full bg-primary hover:bg-primary/90 text-white mt-2"
                        >
                          Review Client
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Reviews Section */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Recent Reviews</h3>
              <div className="space-y-4">
                {workerReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviews yet</p>
                ) : (
                  workerReviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center overflow-hidden">
                          {review.profiles.avatar_url ? (
                            <img
                              src={review.profiles.avatar_url}
                              alt={review.profiles.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm text-primary">
                              {review.profiles.full_name[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{review.profiles.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating ? 'text-yellow-400' : 'text-white/20'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <p className="text-sm">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Confirm modal for job actions */}
            {/* ...existing code for confirm modal should be here, not the review modal... */}

            {/* Quick Stats */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total job_applications</span>
                  <span className="font-bold text-foreground">{job_applications.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Accepted</span>
                  <span className="font-bold text-green-600">
                    {job_applications.filter((a) => a.status === "accepted").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <span className="font-bold text-yellow-600">
                    {job_applications.filter((a) => a.status === "pending").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Services Offered</span>
                  <span className="font-bold text-primary">
                    {workerServices?.length || 0}
                  </span>
                </div>
                <div className="pt-2 mt-2 border-t border-border">
                  <span className="text-sm font-medium text-foreground">Bookings</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-bold text-foreground">{serviceBookings.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Approved</span>
                    <span className="font-bold text-green-600">
                      {serviceBookings.filter(b => b.status === 'approved').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className="font-bold text-yellow-600">
                      {serviceBookings.filter(b => b.status === 'pending').length}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Notifications */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Notifications</h3>
              </div>
              <p className="text-sm text-muted-foreground">No new notifications</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
