"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreatePetForm } from "@/components/create-pet-form";
import { EditPetForm } from "@/components/edit-pet-form";
import { PetProfileCard } from "@/components/pet-profile-card";
import { AddVaccineForm } from "@/components/add-vaccine-form";
import { AddParasiteLogForm } from "@/components/add-parasite-log-form";
import { getCoreVaccineTypesBySpecies, matchesVaccineType, isOptionalVaccine } from "@/data/vaccines";
import { getPets, getPetWithDetails, getActiveSOSAlertForPet, resolveSOSAlert, getPetPhotos, uploadPetGalleryImage, addPetPhoto, deletePetPhoto } from "@/lib/db";
import type { Pet, Vaccination, ParasiteLog, HealthEvent, SOSAlert, PetPhoto } from "@/lib/types";
import { ImageCropper } from "@/components/image-cropper";
import {
  AlertTriangle,
  Plus,
  Loader2,
  QrCode,
  Check,
  Clock,
  Calendar,
  Stethoscope,
  Syringe,
  Pill,
  Pencil,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { deletePet } from "@/lib/db";

// Helper to calculate age
function calculateAge(dob: string | null): string {
  if (!dob) return "Age unknown";
  const birthDate = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birthDate.getFullYear();
  const months = now.getMonth() - birthDate.getMonth();
  const adjustedMonths = months < 0 ? 12 + months : months;
  const adjustedYears = months < 0 ? years - 1 : years;
  if (adjustedYears === 0) return `${adjustedMonths} months`;
  if (adjustedMonths === 0) return `${adjustedYears} years`;
  return `${adjustedYears} years ${adjustedMonths} months`;
}

// Helper to calculate days left
function calculateDaysLeft(nextDueDate: string | null): number | undefined {
  if (!nextDueDate) return undefined;
  const due = new Date(nextDueDate);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// Helper to format date as DD MMM YYYY
function formatDate(dateString: string): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Sort pets by DOB (oldest first)
function sortByDOB(pets: Pet[]): Pet[] {
  return [...pets].sort((a, b) => {
    if (!a.date_of_birth) return 1;
    if (!b.date_of_birth) return -1;
    return new Date(a.date_of_birth).getTime() - new Date(b.date_of_birth).getTime();
  });
}

interface VaccineStatusBarProps {
  name: string;
  brandName?: string;
  status: "protected" | "due_soon" | "overdue" | "none";
  percentage: number;
}

function VaccineStatusBar({ name, brandName, status, percentage }: VaccineStatusBarProps) {
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

  // Build display text: "Rabies • Nobivac 3-Rabies" or just "Rabies" if no brand
  const displayText = brandName && status !== "none"
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

function PetsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const petIdFromUrl = searchParams.get('pet');
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [parasiteLog, setParasiteLog] = useState<ParasiteLog | null>(null);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPet, setShowAddPet] = useState(false);
  const [showEditPet, setShowEditPet] = useState(false);
  const [showAddVaccine, setShowAddVaccine] = useState(false);
  const [showAddParasiteLog, setShowAddParasiteLog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeSOSAlert, setActiveSOSAlert] = useState<SOSAlert | null>(null);
  
  // Photo Gallery State
  const [petPhotos, setPetPhotos] = useState<PetPhoto[]>([]);
  const [showPhotoCropper, setShowPhotoCropper] = useState(false);
  const [photoToCrop, setPhotoToCrop] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fetchPets = async (preserveSelection = false) => {
    if (!user) return;
    setLoading(true);
    const { data } = await getPets(user.id);
    const sortedPets = sortByDOB(data || []);
    setPets(sortedPets);

    if (sortedPets.length > 0) {
      // Check if there's a pet ID in the URL
      const urlPetId = petIdFromUrl;
      // If preserving selection, try to find the currently selected pet in the new list
      const currentPetId = selectedPet?.id;
      let petToSelect;
      
      if (urlPetId) {
        // First priority: pet from URL parameter
        petToSelect = sortedPets.find(p => p.id === urlPetId);
      }
      if (!petToSelect && preserveSelection && currentPetId) {
        // Second priority: currently selected pet
        petToSelect = sortedPets.find(p => p.id === currentPetId);
      }
      if (!petToSelect) {
        // Fallback: first pet
        petToSelect = sortedPets[0];
      }

      setSelectedPet(petToSelect);
      await fetchPetDetails(petToSelect.id);
    } else {
      setSelectedPet(null);
    }
    setLoading(false);
  };

  const fetchPetDetails = async (petId: string) => {
    const { data } = await getPetWithDetails(petId);
    if (data) {
      setVaccinations(data.vaccinations || []);
      setParasiteLog(data.latestParasiteLog || null);
      setHealthEvents(data.healthEvents || []);
    }
    // Fetch active SOS alert for this pet
    const { data: sosAlert } = await getActiveSOSAlertForPet(petId);
    setActiveSOSAlert(sosAlert || null);
    
    // Fetch pet photos for gallery
    const { data: photos } = await getPetPhotos(petId);
    setPetPhotos(photos || []);
  };

  const handleSelectPet = async (pet: Pet) => {
    setSelectedPet(pet);
    await fetchPetDetails(pet.id);
  };

  useEffect(() => {
    fetchPets();
  }, [user]);

  const handleSOS = () => {
    if (selectedPet) {
      router.push(`/sos?pet=${selectedPet.id}`);
    }
  };

  const handleDeletePet = async () => {
    if (!selectedPet) return;
    setDeleting(true);
    try {
      const { error } = await deletePet(selectedPet.id);
      if (error) {
        console.error("Delete error:", error);
        alert("Failed to delete pet profile");
        return;
      }
      setShowDeleteConfirm(false);
      setSelectedPet(null);
      fetchPets();
    } catch (error) {
      console.error("Error deleting pet:", error);
      alert("Failed to delete pet profile");
    } finally {
      setDeleting(false);
    }
  };

  const handlePetFound = async (alertId: string) => {
    console.log("handlePetFound called with alertId:", alertId);
    try {
      const { data, error } = await resolveSOSAlert(alertId, "found");
      console.log("resolveSOSAlert result:", { data, error });
      if (!error && selectedPet) {
        await fetchPetDetails(selectedPet.id);
      }
    } catch (e) {
      console.error("handlePetFound error:", e);
    }
  };

  const handleGiveUp = async (alertId: string) => {
    console.log("handleGiveUp called with alertId:", alertId);
    try {
      const { data, error } = await resolveSOSAlert(alertId, "given_up");
      console.log("resolveSOSAlert result:", { data, error });
      if (!error && selectedPet) {
        await fetchPetDetails(selectedPet.id);
      }
    } catch (e) {
      console.error("handleGiveUp error:", e);
    }
  };

  const daysLeft = calculateDaysLeft(parasiteLog?.next_due_date || null);

  // Get core vaccine types for the selected pet's species
  const coreVaccineTypes = selectedPet ? getCoreVaccineTypesBySpecies(selectedPet.species) : [];

  // Get status for a specific core vaccine type
  const getCoreVaccineStatus = (vaccineTypeId: string) => {
    const vaccineType = coreVaccineTypes.find(t => t.id === vaccineTypeId);
    if (!vaccineType) return { status: "none" as const, percentage: 0, brandName: undefined };

    const matchingVaccine = vaccinations.find(v => matchesVaccineType(v.name, vaccineType));
    if (!matchingVaccine) return { status: "none" as const, percentage: 0, brandName: undefined };

    return {
      status: matchingVaccine.status,
      percentage: matchingVaccine.status === "protected" ? 100 : matchingVaccine.status === "due_soon" ? 70 : 30,
      brandName: matchingVaccine.name,
    };
  };

  // Get optional vaccines that have records
  const optionalVaccinesWithRecords = vaccinations.filter(v =>
    selectedPet && isOptionalVaccine(v.name, selectedPet.species)
  );

  // Get status for optional vaccines (aggregate)
  const getOptionalVaccineStatus = () => {
    if (optionalVaccinesWithRecords.length === 0) return null;

    // Find the worst status among optional vaccines
    const hasOverdue = optionalVaccinesWithRecords.some(v => v.status === "overdue");
    const hasDueSoon = optionalVaccinesWithRecords.some(v => v.status === "due_soon");

    // Get brand names (limit to first 2 to avoid overflow)
    const brandNames = optionalVaccinesWithRecords
      .slice(0, 2)
      .map(v => v.name)
      .join(", ");
    const brandName = optionalVaccinesWithRecords.length > 2
      ? `${brandNames} +${optionalVaccinesWithRecords.length - 2} more`
      : brandNames;

    if (hasOverdue) return { status: "overdue" as const, percentage: 30, brandName };
    if (hasDueSoon) return { status: "due_soon" as const, percentage: 70, brandName };
    return { status: "protected" as const, percentage: 100, brandName };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold text-foreground">My Pets</h1>
        <p className="text-sm text-muted-foreground">Pet Passport Dashboard</p>
      </header>

      {/* Content */}
      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        {/* Delete Confirmation Modal Overlay */}
        {showDeleteConfirm && selectedPet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            {/* Modal Content */}
            <Card className="relative p-6 rounded-2xl max-w-sm w-full shadow-2xl">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Delete {selectedPet.name}?</h2>
                <p className="text-muted-foreground mb-6">
                  This will permanently delete this pet profile and all associated data. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 h-12 rounded-xl"
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeletePet}
                    className="flex-1 h-12 rounded-xl bg-destructive hover:bg-destructive/90"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Delete"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Add Vaccine Modal Overlay */}
        {showAddVaccine && selectedPet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAddVaccine(false)}
            />
            {/* Modal Content */}
            <div className="relative max-w-sm w-full">
              <AddVaccineForm
                petId={selectedPet.id}
                petSpecies={selectedPet.species}
                onSuccess={() => {
                  setShowAddVaccine(false);
                  fetchPetDetails(selectedPet.id);
                }}
                onCancel={() => setShowAddVaccine(false)}
              />
            </div>
          </div>
        )}

        {/* Add Parasite Log Modal Overlay */}
        {showAddParasiteLog && selectedPet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAddParasiteLog(false)}
            />
            {/* Modal Content */}
            <div className="relative max-w-sm w-full">
              <AddParasiteLogForm
                petId={selectedPet.id}
                petSpecies={selectedPet.species}
                onSuccess={() => {
                  setShowAddParasiteLog(false);
                  fetchPetDetails(selectedPet.id);
                }}
                onCancel={() => setShowAddParasiteLog(false)}
              />
            </div>
          </div>
        )}

        {showEditPet && selectedPet ? (
          <EditPetForm
            pet={selectedPet}
            onSuccess={() => {
              setShowEditPet(false);
              fetchPets(true); // Preserve selection after edit
            }}
            onCancel={() => setShowEditPet(false)}
            onDelete={() => {
              setShowEditPet(false);
              setSelectedPet(null);
              fetchPets();
            }}
          />
        ) : showAddPet ? (
          <CreatePetForm
            onSuccess={() => {
              setShowAddPet(false);
              fetchPets();
            }}
            onCancel={() => setShowAddPet(false)}
          />
        ) : pets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🐕</span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">No pets yet</h2>
            <p className="text-muted-foreground mb-6">Add your first pet to get started!</p>
            <Button onClick={() => setShowAddPet(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Your Pet
            </Button>
          </div>
        ) : (
          <>
            {/* Pet Selector Chips */}
            <div className={`flex gap-2 pb-2 ${pets.length > 3 ? 'overflow-x-auto hide-scrollbar -mx-4 px-4' : ''}`}>
              {pets.map((pet, index) => {
                // For 1-3 pets: flex-1 to fill width
                // For 4+ pets: fixed smaller size, last visible one partially cut off
                const isSmallChips = pets.length > 3;
                
                return (
                  <button
                    key={pet.id}
                    onClick={() => handleSelectPet(pet)}
                    className={`flex items-center gap-2 rounded-full whitespace-nowrap transition-all ${
                      isSmallChips 
                        ? 'px-2.5 py-1.5 flex-shrink-0' 
                        : 'px-3 py-2 flex-1 justify-center'
                    } ${
                      selectedPet?.id === pet.id
                        ? "bg-primary text-white shadow-md"
                        : "bg-white text-foreground border border-border hover:border-primary"
                    }`}
                    style={isSmallChips ? { minWidth: 'calc(30% - 8px)' } : undefined}
                  >
                    <div className={`rounded-full bg-primary/10 overflow-hidden flex-shrink-0 ${
                      isSmallChips ? 'w-7 h-7' : 'w-8 h-8'
                    }`}>
                      {pet.photo_url ? (
                        <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm">🐕</div>
                      )}
                    </div>
                    <span className={`font-medium ${isSmallChips ? 'text-xs' : 'text-sm'}`}>
                      {isSmallChips && pet.name.length > 6 ? pet.name.slice(0, 6) + '…' : pet.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedPet && (
              <>
                {/* Pet Profile Card */}
                <PetProfileCard
                  pet={selectedPet}
                  activeSOSAlert={activeSOSAlert}
                  photos={petPhotos}
                  onEdit={() => setShowEditPet(true)}
                  onSOS={handleSOS}
                  onPetFound={handlePetFound}
                  onGiveUp={handleGiveUp}
                  onAddPhoto={() => {
                    document.getElementById('photo-upload-input')?.click();
                  }}
                  onDeletePhoto={async (photoId) => {
                    const { error } = await deletePetPhoto(photoId);
                    if (!error && selectedPet) {
                      const { data } = await getPetPhotos(selectedPet.id);
                      setPetPhotos(data || []);
                    }
                  }}
                />
                
                {/* Hidden file input for photo upload */}
                <input
                  id="photo-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPhotoToCrop(URL.createObjectURL(file));
                      setShowPhotoCropper(true);
                    }
                    e.target.value = "";
                  }}
                />
                
                {/* Photo Cropper Modal */}
                {showPhotoCropper && photoToCrop && (
                  <ImageCropper
                    imageSrc={photoToCrop}
                    onCropComplete={async (croppedBlob) => {
                      if (!selectedPet) return;
                      setUploadingPhoto(true);
                      try {
                        const file = new File([croppedBlob], "gallery-photo.jpg", { type: "image/jpeg" });
                        const photoId = `${Date.now()}`;
                        const { data: photoUrl, error: uploadError } = await uploadPetGalleryImage(file, selectedPet.id, photoId);
                        
                        if (uploadError) {
                          console.error("Storage upload error:", uploadError);
                          return;
                        }
                        
                        if (photoUrl) {
                          const currentCount = petPhotos.length;
                          const { error: dbError } = await addPetPhoto(selectedPet.id, photoUrl, currentCount);
                          
                          if (dbError) {
                            console.error("Database insert error:", dbError);
                            return;
                          }
                          
                          const { data } = await getPetPhotos(selectedPet.id);
                          setPetPhotos(data || []);
                        }
                      } catch (err) {
                        console.error("Photo upload failed:", err);
                      } finally {
                        setUploadingPhoto(false);
                        setShowPhotoCropper(false);
                        setPhotoToCrop(null);
                      }
                    }}
                    onCancel={() => {
                      setShowPhotoCropper(false);
                      setPhotoToCrop(null);
                    }}
                    aspectRatio={1}
                    cropShape="rect"
                  />

                )}

                {/* Vaccine ePassport */}
                <Card className="rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Syringe className="w-5 h-5 text-primary" />
                      Vaccine Status
                    </h3>
                    <button
                      onClick={() => setShowAddVaccine(true)}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add vaccine
                    </button>
                  </div>
                  <div className="space-y-4">
                    {/* Core vaccines for this species */}
                    {coreVaccineTypes.map((vaccineType) => (
                      <VaccineStatusBar
                        key={vaccineType.id}
                        name={vaccineType.name}
                        {...getCoreVaccineStatus(vaccineType.id)}
                      />
                    ))}
                    {/* Optional vaccines - only show if there are records */}
                    {optionalVaccinesWithRecords.length > 0 && (
                      <VaccineStatusBar
                        name="Optional"
                        {...getOptionalVaccineStatus()!}
                      />
                    )}
                  </div>
                </Card>

                {/* Parasite Prevention */}
                <Card className="rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Pill className="w-5 h-5 text-primary" />
                      Parasite Prevention
                    </h3>
                    <button
                      onClick={() => setShowAddParasiteLog(true)}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Log
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Circular Timer */}
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle
                          cx="40"
                          cy="40"
                          r="35"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="6"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="35"
                          fill="none"
                          stroke="url(#gradient)"
                          strokeWidth="6"
                          strokeDasharray={`${((daysLeft || 0) / 30) * 220} 220`}
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ec2584" />
                            <stop offset="100%" stopColor="#ffb129" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-foreground">{daysLeft ?? "–"}</span>
                        <span className="text-xs text-muted-foreground">Days</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">
                        {parasiteLog?.medicine_name || "Countdown timer"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {parasiteLog?.administered_date && (
                          <span className="block mb-0.5">
                            Logged date: {formatDate(parasiteLog.administered_date)}
                          </span>
                        )}
                        {parasiteLog?.next_due_date
                          ? `Next dose: ${formatDate(parasiteLog.next_due_date)}`
                          : "No dose recorded yet"}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Health eDashboard */}
                <Card className="rounded-2xl p-4 shadow-sm">
                  <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    Health eDashboard
                  </h3>
                  <div className="text-center py-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl">
                    <Calendar className="w-10 h-10 text-primary/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Coming soon: Connect with clinics for<br />
                      medical records & appointments
                    </p>
                  </div>
                </Card>

                {/* Delete Pet Button - Bottom */}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 mb-4 text-destructive text-sm hover:bg-destructive/5 rounded-xl transition-colors flex items-center justify-center gap-2 relative z-10"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Pet Profile
                </button>
              </>
            )}
          </>
        )}
      </main>

      {/* Floating Add Pet Button */}
      {!showAddPet && !showEditPet && !showAddVaccine && !showAddParasiteLog && pets.length > 0 && (
        <button
          onClick={() => setShowAddPet(true)}
          className="fixed bottom-24 right-4 h-12 px-4 rounded-full bg-primary text-white floating-shadow flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform z-40"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold">Pet</span>
        </button>
      )}

      <BottomNav />
    </div>
  );
}

export default function PetsPage() {
  return <PetsContent />;
}
