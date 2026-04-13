"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useAuth } from "@/components/liff-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPets, getPetPhotos } from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Pet, PetPhoto } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Camera,
  Mic,
  Gift,
  CheckCircle,
  Loader2,
  Share2,
  Link as LinkIcon,
  Clock,
} from "lucide-react";

const MapPicker = dynamic(() => import("@/components/map-picker").then((mod) => mod.MapPicker), {
  ssr: false,
  loading: () => <div className="h-48 bg-muted rounded-xl animate-pulse" />,
});

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "เลือกสัตว์เลี้ยง",
  "สถานที่และเวลา",
  "รูปภาพและรายละเอียด",
  "บันทึกเสียง",
  "รางวัลและการติดต่อ",
  "ตรวจสอบและส่ง",
];

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

// Progress dots component
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-colors",
            i === current ? "bg-primary scale-110" : i < current ? "bg-primary/40" : "bg-gray-200"
          )}
        />
      ))}
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
  const [linkCopied, setLinkCopied] = useState(false);

  // Step 1: Pet selection
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [loadingPets, setLoadingPets] = useState(true);

  // Step 2: When & Where
  const [lostDate, setLostDate] = useState(new Date().toISOString().split("T")[0]);
  const [lostTime, setLostTime] = useState("");
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationDescription, setLocationDescription] = useState("");

  // Step 3: Photos & Details
  const [petPhotos, setPetPhotos] = useState<PetPhoto[]>([]);
  const [distinguishingMarks, setDistinguishingMarks] = useState("");
  const [description, setDescription] = useState("");

  // Step 5: Reward & Contact
  const [rewardAmount, setRewardAmount] = useState(0);
  const [rewardNote, setRewardNote] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);

  const selectedPet = pets.find((p) => p.id === selectedPetId);

  // Load user's pets
  useEffect(() => {
    if (!user) return;
    setLoadingPets(true);
    getPets(user.id).then(({ data }) => {
      const petList = data || [];
      setPets(petList);
      if (preselectedPetId && petList.some((p) => p.id === preselectedPetId)) {
        setSelectedPetId(preselectedPetId);
        // If preselected, skip to step 2
        setStep(1);
      } else if (petList.length > 0) {
        setSelectedPetId(petList[0].id);
      }
      setLoadingPets(false);
    });
  }, [user, preselectedPetId]);

  // Load pet photos when pet changes
  useEffect(() => {
    if (!selectedPetId) return;
    getPetPhotos(selectedPetId).then(({ data }) => {
      setPetPhotos(data || []);
    });
  }, [selectedPetId]);

  // Pre-fill description from pet's special_notes
  useEffect(() => {
    if (selectedPet?.special_notes) {
      setDescription(selectedPet.special_notes);
    }
  }, [selectedPet]);

  const photoUrls = [
    ...(selectedPet?.photo_url ? [selectedPet.photo_url] : []),
    ...petPhotos.map((p) => p.photo_url),
  ].filter((url, index, arr) => arr.indexOf(url) === index); // deduplicate

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return !!selectedPetId;
      case 1:
        return !!lostDate && !!location;
      case 2:
        return photoUrls.length > 0;
      case 3:
        return true; // voice is placeholder, always skippable
      case 4:
        return true; // reward is optional
      case 5:
        return true; // review step
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

      setSubmittedAlertId(result.id || result.data?.id || null);
      setSubmitted(true);
    } catch (error) {
      console.error("Error creating alert:", error);
      alert("เกิดข้อผิดพลาดในการส่งประกาศ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    try {
      const { isInLiffBrowser } = await import("@/lib/liff");
      if (isInLiffBrowser()) {
        const liff = (await import("@line/liff")).default;
        if (liff.isApiAvailable("shareTargetPicker")) {
          await liff.shareTargetPicker([
            {
              type: "text",
              text: `🚨 สัตว์เลี้ยงหาย! ${selectedPet?.name || ""}\n${locationDescription || ""}\nดูรายละเอียด: ${window.location.origin}/post/${submittedAlertId}`,
            },
          ]);
        }
      }
    } catch {
      // Fallback: do nothing if LIFF not available
    }
  };

  const handleCopyLink = async () => {
    if (!submittedAlertId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${submittedAlertId}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard may not be available
    }
  };

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-30 bg-green-600 text-white px-4 py-3">
          <h1 className="text-xl font-bold">ส่งประกาศเรียบร้อย!</h1>
        </header>
        <main className="px-4 py-12 max-w-md mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">ประกาศถูกส่งแล้ว!</h2>
          <p className="text-muted-foreground mb-6">
            คนเลี้ยงสัตว์ใกล้เคียงจะได้รับแจ้งเตือน สู้ๆ นะคะ!
          </p>

          {/* Share buttons */}
          <div className="space-y-3 mb-6">
            <Button
              onClick={handleShare}
              className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold"
            >
              <Share2 className="w-5 h-5 mr-2" />
              แชร์ผ่าน LINE
            </Button>
            <Button onClick={handleCopyLink} variant="outline" className="w-full h-12">
              <LinkIcon className="w-5 h-5 mr-2" />
              {linkCopied ? "คัดลอกแล้ว!" : "คัดลอกลิงก์"}
            </Button>
          </div>

          <Button onClick={() => router.push("/post")} variant="outline" className="w-full">
            กลับหน้าประกาศ
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-destructive text-white px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={handleBack} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">แจ้งสัตว์เลี้ยงหาย</h1>
            <p className="text-xs opacity-80">
              ขั้นตอนที่ {step + 1}/{TOTAL_STEPS}: {STEP_TITLES[step]}
            </p>
          </div>
        </div>
      </header>

      <ProgressDots current={step} total={TOTAL_STEPS} />

      <main className="px-4 max-w-md mx-auto">
        {/* Step 1: Select Pet */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">เลือกสัตว์เลี้ยงที่หาย</h2>

            {loadingPets ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : pets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  คุณยังไม่มีสัตว์เลี้ยงในระบบ กรุณาเพิ่มข้อมูลสัตว์เลี้ยงก่อน
                </p>
                <Button onClick={() => router.push("/pets")}>เพิ่มสัตว์เลี้ยง</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPetId(pet.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
                      selectedPetId === pet.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-white hover:border-primary/50"
                    )}
                  >
                    <div className="relative w-14 h-14 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {pet.photo_url ? (
                        <Image
                          src={pet.photo_url}
                          alt={pet.name}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {pet.species === "cat" ? "🐱" : "🐕"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-foreground text-sm">{pet.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[pet.breed, getSexLabel(pet.sex), pet.color].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        selectedPetId === pet.id ? "border-primary bg-primary" : "border-gray-300"
                      )}
                    >
                      {selectedPetId === pet.id && (
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: When & Where */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">สถานที่และเวลาที่หาย</h2>

            {/* Date */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-primary" />
                วันที่หาย *
              </Label>
              <Input
                type="date"
                value={lostDate}
                onChange={(e) => setLostDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="rounded-xl"
              />
            </Card>

            {/* Time */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold mb-2 block">
                เวลาโดยประมาณ (ไม่บังคับ)
              </Label>
              <Input
                type="time"
                value={lostTime}
                onChange={(e) => setLostTime(e.target.value)}
                className="rounded-xl"
                placeholder="ประมาณกี่โมง"
              />
            </Card>

            {/* Map */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-destructive" />
                ตำแหน่งที่เห็นครั้งสุดท้าย *
              </Label>
              <MapPicker onLocationSelect={(lat, lng) => setLocation({ lat, lng })} />
              <p className="text-xs text-muted-foreground mt-2">
                {location
                  ? `📍 ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                  : "แตะบนแผนที่เพื่อระบุตำแหน่ง"}
              </p>
            </Card>

            {/* Location description */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold mb-2 block">
                ระบุสถานที่หรือจุดสังเกตใกล้เคียง
              </Label>
              <textarea
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                placeholder="เช่น หมู่บ้านอริสรา 2, ใกล้ รร.สารสนวิทศน์ บางบัวทอง"
                className="w-full p-3 border border-border rounded-xl bg-background text-foreground min-h-[80px] resize-none"
                maxLength={500}
              />
            </Card>
          </div>
        )}

        {/* Step 3: Photos & Details */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">รูปภาพและรายละเอียด</h2>

            {/* Photos from pet profile */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-primary" />
                รูปภาพ ({photoUrls.length}/5) *
              </Label>
              {photoUrls.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                  {photoUrls.slice(0, 5).map((url, i) => (
                    <div
                      key={i}
                      className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-border"
                    >
                      <Image
                        src={url}
                        alt={`รูปที่ ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ไม่พบรูปภาพในโปรไฟล์สัตว์เลี้ยง กรุณาเพิ่มรูปภาพ
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                รูปภาพจากโปรไฟล์ของน้องจะถูกใช้อัตโนมัติ
              </p>
            </Card>

            {/* Distinguishing marks */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold mb-2 block">
                จุดสังเกต / ลักษณะเฉพาะ
              </Label>
              <textarea
                value={distinguishingMarks}
                onChange={(e) => setDistinguishingMarks(e.target.value)}
                placeholder={`จุดสังเกตที่ช่วยให้คนอื่นจำน้องได้ เช่น:\n• ปลอกคอสีแดง มีกระดิ่ง\n• ทำหมันแล้ว\n• มีแผลเป็นที่หูซ้าย\n• ชอบเข้าหาคน ไม่กัด\n• ใส่เสื้อลายทาง\n• สุขภาพปกติ / มีโรคประจำตัว`}
                className="w-full p-3 border border-border rounded-xl bg-background text-foreground min-h-[140px] resize-none"
                maxLength={2000}
              />
            </Card>

            {/* Additional description */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold mb-2 block">
                รายละเอียดเพิ่มเติม (ไม่บังคับ)
              </Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น น้องหลุดจากปลอกคอตอนพาไปเดินเล่น..."
                className="w-full p-3 border border-border rounded-xl bg-background text-foreground min-h-[80px] resize-none"
                maxLength={2000}
              />
            </Card>
          </div>
        )}

        {/* Step 4: Voice Recording (Placeholder) */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">บันทึกเสียง</h2>

            <Card className="p-6 rounded-xl text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-primary/40" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">เร็วๆ นี้!</h3>
              <p className="text-sm text-muted-foreground mb-1">บันทึกเสียงเรียกน้อง</p>
              <p className="text-xs text-muted-foreground">
                เสียงของเจ้าของจะช่วยให้คนที่พบน้องเรียกน้องกลับมาได้
              </p>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              คุณสามารถข้ามขั้นตอนนี้ได้ กดถัดไปเพื่อดำเนินการต่อ
            </p>
          </div>
        )}

        {/* Step 5: Reward & Contact */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">รางวัลและการติดต่อ</h2>

            {/* Reward amount */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-amber-500" />
                รางวัลนำจับ (ไม่บังคับ)
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">฿</span>
                <Input
                  type="number"
                  value={rewardAmount || ""}
                  onChange={(e) =>
                    setRewardAmount(Math.min(1000000, Math.max(0, Number(e.target.value))))
                  }
                  placeholder="0"
                  className="rounded-xl"
                  min={0}
                  max={1000000}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">รางวัลจะแสดงอย่างเด่นชัดบนประกาศ</p>
            </Card>

            {/* Reward note */}
            <Card className="p-4 rounded-xl">
              <Label className="text-foreground font-semibold mb-2 block">
                หมายเหตุรางวัล (ไม่บังคับ)
              </Label>
              <Input
                value={rewardNote}
                onChange={(e) => setRewardNote(e.target.value)}
                placeholder="เช่น ตามเหมาะสม, ขอบคุณมากค่ะ"
                className="rounded-xl"
                maxLength={200}
              />
            </Card>

            {/* Contact phone */}
            <Card className="p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="showPhone"
                  checked={showPhone}
                  onChange={(e) => setShowPhone(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded accent-primary"
                />
                <div className="flex-1">
                  <Label htmlFor="showPhone" className="text-foreground font-semibold">
                    แสดงเบอร์โทรบนโปสเตอร์และรูปแชร์?
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    แนะนำเพื่อให้ติดต่อได้เร็วขึ้น (ไม่แสดงบนหน้าเว็บ)
                  </p>
                </div>
              </div>
              {showPhone && (
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="เบอร์โทรศัพท์"
                  className="rounded-xl mt-3"
                  maxLength={20}
                />
              )}
            </Card>
          </div>
        )}

        {/* Step 6: Review & Submit */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">ตรวจสอบและส่งประกาศ</h2>

            <Card className="p-4 rounded-xl space-y-3">
              {/* Pet info */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-muted flex-shrink-0">
                  {selectedPet?.photo_url ? (
                    <Image
                      src={selectedPet.photo_url}
                      alt={selectedPet.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {selectedPet?.species === "cat" ? "🐱" : "🐕"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-foreground">{selectedPet?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[selectedPet?.breed, getSexLabel(selectedPet?.sex || null), selectedPet?.color]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>

              <hr className="border-border" />

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">วันที่หาย</span>
                  <span className="text-foreground font-medium">{formatThaiDate(lostDate)}</span>
                </div>
                {lostTime && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">เวลาประมาณ</span>
                    <span className="text-foreground font-medium">{lostTime} น.</span>
                  </div>
                )}
                {location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ตำแหน่ง</span>
                    <span className="text-foreground font-medium text-right">
                      {locationDescription ||
                        `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">รูปภาพ</span>
                  <span className="text-foreground font-medium">{photoUrls.length} รูป</span>
                </div>
                {distinguishingMarks && (
                  <div>
                    <span className="text-muted-foreground">จุดสังเกต:</span>
                    <p className="text-foreground mt-1 text-xs whitespace-pre-line">
                      {distinguishingMarks}
                    </p>
                  </div>
                )}
                {rewardAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">รางวัลนำจับ</span>
                    <span className="text-amber-600 font-bold">
                      ฿{rewardAmount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-border p-4 safe-area-bottom z-30">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="outline" onClick={handleBack} className="flex-1 h-12 rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {step === 0 ? "ยกเลิก" : "ย้อนกลับ"}
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90"
            >
              ถัดไป
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              className="flex-1 h-12 rounded-xl bg-destructive hover:bg-destructive/90 font-bold"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "ส่งประกาศ"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
