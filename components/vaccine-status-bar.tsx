"use client";

import { ShieldCheck, AlertTriangle } from "lucide-react";

interface VaccineStatusBarProps {
  name: string;
  brandName?: string;
  status: "protected" | "due_soon" | "overdue" | "none";
  percentage: number;
}

export function VaccineStatusBar({ name, brandName, status, percentage }: VaccineStatusBarProps) {
  const getStatusColor = () => {
    switch (status) {
      case "protected":
        return "bg-green-500";
      case "due_soon":
        return "bg-yellow-500";
      case "overdue":
        return "bg-red-500";
      default:
        return "bg-gray-200";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "protected":
        return <ShieldCheck className="w-5 h-5 text-white" />;
      case "due_soon":
        return <AlertTriangle className="w-4 h-4 text-yellow-900" />;
      case "overdue":
        return <AlertTriangle className="w-4 h-4 text-white" />;
      default:
        return null;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case "protected":
        return "text-white";
      case "due_soon":
        return "text-yellow-900";
      case "overdue":
        return "text-white";
      default:
        return "text-gray-500";
    }
  };

  const displayText =
    brandName && status !== "none"
      ? `${name} • ${brandName}`
      : status === "none"
        ? `${name} • Not recorded`
        : name;

  return (
    <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${getStatusColor()} rounded-full transition-all duration-500`}
        style={{ width: status === "none" ? "100%" : `${percentage}%` }}
      />
      <div className={`absolute inset-0 flex items-center justify-between px-3 ${getTextColor()}`}>
        <span className="text-xs font-medium truncate pr-2">{displayText}</span>
        {getStatusIcon()}
      </div>
    </div>
  );
}
