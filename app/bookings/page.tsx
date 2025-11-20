"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Calendar, MapPin, User, ArrowLeft, Clock } from "lucide-react"

// Mock bookings data
const BOOKINGS = [
  {
    id: 1,
    provider: "John Kariuki",
    service: "Plumbing",
    date: "2025-11-15",
    time: "10:00 AM",
    status: "Confirmed",
    location: "Nairobi",
  },
  {
    id: 2,
    provider: "Mary Kipchoge",
    service: "Electrical",
    date: "2025-11-20",
    time: "2:00 PM",
    status: "Pending",
    location: "Nairobi",
  },
]

export default function BookingsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/services" className="flex items-center gap-2 text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to services
          </Link>
          <h1 className="text-3xl font-bold text-foreground">My Bookings</h1>
        </div>
      </header>

      {/* Bookings List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {BOOKINGS.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No bookings yet</p>
            <Link href="/services">
              <Button>Browse Services</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {BOOKINGS.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-4">{booking.provider}</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{booking.service}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{booking.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{booking.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{booking.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                        booking.status === "Confirmed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
