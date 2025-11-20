"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ReviewModal from "@/components/ui/review-modal";
import { Card } from "@/components/ui/card";
import { LogOut, Plus, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import ConfirmModal from '@/components/ui/confirm-modal';
import { updateJobStatus } from '@/lib/job-utils';
import { canTransitionJobStatus, getJobStatusColor, type JobStatus } from '@/lib/job-types';

interface JobApplication {
  id: string;
  provider_id: string;
  status: string;
  proposed_rate: number;
  provider: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    location: string;
  };
}

interface Job {
  id: string;
  title: string;
  location: string;
  budget: number;
  duration: string;
  status: string;
  created_at: string;
  client_id: string;
  job_applications: JobApplication[];
}

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: string;
  description: string;
  provider_id: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
    location: string;
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  client_id: string;
  booking_id: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface UserProfile {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
  avatar_url?: string | null;
}

interface Booking {
  id: string;
  service_id: string;
  booking_date: string;
  status: string;
  notes?: string;
  services: {
    name: string;
    price: number;
    duration: string;
    provider_id: string;
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

const ClientDashboard = () => {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<any>(null);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewContext, setReviewContext] = useState<{
    type: "booking" | "job";
    id: string;
    provider_id?: string;
  } | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [reviewedJobIds, setReviewedJobIds] = useState<Set<string>>(new Set());
  // Confirmation modal state for job actions
  const [confirm, setConfirm] = useState<{
    jobId: string;
    newStatus: JobStatus;
    title?: string;
    message?: string;
    hasAcceptedApplication?: boolean;
  } | null>(null);

  const makePrintable = (err: any) => {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err?.message) return err.message;
    try {
      const names = Object.getOwnPropertyNames(err);
      const data: Record<string, any> = {};
      names.forEach((n) => (data[n] = err[n]));
      return JSON.stringify(data);
    } catch {
      return String(err);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
        // ✅ Fetch available services
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select(`
            *,
            profiles:provider_id (
              full_name,
              avatar_url,
              location
            )
          `)
          .order('created_at', { ascending: false })
          .limit(3)

        if (servicesError) {
          console.error('Error fetching services:', makePrintable(servicesError))
          setServices([])
        } else {
          setServices(servicesData || [])
        }
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/login");
          return;
        }

        // Get session to ensure we're authenticated
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          router.push("/login");
          return;
        }

        // ✅ Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile:", makePrintable(profileError));
          setLoading(false);
          router.push("/login");
          return;
        }

        if (!profileData) {
          console.warn("No profile found for user", user.id);
          setLoading(false);
          router.push("/profile");
          return;
        }

        if (profileData.role !== "client") {
          router.push("/dashboard");
          return;
        }

        setProfile(profileData);

        // ✅ Ensure jobs are fetched for the logged-in client using the correct column name
        const { data: jobsData, error: jobsError } = await supabase
          .from("jobs")
          .select(`
            *,
            job_applications (
              id,
              status,
              proposed_rate,
              provider:profiles (
                id,
                full_name,
                avatar_url,
                location
              )
            )
          `)
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (jobsError) {
          console.error("Error fetching jobs for client dashboard:", makePrintable(jobsError));
          setMyJobs([]);
        } else {
          setMyJobs(jobsData || []);
        }

        // ✅ Fetch client's bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .eq('client_id', user.id)
          .order('booking_date', { ascending: false });

        if (bookingsError) {
          console.error('Error fetching bookings:', makePrintable(bookingsError));
        } else {
          const bookings = bookingsData || []
          if (bookings.length === 0) {
            setBookings([])
          } else {
            // fetch related services/providers in bulk
            const svcIds = Array.from(new Set(bookings.map((b: any) => b.service_id)))
            const { data: servicesData } = await supabase.from('services').select('id, provider_id, name, price, duration').in('id', svcIds)
            const providerIds = Array.from(new Set((servicesData || []).map((s: any) => s.provider_id).filter(Boolean)))
            const { data: providersData } = await supabase.from('profiles').select('id, full_name, avatar_url, location').in('id', providerIds)

            const servicesMap: Record<string, any> = {};
            (servicesData || []).forEach((s: any) => (servicesMap[s.id] = s));
            const providersMap: Record<string, any> = {};
            (providersData || []).forEach((p: any) => (providersMap[p.id] = p));

            const enriched = bookings.map((b: any) => ({
              ...b,
              services: servicesMap[b.service_id] || null,
            }))

            // attach provider profile to services
            enriched.forEach((b: any) => {
              if (b.services && providersMap[b.services.provider_id]) {
                b.services.profiles = providersMap[b.services.provider_id]
              }
            })

            setBookings(enriched)
          }
        }

        // ✅ Fetch other users
        const { data: usersData, error: usersError } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, avatar_url")
          .neq("id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (usersError) {
          console.error("Error fetching users:", makePrintable(usersError));
        } else {
          setUsers(usersData || []);
        }

        // Fetch reviews submitted by this client (so we can know which bookings/jobs they've reviewed)
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(`
            *
          `)
          .eq('client_id', user.id)
          .order('created_at', { ascending: false });

        if (reviewsError) {
          console.error('Error fetching reviews:', makePrintable(reviewsError));
          setReviews([]);
        } else {
          setReviews(reviewsData || []);
          // populate reviewed id sets
          const b = new Set<string>();
          const j = new Set<string>();
          (reviewsData || []).forEach((r: any) => {
            if (r.booking_id) b.add(r.booking_id);
            if (r.job_id) j.add(r.job_id);
          });
          setReviewedBookingIds(b);
          setReviewedJobIds(j);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", makePrintable(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  const handleApproveApplication = async (jobId: string, applicationId: string) => {
    try {
      // Use the server-side API which validates ownership and handles RLS
      console.log('Approving application:', { jobId, applicationId });
      
      // Include credentials/token so server can authenticate the client
      const { data: { session } = {} as any } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      const token = session?.access_token || (session as any)?.accessToken || null;
      const bodyPayload: any = { status: 'accepted' };
      if (token) bodyPayload.accessToken = token;

      const res = await fetch(`/api/job-applications/${applicationId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(bodyPayload)
      });

      // Parse response safely
      const raw = await res.text();
      let response: any = null;
      try { response = raw ? JSON.parse(raw) : null } catch (e) { response = raw }
      
      if (!res.ok) {
        console.error('Error approving application:', {
          status: res.status,
          statusText: res.statusText,
          response
        });
        
        // Show a more specific error message
        const errorMessage = response?.error 
          ? `${response.error}${response.details ? `: ${response.details}` : ''}`
          : 'Failed to approve application';
          
        alert(errorMessage);
        return;
      }

      if (!response || !response.id) {
        console.warn('Invalid response data:', response);
        alert('Received invalid response from server. Please refresh and try again.');
        return;
      }

      // Update local state
      setMyJobs(prev => prev.map(job => {
        if (job.id === jobId) {
          return {
            ...job,
            job_applications: job.job_applications.map(app => 
              app.id === applicationId 
                ? { ...app, status: 'accepted' }
                : { ...app, status: app.status === 'pending' ? 'rejected' : app.status }
            )
          };
        }
        return job;
      }));

      alert('Application approved successfully!');
    } catch (err) {
      console.error('Error in handleApproveApplication:', makePrintable(err), err);
      alert('An unexpected error occurred: ' + makePrintable(err));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleToggleJobStatus = async (jobId: string, newStatus: 'open' | 'closed') => {
    // Validate transition using helper
    const job = myJobs.find((j) => j.id === jobId);
    const fromStatus = (job?.status || 'open') as JobStatus;
    if (!canTransitionJobStatus(fromStatus, newStatus, true)) {
      alert('Invalid status transition');
      return;
    }

    // Ask for confirmation before changing
    setConfirm({ jobId, newStatus });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome, {profile?.full_name || "Client"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Ready to post a new job?
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm text-muted-foreground">
              <div>Available services</div>
              <div className="font-bold text-foreground text-lg">{services.length || 0}</div>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>Providers</div>
              <div className="font-bold text-foreground text-lg">{users.filter(u => u.role === 'worker').length}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/jobs/post">
              <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Post Job
              </Button>
            </Link>
            <Link href="/bookings">
              <Button className="bg-secondary hover:bg-secondary/90 flex items-center gap-2">
                Book Service
              </Button>
            </Link>
            <Link href="/profile?edit=1">
              <Button variant="outline" className="bg-transparent">
                Edit Profile
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2 bg-transparent"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Jobs Stats */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-0">
            <h3 className="text-lg font-semibold text-white mb-4">Posted Jobs</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Total Jobs</span>
                <span className="font-bold text-white">{myJobs.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Active Jobs</span>
                <span className="font-bold text-green-400">{myJobs.filter(j => j.status === 'open').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Closed Jobs</span>
                <span className="font-bold text-red-400">{myJobs.filter(j => j.status === 'closed').length}</span>
              </div>
            </div>
          </Card>

          {/* Bookings Stats */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-0">
            <h3 className="text-lg font-semibold text-white mb-4">My Bookings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Total Bookings</span>
                <span className="font-bold text-white">{bookings.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Approved</span>
                <span className="font-bold text-green-400">{bookings.filter(b => b.status === 'approved').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Pending</span>
                <span className="font-bold text-yellow-400">{bookings.filter(b => b.status === 'pending').length}</span>
              </div>
            </div>
          </Card>

          {/* Applications Stats */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-0">
            <h3 className="text-lg font-semibold text-white mb-4">Applications</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Total Applications</span>
                <span className="font-bold text-white">
                  {myJobs.reduce((acc, job) => acc + job.job_applications.length, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Approved</span>
                <span className="font-bold text-green-400">
                  {myJobs.reduce((acc, job) => acc + job.job_applications.filter(a => a.status === 'accepted').length, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Pending</span>
                <span className="font-bold text-yellow-400">
                  {myJobs.reduce((acc, job) => acc + job.job_applications.filter(a => a.status === 'pending').length, 0)}
                </span>
              </div>
            </div>
          </Card>

          {/* Services Stats */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-0">
            <h3 className="text-lg font-semibold text-white mb-4">Services</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Available Services</span>
                <span className="font-bold text-white">{services.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Service Providers</span>
                <span className="font-bold text-primary">{users.filter(u => u.role === 'worker').length}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* My Bookings Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">My Bookings</h2>
          <Link href="/bookings">
            <Button variant="outline" className="bg-white/10 text-white border-white/20">
              View All Bookings
            </Button>
          </Link>
        </div>

        {bookings.length === 0 ? (
          <Card className="p-6 text-center bg-card/50 backdrop-blur-sm border-0">
            <p className="text-white/60">You haven't made any bookings yet</p>
            <Link href="/services" className="mt-4 inline-block">
              <Button>Browse Services</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bookings.slice(0, 6).map((booking) => (
              <Card key={booking.id} className="p-6 bg-card/50 backdrop-blur-sm border-0">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center overflow-hidden">
                      {/* Show provider details only after the provider has approved the booking */}
                      {booking.status === 'approved' ? (
                        booking.services.profiles.avatar_url ? (
                          <img
                            src={booking.services.profiles.avatar_url}
                            alt={booking.services.profiles.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl text-primary">
                            {booking.services.profiles.full_name[0]}
                          </span>
                        )
                      ) : (
                        <span className="text-xl text-primary">?</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{booking.services.name}</h3>
                      {booking.status === 'approved' ? (
                        <p className="text-sm text-white/80">by {booking.services.profiles.full_name}</p>
                      ) : (
                        <p className="text-sm text-white/80">Provider details will be visible once the provider approves the booking.</p>
                      )}
                    </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Booking Date</span>
                    <span className="text-sm text-white">
                      {new Date(booking.booking_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Duration</span>
                    <span className="text-sm text-white">{booking.services.duration}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Price</span>
                    <span className="text-primary font-medium">
                      KES {booking.services.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="text-sm text-white/60">Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      booking.status === 'approved' 
                        ? 'bg-green-500/20 text-green-300'
                        : booking.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {booking.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {booking.notes && (
                  <p className="text-sm text-white/60 mb-4 italic">
                    Note: {booking.notes}
                  </p>
                )}

                {booking.status === 'approved' && (
                  <Button
                    onClick={async (e) => {
                      e.preventDefault();
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
                        setBookings(prev => prev.map(b => b.id === booking.id ? updated : b));
                        alert('Booking marked as completed. You can now submit a review!');
                      } catch (err) {
                        console.error('Error completing booking:', err);
                        alert('Failed to complete booking: ' + (err instanceof Error ? err.message : String(err)));
                      }
                    }}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    Mark as Completed
                  </Button>
                )}

                {booking.status === 'completed' && !reviewedBookingIds.has(booking.id) && (
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      setReviewContext({ type: 'booking', id: booking.id, provider_id: booking.services.provider_id });
                      setReviewModalOpen(true);
                    }}
                    className="w-full mt-4 bg-primary"
                  >
                    Submit Review
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Jobs Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          My Posted Jobs
        </h2>

        {myJobs.length === 0 ? (
          <p className="text-muted-foreground">
            You have not posted any jobs yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myJobs.map((job) => (
              <Card key={job.id} className="p-4 flex flex-col justify-between bg-card/50 backdrop-blur-sm border-0">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-white">{job.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      job.status === "open"
                        ? "bg-green-500/20 text-green-300"
                        : "bg-red-500/20 text-red-300"
                    }`}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-white/80">{job.location}</p>
                  <p className="text-sm text-white/80 mt-1">
                    Budget: KES {job.budget.toLocaleString()} | Duration: {job.duration}
                  </p>
                  
                  {/* Applications Section */}
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <h4 className="text-sm font-medium text-white mb-2">Applications ({job.job_applications?.length || 0})</h4>
                    
                    {job.job_applications && job.job_applications.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        {job.job_applications.slice(0, 2).map((application) => (
                          <div key={application.id} className="flex items-center justify-between bg-white/5 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                                {application.provider.avatar_url ? (
                                  <img
                                    src={application.provider.avatar_url}
                                    alt={application.provider.full_name}
                                    className="w-full h-full rounded-full"
                                  />
                                ) : (
                                  <span className="text-sm text-primary">{application.provider.full_name[0]}</span>
                                )}
                              </div>
                              <div className="text-sm">
                                <p className="text-white/90">{application.provider.full_name}</p>
                                <p className="text-white/60">KES {application.proposed_rate.toLocaleString()}</p>
                              </div>
                            </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  application.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                  application.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                                  'bg-red-500/20 text-red-300'
                                }`}>
                                  {application.status.toUpperCase()}
                                </span>
                                {application.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleApproveApplication(job.id, application.id);
                                    }}
                                  >
                                    Approve
                                  </Button>
                                )}
                              </div>
                          </div>
                        ))}

                        {job.job_applications.length > 2 && (
                          <p className="text-sm text-white/60 text-center">
                            +{job.job_applications.length - 2} more applications
                          </p>
                        )}
                    </div>
                    ) : (
                      <p className="text-sm text-white/60 mb-4">No applications yet</p>
                    )}

                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="outline" className="w-full bg-white/10 text-white border-white/20">
                        View Full Details
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => handleToggleJobStatus(job.id, job.status === 'open' ? 'closed' : 'open')}
                    className={`flex-1 ${
                      job.status === 'open' 
                        ? 'bg-destructive/90 hover:bg-destructive text-white' 
                        : 'bg-green-600/90 hover:bg-green-600 text-white'
                    }`}
                  >
                    {job.status === 'open' ? 'Close Job' : 'Reopen Job'}
                  </Button>
                  
                  <Link href={`/jobs/${job.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full bg-white/10 text-white border-white/20">
                      Edit Job
                    </Button>
                  </Link>
                </div>

                {/* Show Mark as Complete button for jobs with accepted applications */}
                {job.status === 'open' && (
                  <Button
                    onClick={() => setConfirm({ 
                      jobId: job.id, 
                      newStatus: 'completed', 
                      title: 'Complete Job', 
                      message: 'Mark this job as completed? This will allow reviews.',
                      hasAcceptedApplication: job.job_applications.some(app => app.status === 'accepted')
                    })}
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!job.job_applications.some(app => app.status === 'accepted')}
                  >
                    Mark Job as Completed
                  </Button>
                )}

                {/* Show Review button for completed jobs */}
                {job.status === 'completed' && job.job_applications.some(app => app.status === 'accepted') && !reviewedJobIds.has(job.id) && (
                  <Button
                    onClick={() => {
                      const acceptedWorker = job.job_applications.find(app => app.status === 'accepted');
                      if (!acceptedWorker) return;
                      setReviewContext({ type: 'job', id: job.id, provider_id: acceptedWorker.provider.id });
                      setReviewModalOpen(true);
                    }}
                    className="w-full mt-2 bg-primary hover:bg-primary/90 text-white"
                  >
                    Review Worker
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Available Services Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Available Services</h2>
          <Link href="/services">
            <Button variant="outline" className="bg-white/10 text-white border-white/20">
              View All Services
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.slice(0, 3).map((service) => (
            <Card key={service.id} className="p-6 bg-card/50 backdrop-blur-sm border-0">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center overflow-hidden">
                  {service.profiles.avatar_url ? (
                    <img
                      src={service.profiles.avatar_url}
                      alt={service.profiles.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl text-primary">{service.profiles.full_name[0]}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                  <p className="text-sm text-white/80">{service.category}</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <p className="text-sm text-white/80">{service.description}</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">{service.profiles.location}</span>
                </div>
                <p className="text-primary font-medium">KES {service.price.toLocaleString()}</p>
              </div>

              <Link href={`/provider/${service.provider_id}?service=${service.id}`}>
                <Button className="w-full">View & Book</Button>
              </Link>
            </Card>
          ))}

          {services.length === 0 && (
            <Card className="p-6 col-span-3 text-center bg-card/50 backdrop-blur-sm border-0">
              <p className="text-white/80">Loading available services...</p>
            </Card>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-white mb-4">My Reviews</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews.length === 0 ? (
            <Card className="p-6 col-span-3 text-center bg-card/50 backdrop-blur-sm border-0">
              <p className="text-white/80">You haven't submitted any reviews yet</p>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review.id} className="p-6 bg-card/50 backdrop-blur-sm border-0">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center overflow-hidden">
                    {review.profiles.avatar_url ? (
                      <img
                        src={review.profiles.avatar_url}
                        alt={review.profiles.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl text-primary">
                        {review.profiles.full_name[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{review.profiles.full_name}</h3>
                    <p className="text-sm text-white/60">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-5 h-5 ${
                          star <= review.rating ? 'text-yellow-400' : 'text-white/20'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-white/80">{review.comment}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Recent Providers Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-white mb-4">Featured Service Providers</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.filter(user => user.role === 'worker').slice(0, 6).map((user) => (
            <Card key={user.id} className="p-4 flex flex-col justify-between bg-card/50 backdrop-blur-sm border-0">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={`${user.full_name}'s avatar`}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <span className="text-xl text-primary">{user.full_name[0]}</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-white">{user.full_name}</h3>
                    <p className="text-sm text-white/80">{user.role}</p>
                  </div>
                </div>
              </div>
              <Link href={`/provider/${user.id}`}>
                <Button className="w-full bg-primary hover:bg-primary/90">View Profile</Button>
              </Link>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-8">
          <Link href="/services">
            <Button variant="outline" className="bg-white/10 text-white border-white/20">
              View All Service Providers
            </Button>
          </Link>
        </div>
      </div>
      {/* Review modal */}
      <ReviewModal
        open={reviewModalOpen}
        title={reviewContext?.type === 'job' ? 'Review Worker' : 'Review Service'}
        revieweeId={reviewContext?.provider_id || ''}
        onClose={() => {
          setReviewModalOpen(false);
          setReviewContext(null);
        }}
        onSubmit={async (payload: { rating: number; comment: string; revieweeId: string }) => {
          // First check for an active session
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session?.user?.id) {
            console.error('No active session found');
            alert('Please log in to submit a review');
            router.push('/login');
            return;
          }
          
          const userId = session.user.id;

          if (!reviewContext?.id || !reviewContext?.provider_id) {
            console.error('Invalid review context:', reviewContext);
            alert('Missing required review information. Please try again.');
            setReviewModalOpen(false);
            return;
          }

          try {
            // Ensure we have valid session before proceeding
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
              throw new Error('No active session. Please log in again.');
            }

            if (reviewContext.type === 'booking') {
              // Use server API so the server controls allowed fields (avoids client-side review_type mismatches)
              const token = session?.access_token || (session as any)?.accessToken || null
              const bodyPayload: any = { revieweeId: reviewContext.provider_id, bookingId: reviewContext.id, rating: payload.rating, comment: payload.comment }
              if (token) bodyPayload.accessToken = token

              console.log('[DEBUG SEND /api/reviews] booking payload:', bodyPayload, 'hasToken:', !!token)
              const res = await fetch('/api/reviews', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(bodyPayload)
              })

              // Parse response safely (some server errors can return empty body)
              const text = await res.text();
              let result: any = null;
              try {
                result = text ? JSON.parse(text) : null;
              } catch (e) {
                result = text;
              }

              if (!res.ok) {
                console.error('Error submitting booking review (server):', { status: res.status, body: result, rawText: text })
                throw new Error((result && result.error) || 'Failed to submit review')
              }

              setReviews((prev) => [result, ...(prev || [])]);
              setReviewedBookingIds((prev) => new Set(Array.from(prev).concat([reviewContext.id])));
            }

            if (reviewContext.type === 'job') {
              const token = session?.access_token || (session as any)?.accessToken || null
              const bodyPayload: any = { revieweeId: reviewContext.provider_id, jobId: reviewContext.id, rating: payload.rating, comment: payload.comment }
              if (token) bodyPayload.accessToken = token

              console.log('[DEBUG SEND /api/reviews] job payload:', bodyPayload, 'hasToken:', !!token)
              const res = await fetch('/api/reviews', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(bodyPayload)
              })

              const text = await res.text();
              let result: any = null;
              try {
                result = text ? JSON.parse(text) : null;
              } catch (e) {
                result = text;
              }

              if (!res.ok) {
                console.error('Error submitting job review (server):', { status: res.status, body: result, rawText: text })
                throw new Error((result && result.error) || 'Failed to submit review')
              }

              setReviews((prev) => [result, ...(prev || [])]);
              setReviewedJobIds((prev) => new Set(Array.from(prev).concat([reviewContext.id])));
            }
            
            setReviewModalOpen(false);
            setReviewContext(null);
            alert('Thank you for your review!');
          } catch (error: any) {
            console.error('Error submitting review:', {
              error: makePrintable(error),
              rawError: error,
              errorKeys: Object.getOwnPropertyNames(error || {}),
              errorType: typeof error,
              context: {
                type: reviewContext?.type,
                reviewId: reviewContext?.id,
                userId,
                providerId: reviewContext?.provider_id
              }
            });

            // Check if it's a session error and handle accordingly
            if (error.message?.includes('No active session')) {
              router.push('/login');
              alert('Your session has expired. Please log in again.');
              return;
            }

            // Show a more detailed error message to the user
            const errorMessage = error.message || error.error_description || 'Failed to submit review';
            alert(errorMessage);
          }
        }}
      />
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Yes, continue"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            const { jobId, newStatus, hasAcceptedApplication } = confirm;

            // Pre-check: if user tries to complete without an accepted application, stop early
            if (newStatus === 'completed' && !hasAcceptedApplication) {
              alert('Cannot complete job: there is no accepted application. Accept an application first.');
              setConfirm(null);
              return;
            }

            // Use the helper to update status
            const res = await updateJobStatus(jobId, newStatus);
            if (!res.success) {
              // If it's an auth error, guide the user to login
              if (res.isAuthError) {
                alert(res.error || 'Authentication required. Please log in again.');
                // Optionally navigate to login
                router.push('/login');
                return;
              }
              alert(res.error || 'Failed to update job status');
              return;
            }
            setMyJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
            if (newStatus === 'completed') {
              alert('Job marked as completed. You can now submit reviews!');
            } else {
              alert(`Job ${newStatus} successfully`);
            }
          } catch (err) {
            console.error('Confirm action error', err);
            alert('Action failed');
          }
        }}
      />
    </div>
  );
}

export default ClientDashboard;
