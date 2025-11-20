"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Zap, Shield, Users, TrendingUp, Briefcase, Laptop, Coffee, BarChart, Users as UsersIcon } from "lucide-react"
import AnimatedBackground from "@/components/ui/animated-shader-background"

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background text-white overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">L</span>
              </div>
              <span className="font-bold text-xl text-foreground">LocalFix Kenya</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:bg-white/10">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">Get Started</Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 animate-gradient">
            Find remote jobs anywhere
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-10 max-w-3xl mx-auto">
            Connect with global opportunities. Work from anywhere, on your terms.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/jobs">
              <Button size="lg" className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white text-lg px-8 py-4 rounded-full shadow-lg transform transition-transform hover:scale-105">
                Explore Jobs
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-lg px-8 py-4 rounded-full shadow-lg transform transition-transform hover:scale-105">
                Post a Job
              </Button>
            </Link>
          </div>

          {/* Floating Icons */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="floating-icon" style={{ top: '10%', left: '15%', animationDelay: '0s' }}><Laptop className="w-12 h-12 text-blue-300 opacity-70" /></div>
            <div className="floating-icon" style={{ top: '25%', right: '10%', animationDelay: '2s' }}><Coffee className="w-12 h-12 text-pink-300 opacity-70" /></div>
            <div className="floating-icon" style={{ top: '50%', left: '5%', animationDelay: '4s' }}><BarChart className="w-12 h-12 text-green-300 opacity-70" /></div>
            <div className="floating-icon" style={{ top: '70%', right: '20%', animationDelay: '6s' }}><UsersIcon className="w-12 h-12 text-purple-300 opacity-70" /></div>
            <div className="floating-icon" style={{ top: '85%', left: '30%', animationDelay: '8s' }}><Briefcase className="w-12 h-12 text-yellow-300 opacity-70" /></div>
            <div className="floating-icon" style={{ top: '40%', right: '30%', animationDelay: '10s' }}><Zap className="w-12 h-12 text-red-300 opacity-70" /></div>
          </div>
        </section>

        {/* Features Section - Retained for structure, but content might need adjustment for remote focus */}
        <section className="bg-secondary/30 py-20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-foreground mb-12 text-center">Why Choose LocalFix Kenya for Remote Work?</h2>
            <div className="grid md:grid-cols-4 gap-8">
              <Card className="p-6 bg-card/70 border-none text-white">
                <Shield className="w-12 h-12 text-blue-400 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Verified Opportunities</h3>
                <p className="text-muted-foreground">All remote job postings are verified for legitimacy</p>
              </Card>
              <Card className="p-6 bg-card/70 border-none text-white">
                <Users className="w-12 h-12 text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Global Network</h3>
                <p className="text-muted-foreground">Connect with companies and talent worldwide</p>
              </Card>
              <Card className="p-6 bg-card/70 border-none text-white">
                <TrendingUp className="w-12 h-12 text-green-400 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Career Growth</h3>
                <p className="text-muted-foreground">Find roles that foster professional development</p>
              </Card>
              <Card className="p-6 bg-card/70 border-none text-white">
                <Briefcase className="w-12 h-12 text-yellow-400 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Flexible Work</h3>
                <p className="text-muted-foreground">Discover roles that fit your lifestyle and schedule</p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-lg p-12 text-center shadow-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to embrace remote work?</h2>
            <p className="text-white/90 mb-8 text-lg md:text-xl">
              Join our platform and unlock a world of remote possibilities.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-white text-indigo-700 hover:bg-gray-100 text-lg px-10 py-5 rounded-full shadow-lg transform transition-transform hover:scale-105">
                Sign Up Today
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50 backdrop-blur-sm mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid md:grid-cols-4 gap-8 mb-8 text-white">
              <div>
                <h4 className="font-semibold text-foreground mb-4">LocalFix Kenya</h4>
                <p className="text-muted-foreground text-sm">Connecting remote talent with global opportunities</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">For Job Seekers</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/jobs" className="hover:text-foreground">
                      Browse Remote Jobs
                    </Link>
                  </li>
                  <li>
                    <Link href="/profile" className="hover:text-foreground">
                      Create Profile
                    </Link>
                  </li>
                  <li>
                    <Link href="/bookings" className="hover:text-foreground">
                      My Applications
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">For Companies</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/signup?role=company" className="hover:text-foreground">
                      Post a Job
                    </Link>
                  </li>
                  <li>
                    <Link href="/provider/dashboard" className="hover:text-foreground">
                      Employer Dashboard
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="#" className="hover:text-foreground">
                      Help Center
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="hover:text-foreground">
                      Contact Us
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
              <p>&copy; 2025 LocalFix Kenya. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

<style jsx global>{`
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
    100% { transform: translateY(0px); }
  }

  .floating-icon {
    position: absolute;
    animation: float 8s ease-in-out infinite;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
  }

  @keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 10s ease infinite;
  }
`}</style>
