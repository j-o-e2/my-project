"use client"

import AnimatedBackground from "@/components/ui/animated-shader-background"

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <div className="relative z-10 min-h-screen bg-transparent text-white">
        {children}
      </div>
    </div>
  )
}