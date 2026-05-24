"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/liff-provider";
import { CreatePetForm } from "@/components/create-pet-form";
import { EditPetForm } from "@/components/edit-pet-form";
import { AddVaccineForm } from "@/components/add-vaccine-form";
import { AddParasiteLogForm } from "@/components/add-parasite-log-form";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/skeleton-card";
import { ImageCropper } from "@/components/image-cropper";
import { PetIdCardModal } from "@/components/pet-id-card-modal";
import { PetChipSelector } from "@/components/pets/PetChipSelector";
import { PetHeroCard } from "@/components/pets/PetHeroCard";
import { UrgentActionsCard } from "@/components/pets/UrgentActionsCard";
import type { UrgentItem } from "@/components/pets/UrgentActionsCard";
import { WeightCard } from "@/components/pets/WeightCard";
import { VaccineCard } from "@/components/pets/VaccineCard";
import { ParasiteCard } from "@/components/pets/ParasiteCard";
import { ParasiteBottomSheet } from "@/components/pets/ParasiteBottomSheet";
import { HealthRecordsCard } from "@/components/pets/HealthRecordsCard";
import { MemoriesZone } from "@/components/pets/MemoriesZone";
import { getPets, getPetWithDetails, getPetPhotos, uploadPetGalleryImage } from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { imageFileSchema } from "@/lib/validations";
import { sortByDOB } from "@/lib/pet-utils";
import type {
  Pet,
  Vaccination,
  ParasiteLog,
  HealthEvent,
  PetPhoto,
  DiaryEntry,
} from "@/lib/types/pets";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

function PetsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const petIdFromUrl = searchParams.get("pet");

  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);

  // Pet details
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [parasiteLogs, setParasiteLogs] = useState<ParasiteLog[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [petPhotos, setPetPhotos] = useState<PetPhoto[]>([]);
  const [weightHistory, setWeightHistory] = useState<{ weight: number; recorded_at: string }[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  // UI state
  const [showAddPet, setShowAddPet] = useState(false);
  const [showEditPet, setShowEditPet] = useState(false);
  const [showAddVaccine, setShowAddVaccine] = useState(false);
  const [showAddParasiteLog, setShowAddParasiteLog] = useState(false);
  const [showIdCard, setShowIdCard] = useState(false);
  const [showPhotoCropper, setShowPhotoCropper] = useState(false);
  const [photoToCrop, setPhotoToCrop] = useState<string | null>(null);
  const [bsOpen, setBsOpen] = useState(false);
  const [bsMedicineName, setBsMedicineName] = useState("");
  const [bsLogs, setBsLogs] = useState<ParasiteLog[]>([]);

  const isMemorial = selectedPet?.status === "memorial";

  const fetchPetDetails = useCallback(async (petId: string) => {
    const [detailsRes, photosRes] = await Promise.all([
      getPetWithDetails(petId),
      getPetPhotos(petId),
    ]);

    if (detailsRes.data) {
      setVaccinations(detailsRes.data.vaccinations || []);
      setHealthEvents(detailsRes.data.healthEvents || []);
    }

    setPetPhotos(photosRes.data || []);

    // Fetch all parasite logs (not just latest)
    try {
      const res = await apiFetch(`/api/parasite-logs?pet_id=${petId}`);
      setParasiteLogs(Array.isArray(res) ? res : []);
    } catch {
      setParasiteLogs([]);
    }

    // Fetch weight history
    try {
      const res = await apiFetch(`/api/pet-weight?pet_id=${petId}&limit=12`);
      setWeightHistory(Array.isArray(res) ? res : []);
    } catch {
      setWeightHistory([]);
    }

    // Fetch diary entries for preview
    try {
      const res = await apiFetch(`/api/diary/timeline?pet_id=${petId}&limit=5`);
      setDiaryEntries(Array.isArray(res?.entries) ? res.entries : []);
    } catch {
      setDiaryEntries([]);
    }
  }, []);

  const fetchPets = useCallback(
    async (preserveSelection = false) => {
      if (!user) return;
      setLoading(true);
      const { data } = await getPets(user.id);
      const sortedPets = sortByDOB(data || []);
      setPets(sortedPets);

      if (sortedPets.length > 0) {
        const currentPetId = selectedPet?.id;
        let petToSelect: Pet | undefined;

        if (petIdFromUrl) {
          petToSelect = sortedPets.find((p) => p.id === petIdFromUrl);
        }
        if (!petToSelect && preserveSelection && currentPetId) {
          petToSelect = sortedPets.find((p) => p.id === currentPetId);
        }
        if (!petToSelect) {
          petToSelect = sortedPets[0];
        }

        setSelectedPet(petToSelect);
        await fetchPetDetails(petToSelect.id);
      } else {
        setSelectedPet(null);
      }
      setLoading(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [user, petIdFromUrl, fetchPetDetails]
  );

  useEffect(() => {
    fetchPets();
  }, [fetchPets]);

  const handleSelectPet = async (pet: Pet) => {
    setSelectedPet(pet);
    await fetchPetDetails(pet.id);
  };

  // Compute urgent items
  const urgentItems: UrgentItem[] = [];
  if (selectedPet && !isMemorial) {
    // Overdue vaccines
    vaccinations
      .filter((v) => v.status === "overdue")
      .forEach((v) => {
        urgentItems.push({
          id: `vax-${v.id}`,
          type: "vaccine_overdue",
          title: `ฉีดวัคซีน ${v.name} ให้${selectedPet.name}`,
          detail: "เลยกำหนด",
          severity: "danger",
          onAction: () => setShowAddVaccine(true),
        });
      });

    // Overdue parasites
    parasiteLogs
      .filter((p) => {
        if (!p.next_due_date) return false;
        return new Date(p.next_due_date) < new Date();
      })
      .slice(0, 1)
      .forEach((p) => {
        const days = Math.ceil((Date.now() - new Date(p.next_due_date).getTime()) / 86400000);
        urgentItems.push({
          id: `para-${p.id}`,
          type: "parasite_overdue",
          title: `หยดยาเห็บหมัดให้${selectedPet.name}`,
          detail: `เลยกำหนด ${days} วัน`,
          severity: "danger",
          onAction: () => setShowAddParasiteLog(true),
        });
      });

    // Stale weight
    const latestWeight = weightHistory[0];
    if (latestWeight) {
      const daysSince = Math.ceil(
        (Date.now() - new Date(latestWeight.recorded_at).getTime()) / 86400000
      );
      if (daysSince > 30) {
        urgentItems.push({
          id: "weight-stale",
          type: "weight_stale",
          title: `ชั่งน้ำหนัก${selectedPet.name}`,
          detail: `ครบ ${daysSince} วัน — ควรบันทึกใหม่`,
          severity: "warning",
          onAction: () => {},
        });
      }
    }
  }

  const handlePhotoUpload = async (croppedBlob: Blob) => {
    if (!selectedPet) return;
    try {
      const file = new File([croppedBlob], "gallery-photo.jpg", { type: "image/jpeg" });
      const fileResult = imageFileSchema.safeParse({ size: file.size, type: file.type });
      if (!fileResult.success) return;

      const photoId = `${Date.now()}`;
      const { data: photoUrl, error: uploadError } = await uploadPetGalleryImage(
        file,
        selectedPet.id,
        photoId
      );
      if (uploadError || !photoUrl) return;

      await apiFetch("/api/pet-photos", {
        method: "POST",
        body: JSON.stringify({
          pet_id: selectedPet.id,
          photo_url: photoUrl,
          display_order: petPhotos.length,
        }),
      });

      const { data } = await getPetPhotos(selectedPet.id);
      setPetPhotos(data || []);
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setShowPhotoCropper(false);
      setPhotoToCrop(null);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await apiFetch("/api/pet-photos", {
        method: "DELETE",
        body: JSON.stringify({ photoId }),
      });
      if (selectedPet) {
        const { data } = await getPetPhotos(selectedPet.id);
        setPetPhotos(data || []);
      }
    } catch (e) {
      console.error("Error deleting photo:", e);
    }
  };

  const handleShowFullHistory = (medicineName: string) => {
    const logs = parasiteLogs.filter((l) => l.medicine_name === medicineName);
    setBsMedicineName(medicineName);
    setBsLogs(logs);
    setBsOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen-safe">
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-4">
          <p className="text-xs text-text-muted">โปรไฟล์สัตว์เลี้ยง</p>
          <h1 className="text-xl font-extrabold text-text-main">นายท่านของฉัน 🐾</h1>
        </header>
        <main className="px-4 py-4 max-w-md mx-auto space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen-safe">
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-text-subtle">โปรไฟล์สัตว์เลี้ยง</p>
          <h1 className="text-xl font-extrabold text-text-main">
            นายท่านของ<span className="text-primary">ฉัน</span> 🐾
          </h1>
        </div>
        <Link
          href="/owner"
          className="w-[42px] h-[42px] rounded-full bg-pops-gradient p-[2px] shadow-glow flex-shrink-0"
        >
          <span className="w-full h-full rounded-full bg-surface-alt flex items-center justify-center text-text-muted text-sm">
            👤
          </span>
        </Link>
      </header>

      <main className="px-0 py-4 max-w-md mx-auto space-y-3.5">
        {/* Dialogs */}
        {showAddVaccine && selectedPet && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="ปิด"
              tabIndex={-1}
              onClick={() => setShowAddVaccine(false)}
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            />
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

        {showAddParasiteLog && selectedPet && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="ปิด"
              tabIndex={-1}
              onClick={() => setShowAddParasiteLog(false)}
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            />
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

        {showPhotoCropper && photoToCrop && (
          <ImageCropper
            imageSrc={photoToCrop}
            onCropComplete={handlePhotoUpload}
            onCancel={() => {
              setShowPhotoCropper(false);
              setPhotoToCrop(null);
            }}
            aspectRatio={1}
            cropShape="rect"
          />
        )}

        <PetIdCardModal
          pet={selectedPet ?? { id: "", name: "" }}
          open={showIdCard && !!selectedPet}
          onClose={() => setShowIdCard(false)}
        />

        <ParasiteBottomSheet
          open={bsOpen}
          onClose={() => setBsOpen(false)}
          medicineName={bsMedicineName}
          logs={bsLogs}
        />

        {showEditPet && selectedPet ? (
          <div className="px-4">
            <EditPetForm
              pet={selectedPet}
              onSuccess={() => {
                setShowEditPet(false);
                fetchPets(true);
              }}
              onCancel={() => setShowEditPet(false)}
              onDelete={() => {
                setShowEditPet(false);
                setSelectedPet(null);
                fetchPets();
              }}
            />
          </div>
        ) : showAddPet ? (
          <div className="px-4">
            <CreatePetForm
              onSuccess={() => {
                setShowAddPet(false);
                fetchPets();
              }}
              onCancel={() => setShowAddPet(false)}
            />
          </div>
        ) : pets.length === 0 ? (
          <div className="px-4">
            <EmptyState
              emoji="🐶"
              title="ยังไม่มีน้องในสมุด"
              description="เพิ่มน้องตัวแรกเพื่อเริ่มบันทึกประวัติสุขภาพ"
              action={
                <Button onClick={() => setShowAddPet(true)}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden />
                  เพิ่มน้อง
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Pet Chip Selector */}
            <div className="px-4">
              <PetChipSelector
                pets={pets}
                selectedPetId={selectedPet?.id ?? null}
                onSelect={handleSelectPet}
              />
            </div>

            {selectedPet && (
              <>
                {/* Zone 1: Identity */}
                <PetHeroCard
                  pet={selectedPet}
                  onEdit={() => setShowEditPet(true)}
                  onShowIdCard={() => setShowIdCard(true)}
                />

                {/* Zone 2: Urgent Actions */}
                <UrgentActionsCard items={urgentItems} isMemorial={isMemorial} />

                {/* Zone 3a: Weight */}
                <WeightCard
                  latestWeight={weightHistory.length > 0 ? weightHistory[0] : null}
                  weightHistory={weightHistory}
                  isMemorial={isMemorial}
                />

                {/* Zone 3b: Vaccines */}
                <VaccineCard
                  vaccinations={vaccinations}
                  petSpecies={selectedPet.species || "dog"}
                  isMemorial={isMemorial}
                  onAddVaccine={() => setShowAddVaccine(true)}
                />

                {/* Zone 3c: Parasites */}
                <ParasiteCard
                  parasiteLogs={parasiteLogs}
                  isMemorial={isMemorial}
                  onAddLog={() => setShowAddParasiteLog(true)}
                  onShowFullHistory={handleShowFullHistory}
                />

                {/* Zone 4: Health Records */}
                <HealthRecordsCard healthEvents={healthEvents} isMemorial={isMemorial} />

                {/* Zone 6: Memories */}
                <MemoriesZone
                  petId={selectedPet.id}
                  diaryEntries={diaryEntries}
                  photos={petPhotos}
                  isMemorial={isMemorial}
                  onAddPhoto={() => {
                    document.getElementById("photo-upload-input")?.click();
                  }}
                  onDeletePhoto={handleDeletePhoto}
                />

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

                {/* Zone 7: Utility */}
                <div className="flex gap-2.5 px-4">
                  <Link
                    href={`/pets/${selectedPet.id}/passport`}
                    className="flex-1 py-3 rounded-full text-sm font-semibold text-center flex items-center justify-center gap-1.5 bg-surface border-[1.5px] border-border text-text-muted min-h-[44px]"
                  >
                    📖 พาสปอร์ต
                  </Link>
                  <button
                    type="button"
                    className="flex-1 py-3 rounded-full text-sm font-semibold text-center flex items-center justify-center gap-1.5 bg-surface border-[1.5px] border-border text-text-muted min-h-[44px]"
                  >
                    🔗 แชร์
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function PetsPage() {
  return <PetsContent />;
}
