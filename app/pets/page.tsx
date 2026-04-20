"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/liff-provider";
import { Button } from "@/components/ui/button";
import { CreatePetForm } from "@/components/create-pet-form";
import { EditPetForm } from "@/components/edit-pet-form";
import { PetProfileCard } from "@/components/pet-profile-card";
import { AddVaccineForm } from "@/components/add-vaccine-form";
import { AddParasiteLogForm } from "@/components/add-parasite-log-form";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/skeleton-card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  getCoreVaccineTypesBySpecies,
  matchesVaccineType,
  isOptionalVaccine,
} from "@/data/vaccines";
import { calculateDaysLeft, formatDate, sortByDOB } from "@/lib/pet-utils";
import { VaccineStatusBar } from "@/components/vaccine-status-bar";
import {
  getPets,
  getPetWithDetails,
  getActivePetReportForPet,
  getPetPhotos,
  uploadPetGalleryImage,
} from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { imageFileSchema } from "@/lib/validations";
import type { Pet, Vaccination, ParasiteLog, HealthEvent, PetReport, PetPhoto } from "@/lib/types";
import { ImageCropper } from "@/components/image-cropper";
import { Plus, Stethoscope, Syringe, Pill, Trash2, Calendar } from "lucide-react";

function PetsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const petIdFromUrl = searchParams.get("pet");
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [parasiteLog, setParasiteLog] = useState<ParasiteLog | null>(null);
  const [, setHealthEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPet, setShowAddPet] = useState(false);
  const [showEditPet, setShowEditPet] = useState(false);
  const [showAddVaccine, setShowAddVaccine] = useState(false);
  const [showAddParasiteLog, setShowAddParasiteLog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activePetReport, setActivePetReport] = useState<PetReport | null>(null);

  const [petPhotos, setPetPhotos] = useState<PetPhoto[]>([]);
  const [showPhotoCropper, setShowPhotoCropper] = useState(false);
  const [photoToCrop, setPhotoToCrop] = useState<string | null>(null);
  const [, setUploadingPhoto] = useState(false);

  const fetchPets = async (preserveSelection = false) => {
    if (!user) return;
    setLoading(true);
    const { data } = await getPets(user.id);
    const sortedPets = sortByDOB(data || []);
    setPets(sortedPets);

    if (sortedPets.length > 0) {
      const urlPetId = petIdFromUrl;
      const currentPetId = selectedPet?.id;
      let petToSelect;

      if (urlPetId) {
        petToSelect = sortedPets.find((p) => p.id === urlPetId);
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
  };

  const fetchPetDetails = async (petId: string) => {
    const { data } = await getPetWithDetails(petId);
    if (data) {
      setVaccinations(data.vaccinations || []);
      setParasiteLog(data.latestParasiteLog || null);
      setHealthEvents(data.healthEvents || []);
    }
    const { data: petReport } = await getActivePetReportForPet(petId);
    setActivePetReport(petReport || null);

    const { data: photos } = await getPetPhotos(petId);
    setPetPhotos(photos || []);
  };

  const handleSelectPet = async (pet: Pet) => {
    setSelectedPet(pet);
    await fetchPetDetails(pet.id);
  };

  useEffect(() => {
    fetchPets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleReport = () => {
    if (selectedPet) {
      router.push(`/post?pet=${selectedPet.id}`);
    }
  };

  const handleDeletePet = async () => {
    if (!selectedPet) return;
    setDeleting(true);
    try {
      await apiFetch("/api/pets", {
        method: "DELETE",
        body: JSON.stringify({ petId: selectedPet.id }),
      });
      setShowDeleteConfirm(false);
      setSelectedPet(null);
      fetchPets();
    } catch (error) {
      console.error("Error deleting pet:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handlePetFound = async (alertId: string) => {
    try {
      await apiFetch("/api/post", {
        method: "PUT",
        body: JSON.stringify({ alertId, resolution: "found" }),
      });
      if (selectedPet) {
        await fetchPetDetails(selectedPet.id);
      }
    } catch (e) {
      console.error("handlePetFound error:", e);
    }
  };

  const handleGiveUp = async (alertId: string) => {
    try {
      await apiFetch("/api/post", {
        method: "PUT",
        body: JSON.stringify({ alertId, resolution: "given_up" }),
      });
      if (selectedPet) {
        await fetchPetDetails(selectedPet.id);
      }
    } catch (e) {
      console.error("handleGiveUp error:", e);
    }
  };

  const daysLeft = calculateDaysLeft(parasiteLog?.next_due_date || null);
  const coreVaccineTypes = selectedPet ? getCoreVaccineTypesBySpecies(selectedPet.species) : [];

  const getCoreVaccineStatus = (vaccineTypeId: string) => {
    const vaccineType = coreVaccineTypes.find((t) => t.id === vaccineTypeId);
    if (!vaccineType) return { status: "none" as const, percentage: 0, brandName: undefined };

    const matchingVaccine = vaccinations.find((v) => matchesVaccineType(v.name, vaccineType));
    if (!matchingVaccine) return { status: "none" as const, percentage: 0, brandName: undefined };

    return {
      status: matchingVaccine.status,
      percentage:
        matchingVaccine.status === "protected"
          ? 100
          : matchingVaccine.status === "due_soon"
            ? 70
            : 30,
      brandName: matchingVaccine.name,
    };
  };

  const optionalVaccinesWithRecords = vaccinations.filter(
    (v) => selectedPet && isOptionalVaccine(v.name, selectedPet.species)
  );

  const getOptionalVaccineStatus = () => {
    if (optionalVaccinesWithRecords.length === 0) return null;

    const hasOverdue = optionalVaccinesWithRecords.some((v) => v.status === "overdue");
    const hasDueSoon = optionalVaccinesWithRecords.some((v) => v.status === "due_soon");

    const brandNames = optionalVaccinesWithRecords
      .slice(0, 2)
      .map((v) => v.name)
      .join(", ");
    const brandName =
      optionalVaccinesWithRecords.length > 2
        ? `${brandNames} +${optionalVaccinesWithRecords.length - 2} อื่น ๆ`
        : brandNames;

    if (hasOverdue) return { status: "overdue" as const, percentage: 30, brandName };
    if (hasDueSoon) return { status: "due_soon" as const, percentage: 70, brandName };
    return { status: "protected" as const, percentage: 100, brandName };
  };

  if (loading) {
    return (
      <div className="min-h-screen-safe">
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-4">
          <h1 className="text-xl font-bold text-text-main">น้องของฉัน</h1>
          <p className="text-xs text-text-muted">กำลังโหลด…</p>
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
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-text-main">น้องของฉัน</h1>
        <p className="text-xs text-text-muted">สมุดพาสปอร์ตน้อง</p>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        <ConfirmDialog
          open={showDeleteConfirm && !!selectedPet}
          title={selectedPet ? `ลบ ${selectedPet.name}?` : ""}
          description="การลบจะเอาข้อมูลน้องและประวัติทั้งหมดออกอย่างถาวร ไม่สามารถย้อนกลับได้"
          confirmLabel="ลบถาวร"
          cancelLabel="ยกเลิก"
          variant="destructive"
          onConfirm={handleDeletePet}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={deleting}
        />

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

        {showEditPet && selectedPet ? (
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
        ) : showAddPet ? (
          <CreatePetForm
            onSuccess={() => {
              setShowAddPet(false);
              fetchPets();
            }}
            onCancel={() => setShowAddPet(false)}
          />
        ) : pets.length === 0 ? (
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
        ) : (
          <>
            <nav
              aria-label="เลือกน้อง"
              className={pets.length > 3 ? "-mx-4 px-4 overflow-x-auto hide-scrollbar" : ""}
            >
              <ul className="flex items-end gap-3 pb-1">
                {pets.map((pet) => {
                  const isActive = selectedPet?.id === pet.id;
                  return (
                    <li key={pet.id} className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectPet(pet)}
                        aria-pressed={isActive}
                        aria-label={pet.name}
                        className="flex flex-col items-center gap-1.5 touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl p-1"
                      >
                        <span
                          className={`relative inline-block w-14 h-14 rounded-full ${
                            isActive
                              ? "bg-pops-gradient p-[3px] shadow-glow"
                              : "bg-surface-alt p-[2px]"
                          }`}
                        >
                          <span
                            className={`block w-full h-full rounded-full overflow-hidden bg-surface ${
                              !isActive ? "opacity-60" : ""
                            }`}
                          >
                            {pet.photo_url ? (
                              <Image
                                src={pet.photo_url}
                                alt=""
                                width={56}
                                height={56}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span
                                className="flex items-center justify-center h-full text-xl"
                                aria-hidden
                              >
                                🐕
                              </span>
                            )}
                          </span>
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            isActive ? "bg-primary text-white" : "bg-surface-alt text-text-subtle"
                          }`}
                        >
                          {pet.name.length > 8 ? pet.name.slice(0, 8) + "…" : pet.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAddPet(true)}
                    aria-label="เพิ่มน้อง"
                    className="flex flex-col items-center gap-1.5 touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl p-1"
                  >
                    <span className="inline-flex w-14 h-14 rounded-full border-2 border-dashed border-border text-text-muted items-center justify-center">
                      <Plus className="w-6 h-6" aria-hidden />
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-surface-alt text-text-subtle">
                      เพิ่ม
                    </span>
                  </button>
                </li>
              </ul>
            </nav>

            {selectedPet && (
              <>
                <PetProfileCard
                  pet={selectedPet}
                  activePetReport={activePetReport}
                  photos={petPhotos}
                  onEdit={() => setShowEditPet(true)}
                  onReport={handleReport}
                  onPetFound={handlePetFound}
                  onGiveUp={handleGiveUp}
                  onAddPhoto={() => {
                    document.getElementById("photo-upload-input")?.click();
                  }}
                  onDeletePhoto={async (photoId) => {
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
                  }}
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

                {showPhotoCropper && photoToCrop && (
                  <ImageCropper
                    imageSrc={photoToCrop}
                    onCropComplete={async (croppedBlob) => {
                      if (!selectedPet) return;
                      setUploadingPhoto(true);
                      try {
                        const file = new File([croppedBlob], "gallery-photo.jpg", {
                          type: "image/jpeg",
                        });
                        const fileResult = imageFileSchema.safeParse({
                          size: file.size,
                          type: file.type,
                        });
                        if (!fileResult.success) {
                          console.error(fileResult.error.issues[0].message);
                          setUploadingPhoto(false);
                          return;
                        }
                        const photoId = `${Date.now()}`;
                        const { data: photoUrl, error: uploadError } = await uploadPetGalleryImage(
                          file,
                          selectedPet.id,
                          photoId
                        );

                        if (uploadError) {
                          console.error("Storage upload error:", uploadError);
                          return;
                        }

                        if (photoUrl) {
                          const currentCount = petPhotos.length;
                          await apiFetch("/api/pet-photos", {
                            method: "POST",
                            body: JSON.stringify({
                              pet_id: selectedPet.id,
                              photo_url: photoUrl,
                              display_order: currentCount,
                            }),
                          });

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

                <section
                  aria-label="สถานะวัคซีน"
                  className="bg-surface border border-border rounded-[24px] shadow-soft p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-text-main flex items-center gap-2">
                      <Syringe className="w-5 h-5 text-primary" aria-hidden />
                      สถานะวัคซีน
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddVaccine(true)}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-bold transition-colors touch-target px-2 -mx-2"
                    >
                      <Plus className="w-4 h-4" aria-hidden />
                      เพิ่ม
                    </button>
                  </div>
                  <div className="space-y-3">
                    {coreVaccineTypes.map((vaccineType) => (
                      <VaccineStatusBar
                        key={vaccineType.id}
                        name={vaccineType.name}
                        {...getCoreVaccineStatus(vaccineType.id)}
                      />
                    ))}
                    {optionalVaccinesWithRecords.length > 0 && (
                      <VaccineStatusBar name="อื่น ๆ" {...getOptionalVaccineStatus()!} />
                    )}
                  </div>
                </section>

                <section
                  aria-label="ยาป้องกันพยาธิ"
                  className="bg-surface border border-border rounded-[24px] shadow-soft p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-text-main flex items-center gap-2">
                      <Pill className="w-5 h-5 text-primary" aria-hidden />
                      ยาป้องกันพยาธิ
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddParasiteLog(true)}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-bold transition-colors touch-target px-2 -mx-2"
                    >
                      <Plus className="w-4 h-4" aria-hidden />
                      บันทึก
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden>
                        <circle
                          cx="40"
                          cy="40"
                          r="35"
                          fill="none"
                          stroke="var(--border)"
                          strokeWidth="6"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="35"
                          fill="none"
                          stroke="url(#parasite-gradient)"
                          strokeWidth="6"
                          strokeDasharray={`${((daysLeft || 0) / 30) * 220} 220`}
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient id="parasite-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--primary)" />
                            <stop offset="100%" stopColor="var(--primary-light)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-text-main">{daysLeft ?? "–"}</span>
                        <span className="text-xs text-text-muted">วัน</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-text-main truncate">
                        {parasiteLog?.medicine_name || "นับถอยหลังครบกำหนด"}
                      </p>
                      <p className="text-sm text-text-muted leading-relaxed">
                        {parasiteLog?.administered_date && (
                          <span className="block">
                            บันทึก: {formatDate(parasiteLog.administered_date)}
                          </span>
                        )}
                        {parasiteLog?.next_due_date
                          ? `ครั้งถัดไป: ${formatDate(parasiteLog.next_due_date)}`
                          : "ยังไม่มีการบันทึก"}
                      </p>
                    </div>
                  </div>
                </section>

                <section
                  aria-label="แดชบอร์ดสุขภาพ"
                  className="bg-surface border border-border rounded-[24px] shadow-soft p-5"
                >
                  <h3 className="font-bold text-text-main mb-3 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-primary" aria-hidden />
                    แดชบอร์ดสุขภาพ
                  </h3>
                  <div className="text-center py-6 bg-gradient-to-br from-primary/5 to-primary-light/5 rounded-2xl">
                    <Calendar className="w-10 h-10 text-primary/50 mx-auto mb-2" aria-hidden />
                    <p className="text-sm text-text-muted leading-relaxed">
                      เร็ว ๆ นี้: เชื่อมต่อคลินิกเพื่อบันทึก
                      <br />
                      ประวัติรักษาและนัดหมายอัตโนมัติ
                    </p>
                  </div>
                </section>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 mt-2 text-danger text-sm font-semibold hover:bg-danger-bg rounded-2xl transition-colors flex items-center justify-center gap-2 touch-target"
                >
                  <Trash2 className="w-4 h-4" aria-hidden />
                  ลบประวัติน้อง
                </button>
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
