"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import map component to avoid SSR issues
const HospitalMap = dynamic(() => import("@/components/hospital-map"), {
  // Disable SSR
  ssr: false,
  // Loading component
  loading: () => (
    <div className="h-[calc(100vh-64px)] w-full flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
      <p className="text-muted-foreground font-medium">Loading Map...</p>
    </div>
  ),
});

export default function HospitalPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <HospitalMap />
    </div>
  );
}
