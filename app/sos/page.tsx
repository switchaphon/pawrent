"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPets, createSOSAlert, uploadSOSVideo } from "@/lib/db";
import type { Pet } from "@/lib/types";
import { sosAlertSchema, videoFileSchema } from "@/lib/validations";
import { AlertTriangle, MapPin, Video, Send, Loader2, CheckCircle } from "lucide-react";

// Dynamic import for Leaflet (SSR issue)
const MapPicker = dynamic(
  () => import("@/components/map-picker").then((mod) => mod.MapPicker),
  { ssr: false, loading: () => <div className="h-48 bg-muted rounded-xl animate-pulse" /> }
);

function SOSFormContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const preselectedPetId = searchParams.get("pet");
  
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Get selected pet object
  const selectedPet = pets.find(p => p.id === selectedPetId);

  useEffect(() => {
    if (user) {
      getPets(user.id).then(({ data }) => {
        setPets(data || []);
        // Use preselected pet from URL, or first pet
        if (preselectedPetId && data?.some(p => p.id === preselectedPetId)) {
          setSelectedPetId(preselectedPetId);
        } else if (data && data.length > 0) {
          setSelectedPetId(data[0].id);
        }
      });
    }
  }, [user, preselectedPetId]);

  // Pre-populate description from selected pet's special_notes
  useEffect(() => {
    if (selectedPet?.special_notes) {
      setDescription(selectedPet.special_notes);
    } else {
      setDescription("");
    }
  }, [selectedPet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPetId || !location) return;

    const validationResult = sosAlertSchema.safeParse({
      pet_id: selectedPetId,
      lat: location.lat,
      lng: location.lng,
      description: description || null,
    });
    if (!validationResult.success) {
      alert(validationResult.error.issues[0].message);
      return;
    }

    if (videoFile) {
      const videoResult = videoFileSchema.safeParse({ size: videoFile.size, type: videoFile.type });
      if (!videoResult.success) {
        alert(videoResult.error.issues[0].message);
        return;
      }
    }

    setLoading(true);

    try {
      // Create SOS alert (pet photo is attached via pet_id relationship)
      const { data: alert, error } = await createSOSAlert({
        pet_id: selectedPetId,
        owner_id: user.id,
        lat: location.lat,
        lng: location.lng,
        description: description || null,
        video_url: null,
      });

      if (error) throw error;

      // Upload video if exists
      if (videoFile && alert) {
        const { url } = await uploadSOSVideo(videoFile, alert.id);
        // Could update the alert with video URL here
      }

      setStep("success");
    } catch (error) {
      console.error("Error creating SOS alert:", error);
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-30 bg-green-600 text-white px-4 py-3">
          <h1 className="text-xl font-bold">SOS Alert Sent!</h1>
        </header>
        <main className="px-4 py-12 max-w-md mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Alert Broadcasted
          </h2>
          <p className="text-muted-foreground mb-6">
            Nearby pet parents within 5km will be notified. Stay strong!
          </p>
          <Button
            onClick={() => {
              setStep("form");
              setDescription("");
              setVideoFile(null);
            }}
            variant="outline"
            className="w-full"
          >
            Create Another Alert
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-destructive text-white px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <h1 className="text-xl font-bold">SOS & Lost Mode</h1>
        </div>
        <p className="text-sm opacity-90">Report a lost pet emergency</p>
      </header>

      {/* Form */}
      <main className="px-4 py-6 max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Select Pet */}
          <Card className="p-4 rounded-xl">
            <Label htmlFor="pet" className="text-foreground font-semibold">
              Select Pet *
            </Label>
            <select
              id="pet"
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
              className="w-full mt-2 p-3 border border-border rounded-xl bg-background text-foreground"
              required
            >
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} - {pet.breed || "Unknown breed"}
                </option>
              ))}
            </select>
          </Card>

          {/* Last Seen Location */}
          <Card className="p-4 rounded-xl">
            <Label className="text-foreground font-semibold flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-destructive" />
              Last Seen Location *
            </Label>
            <MapPicker
              onLocationSelect={(lat, lng) => setLocation({ lat, lng })}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {location
                ? `📍 ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                : "Tap on the map to set location"}
            </p>
          </Card>

          {/* Video Upload */}
          <Card className="p-4 rounded-xl">
            <Label className="text-foreground font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Video Evidence (Optional)
            </Label>
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="mt-2"
            />
            {videoFile && (
              <p className="text-xs text-muted-foreground mt-2">
                📹 {videoFile.name}
              </p>
            )}
          </Card>

          {/* Description */}
          <Card className="p-4 rounded-xl">
            <Label htmlFor="description" className="text-foreground font-semibold">
              Distinguishing Marks
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., Blue collar, white patch on chest..."
              className="w-full mt-2 p-3 border border-border rounded-xl bg-background text-foreground min-h-[100px] resize-none"
            />
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || !location || !selectedPetId}
            className="w-full h-14 text-lg font-bold bg-destructive hover:bg-destructive/90"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Broadcast SOS Alert
              </>
            )}
          </Button>
        </form>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default function SOSPage() {
  return <SOSFormContent />;
}
