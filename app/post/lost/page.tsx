"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useAuth } from "@/components/liff-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillTag } from "@/components/ui/pill-tag";
import { SkeletonCard } from "@/components/skeleton-card";
import { EmptyState } from "@/components/empty-state";
import { getPets, getPetPhotos } from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { VoiceRecorder } from "@/components/voice-recorder";
import type { Pet, PetPhoto } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Camera,
  Gift,
  CheckCircle,
  Loader2,
  Share2,
  Link as LinkIcon,
  Clock,
  AlertTriangle,
  Download,
} from "lucide-react";

const MapPicker = dynamic(() => import("@/components/map-picker").then((mod) => mod.MapPicker), {
  ssr: false,
  loading: () => <div className="h-48 bg-surface-alt rounded-[20px] animate-pulse" />,
});

const TOTAL_STEPS = 6;

const STEP_TITLES = ["เลือกน้อง", "เวลา + ที่", "รูปภาพ", "เสียง", "รางวัล", "ตรวจสอบ"];

function getSexLabel(sex: string | null): string {
  if (!sex) return "ไม่ระบุ";
  if (sex === "male") return "ผู้";
  if (sex === "female") return "เมีย";
  return sex;
}

function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const month = months[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;
  return `${day} ${month} ${buddhistYear}`;
}

function WizardHeader({ step, onBack }: { step: number; onBack: () => void }) {
  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={step === 0 ? "ยกเลิก" : "ย้อนกลับ"}
          className="w-10 h-10 rounded-full bg-surface-alt hover:bg-border flex items-center justify-center transition-colors touch-target"
        >
          <ArrowLeft className="w-5 h-5 text-text-main" aria-hidden />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-text-main truncate">แจ้งน้องหาย</h1>
          <p className="text-[11px] text-text-muted">
            ขั้นตอนที่ {step + 1}/{TOTAL_STEPS} · {STEP_TITLES[step]}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary-gradient flex items-center justify-center text-white font-bold text-xs shadow-primary">
          {step + 1}
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label="ความคืบหน้า"
        className="mt-2 h-1 bg-surface-alt rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-primary-gradient transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[9px] font-bold text-text-muted">
        {STEP_TITLES.map((title, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 text-center transition-colors",
              i === step ? "text-primary" : i < step ? "text-text-muted" : "text-text-muted/50"
            )}
          >
            {title}
          </span>
        ))}
      </div>
    </header>
  );
}

function BubbleCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn("bg-surface border border-border rounded-[24px] shadow-soft p-5", className)}
    >
      {children}
    </section>
  );
}

function ShareRow({
  alertId,
  petName,
  locationDescription,
}: {
  alertId: string;
  petName: string;
  locationDescription: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/post/${alertId}` : "";
  const text = `🚨 สัตว์เลี้ยงหาย! ${petName}${locationDescription ? ` · ${locationDescription}` : ""}`;

  const handleLine = async () => {
    try {
      const { isInLiffBrowser } = await import("@/lib/liff");
      if (isInLiffBrowser()) {
        const liff = (await import("@line/liff")).default;
        if (liff.isApiAvailable("shareTargetPicker")) {
          await liff.shareTargetPicker([{ type: "text", text: `${text}\n${url}` }]);
          return;
        }
      }
      window.open(`https://line.me/R/msg/text/?${encodeURIComponent(`${text}\n${url}`)}`, "_blank");
    } catch {
      window.open(`https://line.me/R/msg/text/?${encodeURIComponent(`${text}\n${url}`)}`, "_blank");
    }
  };

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const handleDownload = () => {
    window.open(`/api/share-card/${alertId}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="grid grid-cols-5 gap-2">
      <button
        type="button"
        onClick={handleLine}
        aria-label="แชร์ไปยัง LINE"
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-primary transition-colors touch-target"
      >
        <span className="w-8 h-8 rounded-full bg-[#06C755] flex items-center justify-center text-white text-xs font-bold">
          LINE
        </span>
        <span className="text-[10px] font-bold text-text-muted">LINE</span>
      </button>
      <button
        type="button"
        onClick={handleFacebook}
        aria-label="แชร์ไปยัง Facebook"
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-primary transition-colors touch-target"
      >
        <span className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center text-white text-xs font-bold">
          f
        </span>
        <span className="text-[10px] font-bold text-text-muted">FB</span>
      </button>
      <button
        type="button"
        onClick={handleX}
        aria-label="แชร์ไปยัง X"
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-primary transition-colors touch-target"
      >
        <span className="w-8 h-8 rounded-full bg-text-main flex items-center justify-center text-white text-xs font-bold">
          X
        </span>
        <span className="text-[10px] font-bold text-text-muted">X</span>
      </button>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-primary transition-colors touch-target"
      >
        <span className="w-8 h-8 rounded-full bg-surface-alt flex items-center justify-center text-text-main">
          {copied ? (
            <CheckCircle className="w-4 h-4 text-success" />
          ) : (
            <LinkIcon className="w-4 h-4" />
          )}
        </span>
        <span className="text-[10px] font-bold text-text-muted">
          {copied ? "คัดลอก✓" : "คัดลอก"}
        </span>
      </button>
      <button
        type="button"
        onClick={handleDownload}
        aria-label="ดาวน์โหลดโปสเตอร์"
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-primary transition-colors touch-target"
      >
        <span className="w-8 h-8 rounded-full bg-primary-gradient flex items-center justify-center text-white shadow-primary">
          <Download className="w-4 h-4" />
        </span>
        <span className="text-[10px] font-bold text-text-muted">โปสเตอร์</span>
      </button>
    </div>
  );
}

export default function LostWizardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPetId = searchParams.get("pet_id") || searchParams.get("pet");

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAlertId, setSubmittedAlertId] = useState<string | null>(null);

  // Step 1: Pet selection
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [loadingPets, setLoadingPets] = useState(true);

  // Step 2: When & Where
  const [lostDate, setLostDate] = useState(new Date().toISOString().split("T")[0]);
  const [lostTime, setLostTime] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDescription, setLocationDescription] = useState("");

  // Step 3: Photos & Details
  const [petPhotos, setPetPhotos] = useState<PetPhoto[]>([]);
  const [distinguishingMarks, setDistinguishingMarks] = useState("");
  const [description, setDescription] = useState("");

  // Step 4: Voice Recording
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceConsent, setVoiceConsent] = useState(false);

  // Step 5: Reward & Contact
  const [rewardAmount, setRewardAmount] = useState(0);
  const [rewardNote, setRewardNote] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);

  const selectedPet = pets.find((p) => p.id === selectedPetId);

  useEffect(() => {
    if (!user) return;
    setLoadingPets(true);
    getPets(user.id).then(({ data }) => {
      const petList = data || [];
      setPets(petList);
      if (preselectedPetId && petList.some((p) => p.id === preselectedPetId)) {
        setSelectedPetId(preselectedPetId);
        setStep(1);
      } else if (petList.length > 0) {
        setSelectedPetId(petList[0].id);
      }
      setLoadingPets(false);
    });
  }, [user, preselectedPetId]);

  useEffect(() => {
    if (!selectedPetId) return;
    getPetPhotos(selectedPetId).then(({ data }) => {
      setPetPhotos(data || []);
    });
  }, [selectedPetId]);

  useEffect(() => {
    if (selectedPet?.special_notes) {
      setDescription(selectedPet.special_notes);
    }
  }, [selectedPet]);

  const photoUrls = [
    ...(selectedPet?.photo_url ? [selectedPet.photo_url] : []),
    ...petPhotos.map((p) => p.photo_url),
  ].filter((url, index, arr) => arr.indexOf(url) === index);

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return !!selectedPetId;
      case 1:
        return !!lostDate && !!location;
      case 2:
        return photoUrls.length > 0;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1 && canProceed()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedPetId || !location) return;
    setSubmitting(true);

    try {
      const body = {
        pet_id: selectedPetId,
        lost_date: lostDate,
        lost_time: lostTime || undefined,
        lat: location.lat,
        lng: location.lng,
        location_description: locationDescription || undefined,
        description: description || undefined,
        distinguishing_marks: distinguishingMarks || undefined,
        photo_urls: photoUrls.slice(0, 5),
        reward_amount: rewardAmount,
        reward_note: rewardNote || undefined,
        contact_phone: showPhone ? contactPhone || undefined : undefined,
      };

      const result = await apiFetch("/api/post", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const alertId = result.id || result.data?.id || null;
      setSubmittedAlertId(alertId);

      if (voiceBlob && alertId && voiceConsent) {
        try {
          const voiceForm = new FormData();
          voiceForm.append("audio", voiceBlob, "recording.webm");
          voiceForm.append("alert_id", alertId);
          await apiFetch("/api/voice", {
            method: "POST",
            body: voiceForm,
          });
        } catch (voiceErr) {
          console.error("Voice upload failed:", voiceErr);
        }
      }

      setSubmitted(true);
    } catch (error) {
      console.error("Error creating alert:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen — mascot + share row
  if (submitted && submittedAlertId) {
    return (
      <div className="min-h-screen-safe">
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3">
          <h1 className="text-base font-bold text-success">ส่งประกาศเรียบร้อย!</h1>
        </header>
        <main className="px-4 py-8 max-w-md mx-auto space-y-5">
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-pops-gradient animate-pulse shadow-glow" />
              <div className="relative w-full h-full rounded-full bg-surface flex items-center justify-center">
                <span className="text-5xl" aria-hidden>
                  🐕
                </span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-main mb-2">ประกาศถูกส่งแล้ว!</h2>
            <p className="text-sm text-text-muted leading-relaxed max-w-xs mx-auto">
              คนรักสัตว์ใกล้เคียงจะได้รับแจ้งเตือน
              <br />
              สู้ ๆ นะคะ เดี๋ยวน้องก็กลับบ้าน 💪
            </p>
          </div>

          <BubbleCard>
            <h3 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" aria-hidden />
              แชร์ประกาศช่วยกัน
            </h3>
            <ShareRow
              alertId={submittedAlertId}
              petName={selectedPet?.name || "น้อง"}
              locationDescription={locationDescription}
            />
          </BubbleCard>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/post/${submittedAlertId}`)}
              className="w-full"
            >
              ดูประกาศ
            </Button>
            <Button onClick={() => router.push("/post")} className="w-full">
              กลับหน้าประกาศ
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen-safe pb-32">
      <WizardHeader step={step} onBack={handleBack} />

      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        {/* Step 1: Select Pet */}
        {step === 0 && (
          <BubbleCard>
            <h2 className="text-lg font-bold text-text-main mb-4">เลือกน้องที่หาย</h2>

            {loadingPets ? (
              <div className="space-y-3">
                <SkeletonCard lines={2} className="p-3" />
                <SkeletonCard lines={2} className="p-3" />
              </div>
            ) : pets.length === 0 ? (
              <EmptyState
                emoji="🐶"
                title="ยังไม่มีน้องในระบบ"
                description="กรุณาเพิ่มข้อมูลน้องก่อนจึงจะแจ้งหายได้"
                action={<Button onClick={() => router.push("/pets")}>เพิ่มน้อง</Button>}
              />
            ) : (
              <div className="space-y-2.5">
                {pets.map((pet) => {
                  const isActive = selectedPetId === pet.id;
                  return (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() => setSelectedPetId(pet.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all touch-target",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isActive
                          ? "border-primary bg-gradient-to-r from-primary/10 to-primary-light/10 shadow-[0_4px_14px_rgba(255,130,99,0.15)]"
                          : "border-border bg-surface hover:border-primary/50"
                      )}
                    >
                      <div
                        className={cn(
                          "relative w-14 h-14 rounded-full flex-shrink-0 p-[2px]",
                          isActive ? "bg-pops-gradient shadow-glow" : "bg-surface-alt"
                        )}
                      >
                        <div className="w-full h-full rounded-full bg-surface overflow-hidden">
                          {pet.photo_url ? (
                            <Image
                              src={pet.photo_url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center text-2xl"
                              aria-hidden
                            >
                              {pet.species === "cat" ? "🐱" : "🐕"}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-bold text-text-main text-sm truncate">{pet.name}</p>
                        <p className="text-[11px] text-text-muted truncate">
                          {[pet.breed, getSexLabel(pet.sex), pet.color].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                          isActive
                            ? "bg-primary-gradient text-white shadow-primary"
                            : "border-2 border-border bg-surface"
                        )}
                      >
                        {isActive && <CheckCircle className="w-4 h-4" aria-hidden />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </BubbleCard>
        )}

        {/* Step 2: When & Where */}
        {step === 1 && (
          <>
            <BubbleCard>
              <h2 className="text-lg font-bold text-text-main mb-4">เวลาและสถานที่</h2>
              <div className="space-y-3">
                <div>
                  <Label className="text-text-main font-bold flex items-center gap-2 mb-1.5">
                    <Clock className="w-4 h-4 text-primary" aria-hidden />
                    วันที่น้องหาย *
                  </Label>
                  <Input
                    type="date"
                    value={lostDate}
                    onChange={(e) => setLostDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div>
                  <Label className="text-text-main font-bold mb-1.5 block">
                    เวลาโดยประมาณ (ไม่บังคับ)
                  </Label>
                  <Input
                    type="time"
                    value={lostTime}
                    onChange={(e) => setLostTime(e.target.value)}
                    placeholder="ประมาณกี่โมง"
                  />
                </div>
              </div>
            </BubbleCard>

            <BubbleCard>
              <Label className="text-text-main font-bold flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-danger" aria-hidden />
                ตำแหน่งที่เห็นครั้งสุดท้าย *
              </Label>
              <div className="rounded-[20px] overflow-hidden border border-border-subtle">
                <MapPicker onLocationSelect={(lat, lng) => setLocation({ lat, lng })} />
              </div>
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                {location ? (
                  <span className="inline-flex items-center gap-1 text-success font-bold">
                    <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                    ระบุตำแหน่งแล้ว · {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                ) : (
                  "แตะบนแผนที่เพื่อระบุตำแหน่งที่เห็นน้องครั้งสุดท้าย"
                )}
              </p>

              <div className="mt-3">
                <Label className="text-text-main font-bold mb-1.5 block">
                  สถานที่หรือจุดสังเกตใกล้เคียง
                </Label>
                <textarea
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                  placeholder="เช่น หมู่บ้านอริสรา 2, ใกล้ รร.สารสาสน์วิเทศบางบัวทอง"
                  className="w-full p-3 border border-border rounded-[20px] bg-surface text-text-main min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  maxLength={500}
                />
              </div>
            </BubbleCard>
          </>
        )}

        {/* Step 3: Photos & Details (emergency markers) */}
        {step === 2 && (
          <>
            <BubbleCard>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-text-main font-bold flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" aria-hidden />
                  รูปภาพประกาศฉุกเฉิน
                </Label>
                <PillTag className="bg-danger-bg text-danger">
                  <AlertTriangle className="w-3 h-3" aria-hidden />
                  {photoUrls.length}/5 ภาพ
                </PillTag>
              </div>

              {photoUrls.length > 0 ? (
                <div className="grid grid-cols-5 gap-2">
                  {photoUrls.slice(0, 5).map((url, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-2xl overflow-hidden border-2 border-border"
                    >
                      <Image
                        src={url}
                        alt={`รูปที่ ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                      <div className="absolute top-1 left-1 bg-danger text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <span aria-hidden>🚨</span>
                        {i + 1}
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 5 - photoUrls.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      aria-hidden
                      className="aspect-square rounded-2xl border-2 border-dashed border-border-subtle bg-surface-alt flex items-center justify-center text-border"
                    >
                      <Camera className="w-4 h-4" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  ไม่พบรูปภาพในโปรไฟล์น้อง กรุณาเพิ่มรูปในหน้าน้องก่อน
                </p>
              )}
              <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
                รูปจากโปรไฟล์ของน้องจะถูกใช้อัตโนมัติเพื่อช่วยให้คนจำน้องได้
              </p>
            </BubbleCard>

            <BubbleCard>
              <Label className="text-text-main font-bold mb-2 block">จุดสังเกต / ลักษณะเฉพาะ</Label>
              <textarea
                value={distinguishingMarks}
                onChange={(e) => setDistinguishingMarks(e.target.value)}
                placeholder={`จุดสังเกตที่ช่วยให้คนอื่นจำน้องได้ เช่น:\n• ปลอกคอสีแดง มีกระดิ่ง\n• ทำหมันแล้ว\n• มีแผลเป็นที่หูซ้าย\n• ชอบเข้าหาคน ไม่กัด`}
                className="w-full p-3 border border-border rounded-[20px] bg-surface text-text-main min-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm leading-relaxed"
                maxLength={2000}
              />
            </BubbleCard>

            <BubbleCard>
              <Label className="text-text-main font-bold mb-2 block">
                รายละเอียดเพิ่มเติม (ไม่บังคับ)
              </Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น น้องหลุดจากปลอกคอตอนพาไปเดินเล่น..."
                className="w-full p-3 border border-border rounded-[20px] bg-surface text-text-main min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                maxLength={2000}
              />
            </BubbleCard>
          </>
        )}

        {/* Step 4: Voice Recording */}
        {step === 3 && (
          <BubbleCard>
            <h2 className="text-lg font-bold text-text-main mb-2">บันทึกเสียงเรียกน้อง</h2>
            <p className="text-sm text-text-muted mb-4 leading-relaxed">
              บันทึกเสียงเรียกชื่อน้อง{selectedPet?.name ? ` "${selectedPet.name}"` : ""} —
              เสียงของเจ้าของจะช่วยให้คนที่พบน้องเรียกน้องกลับมาได้
            </p>
            <VoiceRecorder
              onRecordingChange={setVoiceBlob}
              consentGiven={voiceConsent}
              onConsentChange={setVoiceConsent}
            />
            <p className="text-[11px] text-text-muted text-center mt-3">
              ข้ามขั้นตอนนี้ได้ · กดถัดไปเพื่อดำเนินการต่อ
            </p>
          </BubbleCard>
        )}

        {/* Step 5: Reward & Contact */}
        {step === 4 && (
          <>
            <BubbleCard>
              <Label className="text-text-main font-bold flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-warning" aria-hidden />
                รางวัลนำส่งคืน (ไม่บังคับ)
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-text-main">฿</span>
                <Input
                  type="number"
                  value={rewardAmount || ""}
                  onChange={(e) =>
                    setRewardAmount(Math.min(1000000, Math.max(0, Number(e.target.value))))
                  }
                  placeholder="0"
                  min={0}
                  max={1000000}
                />
              </div>
              <p className="text-[11px] text-text-muted mt-2">รางวัลจะแสดงอย่างเด่นชัดบนประกาศ</p>

              <div className="mt-3">
                <Label className="text-text-main font-bold mb-1.5 block">
                  หมายเหตุรางวัล (ไม่บังคับ)
                </Label>
                <Input
                  value={rewardNote}
                  onChange={(e) => setRewardNote(e.target.value)}
                  placeholder="เช่น ตามเหมาะสม, ขอบคุณมากค่ะ"
                  maxLength={200}
                />
              </div>
            </BubbleCard>

            <BubbleCard>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="showPhone"
                  checked={showPhone}
                  onChange={(e) => setShowPhone(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded accent-primary"
                />
                <div className="flex-1">
                  <Label htmlFor="showPhone" className="text-text-main font-bold">
                    แสดงเบอร์โทรบนโปสเตอร์?
                  </Label>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                    แนะนำเพื่อให้คนติดต่อได้เร็วขึ้น · เบอร์ไม่แสดงบนหน้าเว็บ
                  </p>
                </div>
              </div>
              {showPhone && (
                <div className="mt-3">
                  <Input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="เบอร์โทรศัพท์"
                    maxLength={20}
                  />
                </div>
              )}
            </BubbleCard>
          </>
        )}

        {/* Step 6: Review & Submit */}
        {step === 5 && (
          <BubbleCard>
            <h2 className="text-lg font-bold text-text-main mb-4">ตรวจสอบก่อนส่ง</h2>

            <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
              <div className="relative w-14 h-14 rounded-full bg-pops-gradient p-[2px] shadow-glow flex-shrink-0">
                <div className="w-full h-full rounded-full bg-surface overflow-hidden">
                  {selectedPet?.photo_url ? (
                    <Image
                      src={selectedPet.photo_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-2xl"
                      aria-hidden
                    >
                      {selectedPet?.species === "cat" ? "🐱" : "🐕"}
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-text-main">{selectedPet?.name}</p>
                <p className="text-[11px] text-text-muted truncate">
                  {[selectedPet?.breed, getSexLabel(selectedPet?.sex || null), selectedPet?.color]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            <dl className="space-y-2.5 text-sm pt-3">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">วันที่หาย</dt>
                <dd className="text-text-main font-bold text-right">{formatThaiDate(lostDate)}</dd>
              </div>
              {lostTime && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">เวลา</dt>
                  <dd className="text-text-main font-bold">{lostTime} น.</dd>
                </div>
              )}
              {location && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted flex-shrink-0">ตำแหน่ง</dt>
                  <dd className="text-text-main font-bold text-right truncate max-w-[60%]">
                    {locationDescription ||
                      `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">รูปภาพ</dt>
                <dd className="text-text-main font-bold">{photoUrls.length} รูป</dd>
              </div>
              {distinguishingMarks && (
                <div>
                  <dt className="text-text-muted text-xs mb-1">จุดสังเกต</dt>
                  <dd className="text-text-main text-xs whitespace-pre-line leading-relaxed bg-surface-alt rounded-2xl p-3">
                    {distinguishingMarks}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">เสียงเจ้าของ</dt>
                <dd className="text-text-main font-bold">
                  {voiceBlob ? "มีบันทึกเสียง" : "ไม่มี"}
                </dd>
              </div>
              {rewardAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">รางวัล</dt>
                  <dd className="text-warning font-bold">฿{rewardAmount.toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </BubbleCard>
        )}
      </main>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur-md border-t border-border p-4 safe-area-bottom z-30">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="outline" onClick={handleBack} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-1" aria-hidden />
            {step === 0 ? "ยกเลิก" : "ย้อนกลับ"}
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()} className="flex-1">
              ถัดไป
              <ArrowRight className="w-4 h-4 ml-1" aria-hidden />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              variant="destructive"
              className="flex-1"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-1" aria-hidden />
                  ส่งประกาศ
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
