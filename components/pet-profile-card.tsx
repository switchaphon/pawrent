"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhotoGallery } from "@/components/photo-gallery";
import { PhotoLightbox } from "@/components/photo-lightbox";
import {
  Pencil,
  Copy,
  Check,
  QrCode,
  Calendar,
  Gauge,
  ChartLine,
  X,
  AlertTriangle,
  PartyPopper,
  HeartCrack,
} from "lucide-react";
import type { Pet, PetReport, PetPhoto } from "@/lib/types";

interface PetProfileCardProps {
  pet: Pet;
  activePetReport?: PetReport | null;
  photos?: PetPhoto[];
  onEdit: () => void;
  onReport: () => void;
  onPetFound?: (alertId: string) => void;
  onGiveUp?: (alertId: string) => void;
  onAddPhoto?: () => void;
  onDeletePhoto?: (photoId: string) => void;
}

// Helper to calculate age
function calculateAge(dob: string | null): string {
  if (!dob) return "Unknown age";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} month${m !== 1 ? "s" : ""}`;
  return `${y} year${y !== 1 ? "s" : ""} ${m} month${m !== 1 ? "s" : ""}`;
}

function formatBirthday(dob: string | null): string {
  if (!dob) return "—";
  const date = new Date(dob);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PetProfileCard({
  pet,
  activePetReport,
  photos = [],
  onEdit,
  onReport,
  onPetFound,
  onGiveUp,
  onAddPhoto,
  onDeletePhoto,
}: PetProfileCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [codeType, setCodeType] = useState<"qr" | "barcode">("qr");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleCopyId = async () => {
    if (pet.microchip_number) {
      await navigator.clipboard.writeText(pet.microchip_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Build the info line: species • breed • sex • color
  const infoItems = [pet.species, pet.breed, pet.sex, pet.color].filter(Boolean);
  const infoLine = infoItems.join(" • ") || "No details";

  return (
    <>
      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          />
          <Card className="relative p-6 rounded-2xl max-w-xs w-full shadow-2xl text-center">
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-foreground text-lg mb-4">{pet.name}</h3>

            {/* Code Display */}
            <div className="w-48 h-48 mx-auto bg-gray-100 rounded-xl flex items-center justify-center mb-4">
              {codeType === "qr" ? (
                /* Realistic QR Code SVG Mockup */
                <svg viewBox="0 0 100 100" className="w-40 h-40">
                  {/* Finder Patterns (Top-Left, Top-Right, Bottom-Left) */}
                  <g fill="currentColor">
                    {/* Top-Left */}
                    <path d="M10,10 h20 v20 h-20 z M14,14 v12 h12 v-12 z M18,18 h4 v4 h-4 z" />
                    {/* Top-Right */}
                    <path d="M70,10 h20 v20 h-20 z M74,14 v12 h12 v-12 z M78,18 h4 v4 h-4 z" />
                    {/* Bottom-Left */}
                    <path d="M10,70 h20 v20 h-20 z M14,74 v12 h12 v-12 z M18,78 h4 v4 h-4 z" />
                  </g>

                  {/* Random Data Dots */}
                  <g fill="currentColor" opacity="0.9">
                    {Array.from({ length: 100 }).map((_, i) => {
                      // Generate somewhat random positions but avoid finder pattern areas
                      const x = Math.floor(i % 10) * 8 + 12;
                      const y = Math.floor(i / 10) * 8 + 12;

                      // Skip finder pattern zones approx
                      const isTL = x < 35 && y < 35;
                      const isTR = x > 65 && y < 35;
                      const isBL = x < 35 && y > 65;

                      if (isTL || isTR || isBL) return null;

                      // Deterministic pattern based on index
                      const show = (i * 7 + 3) % 5 !== 0;
                      return show ? <rect key={i} x={x} y={y} width="6" height="6" rx="1" /> : null;
                    })}
                  </g>
                </svg>
              ) : (
                /* Realistic Barcode SVG Mockup (Code 128 style) */
                <svg viewBox="0 0 200 80" className="w-48 h-24">
                  <g fill="currentColor">
                    {Array.from({ length: 40 }).map((_, i) => {
                      const x = 10 + i * 4.5;
                      const width = i % 2 === 0 ? 3 : 1.5;
                      return <rect key={i} x={x} y="10" width={width} height="50" />;
                    })}
                  </g>
                  {/* Text below barcode */}
                  <text
                    x="100"
                    y="75"
                    fontFamily="monospace"
                    fontSize="12"
                    textAnchor="middle"
                    fill="currentColor"
                  >
                    {pet.microchip_number || "123456789012345"}
                  </text>
                </svg>
              )}
            </div>

            {/* Toggle */}
            <div className="flex justify-center gap-2 mb-4">
              <button
                onClick={() => setCodeType("qr")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  codeType === "qr"
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-foreground hover:bg-gray-200"
                }`}
              >
                QR Code
              </button>
              <button
                onClick={() => setCodeType("barcode")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  codeType === "barcode"
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-foreground hover:bg-gray-200"
                }`}
              >
                Barcode
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-1">Microchip ID</p>
            <p className="font-mono text-foreground font-medium">
              {pet.microchip_number || "Not registered"}
            </p>
          </Card>
        </div>
      )}

      {/* Active Pet Report Banner - Above Card */}
      {activePetReport && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            Active report since {new Date(activePetReport.created_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Main Profile Card */}
      <Card className="rounded-2xl overflow-hidden shadow-sm">
        {/* Header Section */}
        <div className="p-4">
          <div className="flex gap-4">
            {/* Square Photo */}
            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20">
              {pet.photo_url ? (
                <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-3xl">🐕</span>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold text-foreground truncate">{pet.name}</h2>
                {/* Edit Button */}
                <button
                  onClick={onEdit}
                  className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Pencil className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {/* Pet ID Row */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-lg">
                  <span className="text-xs font-mono text-foreground">
                    {pet.microchip_number ? pet.microchip_number.slice(0, 15) : "No ID"}
                  </span>
                  <button
                    onClick={handleCopyId}
                    className="p-0.5 hover:bg-primary/20 rounded transition-colors"
                    disabled={!pet.microchip_number}
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => setShowQR(true)}
                  className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <QrCode className="w-4 h-4 text-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-4" />

          {/* Info line: species • breed • sex • color */}
          {infoItems.length > 0 && <p className="text-sm text-muted-foreground mb-2">{infoLine}</p>}

          {/* Special Notes */}
          {pet.special_notes && (
            <div className="text-sm">
              <p className="text-muted-foreground">{pet.special_notes}</p>
            </div>
          )}

          {/* Report Button - Conditional based on active report */}
          {activePetReport ? (
            <div className="mt-4 space-y-2">
              <Button
                onClick={() => onPetFound?.(activePetReport.id)}
                className="w-full h-10 text-sm font-bold bg-green-500 hover:bg-green-600 text-white rounded-xl"
              >
                <PartyPopper className="w-4 h-4 mr-2" />
                Pet Found!
              </Button>
              <Button
                onClick={() => onGiveUp?.(activePetReport.id)}
                variant="ghost"
                className="w-full h-7 text-xs text-muted-foreground hover:text-destructive rounded-lg"
              >
                <HeartCrack className="w-3 h-3 mr-1" />
                I&apos;m Give Up
              </Button>
            </div>
          ) : (
            <Button
              onClick={onReport}
              className="w-full h-10 text-sm font-bold bg-destructive hover:bg-destructive/90 rounded-xl mt-4"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Report Lost Pet
            </Button>
          )}
        </div>
      </Card>

      {/* Photo Gallery */}
      <PhotoGallery
        photos={photos}
        maxPhotos={10}
        onPhotoClick={(index) => {
          setLightboxIndex(index);
          setLightboxOpen(true);
        }}
        onAddPhoto={() => onAddPhoto?.()}
        canAdd={!!onAddPhoto}
      />

      {/* Photo Lightbox */}
      <PhotoLightbox
        photos={photos}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onDelete={onDeletePhoto}
        canDelete={!!onDeletePhoto}
      />

      {/* Age & Weight Cards - Compact */}
      <div className="grid grid-cols-2 gap-3">
        {/* Birthday/Age Card */}
        <Card className="p-2.5 rounded-xl shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Age</span>
          </div>
          <p className="font-bold text-foreground text-base leading-tight">
            {calculateAge(pet.date_of_birth)}
          </p>
          <p className="text-xs text-muted-foreground">DOB: {formatBirthday(pet.date_of_birth)}</p>
        </Card>

        {/* Weight Card */}
        <Card className="p-2.5 rounded-xl shadow-sm relative">
          <button
            className="absolute top-2 right-2 p-0.5 rounded hover:bg-gray-100 transition-colors"
            title="View weight history"
          >
            <ChartLine className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-1.5 mb-1">
            <Gauge className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Weight</span>
          </div>
          <p className="font-bold text-foreground text-base leading-tight">
            {pet.weight_kg ? `${pet.weight_kg} kg` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Recorded: Today</p>
        </Card>
      </div>
    </>
  );
}
