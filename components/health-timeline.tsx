"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Syringe, Stethoscope, Calendar, Check, AlertTriangle, FileText } from "lucide-react";
import Image from "next/image";

export interface HealthEvent {
  id: string;
  type: "lab" | "diagnosis" | "checkup";
  title: string;
  description?: string;
  date: string;
  status?: "healthy" | "monitor" | "alert";
  imageUrl?: string;
  ownerNote?: string;
}

interface HealthTimelineProps {
  events: HealthEvent[];
}

const getEventIcon = (type: HealthEvent["type"]) => {
  switch (type) {
    case "lab":
      return <FileText className="w-4 h-4" />;
    case "diagnosis":
      return <Syringe className="w-4 h-4" />;
    case "checkup":
      return <Stethoscope className="w-4 h-4" />;
  }
};

const getEventColor = (type: HealthEvent["type"]) => {
  switch (type) {
    case "lab":
      return "bg-info-bg text-info";
    case "diagnosis":
      return "bg-orange-100 text-orange-600";
    case "checkup":
      return "bg-purple-100 text-purple-600";
  }
};

const getStatusBadge = (status?: HealthEvent["status"]) => {
  if (!status) return null;
  switch (status) {
    case "healthy":
      return (
        <Badge variant="outline" className="bg-success-bg text-success border-green-200 gap-1">
          <Check className="w-3 h-3" /> Healthy
        </Badge>
      );
    case "monitor":
      return (
        <Badge variant="outline" className="bg-warning-bg text-warning border-yellow-200 gap-1">
          <AlertTriangle className="w-3 h-3" /> Monitor
        </Badge>
      );
    case "alert":
      return (
        <Badge variant="outline" className="bg-danger-bg text-danger border-red-200 gap-1">
          <AlertTriangle className="w-3 h-3" /> Alert
        </Badge>
      );
  }
};

export function HealthTimeline({ events }: HealthTimelineProps) {
  if (events.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-text-muted">No health events recorded yet.</p>
      </Card>
    );
  }

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex gap-4">
            {/* Timeline Node */}
            <div
              className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-xl ${getEventColor(event.type)}`}
            >
              {getEventIcon(event.type)}
            </div>

            {/* Event Card */}
            <Card className="flex-1 p-4 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${getEventColor(event.type)}`}>
                    {getEventIcon(event.type)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-main">{event.title}</h4>
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {event.date}
                    </p>
                  </div>
                </div>
                {getStatusBadge(event.status)}
              </div>

              {event.description && (
                <p className="text-sm text-text-muted mb-2">{event.description}</p>
              )}

              {event.imageUrl && (
                <div className="relative h-32 rounded-lg overflow-hidden mb-2">
                  <Image src={event.imageUrl} alt={event.title} fill className="object-cover" />
                </div>
              )}

              {event.ownerNote && (
                <div className="bg-secondary/30 rounded-lg p-2 mt-2">
                  <p className="text-xs text-secondary-foreground">
                    <span className="font-medium">Owner note:</span> {event.ownerNote}
                  </p>
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
