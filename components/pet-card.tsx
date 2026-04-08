"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Check, QrCode } from "lucide-react";

interface VaccineStatus {
  name: string;
  status: "protected" | "due_soon" | "overdue";
}

interface PetCardProps {
  name: string;
  breed: string;
  age: string;
  photoUrl?: string;
  microchipNumber?: string;
  vaccines: VaccineStatus[];
  parasiteDaysLeft?: number;
}

export function PetCard({
  name,
  breed,
  age,
  photoUrl,
  microchipNumber,
  vaccines,
  parasiteDaysLeft,
}: PetCardProps) {
  const getStatusColor = (status: VaccineStatus["status"]) => {
    switch (status) {
      case "protected":
        return "bg-green-100 text-green-700 border-green-200";
      case "due_soon":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-700 border-red-200";
    }
  };

  const getStatusIcon = (status: VaccineStatus["status"]) => {
    switch (status) {
      case "protected":
        return <Check className="w-3 h-3" />;
      case "due_soon":
        return <AlertTriangle className="w-3 h-3" />;
      case "overdue":
        return <AlertTriangle className="w-3 h-3" />;
    }
  };

  return (
    <Card className="overflow-hidden rounded-2xl shadow-lg border-0 bg-white gradient-border">
      {/* Hero Image */}
      <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-4xl">🐕</span>
            </div>
          </div>
        )}
      </div>

      {/* Identity Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">{name}</h2>
            <p className="text-muted-foreground">{breed}</p>
            <p className="text-sm text-muted-foreground">{age}</p>
          </div>
          <div className="flex flex-col items-center">
            <QrCode className="w-10 h-10 text-muted-foreground" />
            <span className="text-xs text-muted-foreground mt-1">Microchip</span>
          </div>
        </div>
      </div>

      {/* Vaccine Status */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Vaccine Status
        </h3>
        <div className="space-y-2">
          {vaccines.map((vaccine) => (
            <div key={vaccine.name} className="flex items-center justify-between">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {vaccine.name}
              </Badge>
              <Badge
                variant="outline"
                className={`flex items-center gap-1 ${getStatusColor(vaccine.status)}`}
              >
                {getStatusIcon(vaccine.status)}
                {vaccine.status === "protected" && "Protected"}
                {vaccine.status === "due_soon" && "Due Soon"}
                {vaccine.status === "overdue" && "Overdue"}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Parasite Prevention */}
      {parasiteDaysLeft !== undefined && (
        <div className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Parasite Prevention Log</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/30"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${(parasiteDaysLeft / 30) * 176} 176`}
                  className="text-primary"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-foreground">{parasiteDaysLeft}</span>
                <span className="text-xs text-muted-foreground">Days</span>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">Countdown timer</p>
              <p className="text-sm text-muted-foreground">
                Next dose due in {parasiteDaysLeft} days
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
