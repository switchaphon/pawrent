"use client";

import { useLocation } from "@/components/location-provider";
import { MapPin, X } from "lucide-react";
import { useState } from "react";

export function LocationBanner() {
  const { error, requestLocation } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!error || dismissed) return null;

  return (
    <div className="bg-secondary/20 border-b border-secondary/30 px-4 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="w-4 h-4 text-secondary-foreground" />
        <span className="text-secondary-foreground">{error}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={requestLocation}
          className="text-xs font-medium text-primary hover:underline"
        >
          Retry
        </button>
        <button onClick={() => setDismissed(true)} className="text-text-muted hover:text-text-main">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
