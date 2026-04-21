"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useAuth } from "@/components/liff-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillTag } from "@/components/ui/pill-tag";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  MapPin,
  CheckCircle,
  Loader2,
  Share2,
  Link as LinkIcon,
  Shield,
  X,
  PawPrint,
  Download,
} from "lucide-react";

const MapPicker = dynamic(() => import("@/components/map-picker").then((mod) => mod.MapPicker), {
  ssr: false,
  loading: () => <div className="h-48 bg-surface-alt rounded-[20px] animate-pulse" />,
});

const TOTAL_STEPS = 4;

const STEP_TITLES = ["รูป + ที่", "ลักษณะ", "การดูแล", "ตรวจสอบ"];

const SPECIES_OPTIONS = [
  { value: "dog", label: "สุนัข", emoji: "🐕" },
  { value: "cat", label: "แมว", emoji: "🐱" },
  { value: "other", label: "อื่น ๆ", emoji: "🐾" },
] as const;

const SIZE_OPTIONS = [
  { value: "tiny", label: "จิ๋ว" },
  { value: "small", label: "เล็ก" },
  { value: "medium", label: "กลาง" },
  { value: "large", label: "ใหญ่" },
  { value: "giant", label: "ใหญ่มาก" },
] as const;

const CONDITION_OPTIONS = [
  { value: "healthy", label: "สุขภาพดี", emoji: "💚" },
  { value: "injured", label: "บาดเจ็บ", emoji: "🩹" },
  { value: "sick", label: "ป่วย", emoji: "🤒" },
  { value: "unknown", label: "ไม่แน่ใจ", emoji: "❓" },
] as const;

const CUSTODY_OPTIONS = [
  { value: "with_finder", label: "อยู่กับผู้พบ", emoji: "🏠" },
  { value: "at_shelter", label: "ส่งสถานสงเคราะห์", emoji: "🏥" },
  { value: "released_back", label: "ปล่อยกลับ", emoji: "🔓" },
  { value: "still_wandering", label: "ยังเดินอยู่", emoji: "🚶" },
] as const;

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
          <h1 className="text-base font-bold text-text-main truncate flex items-center gap-1.5">
            <PawPrint className="w-4 h-4 text-success" aria-hidden />
            แจ้งพบน้อง
          </h1>
          <p className="text-[11px] text-text-muted">
            ขั้นตอนที่ {step + 1}/{TOTAL_STEPS} · {STEP_TITLES[step]}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-success text-white flex items-center justify-center font-bold text-xs shadow-[0_4px_14px_rgba(76,107,60,0.3)]">
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
          className="h-full bg-success transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[9px] font-bold text-text-muted">
        {STEP_TITLES.map((title, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 text-center transition-colors",
              i === step ? "text-success" : i < step ? "text-text-muted" : "text-text-muted/50"
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

function FoundShareRow({ reportId }: { reportId: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/post/found/${reportId}` : "";
  const text = "🟢 พบสัตว์เลี้ยง! ช่วยกันตามหาเจ้าของ";

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

  const handleFacebook = () =>
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );

  const handleX = () =>
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      <button
        type="button"
        onClick={handleLine}
        aria-label="แชร์ไปยัง LINE"
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-success transition-colors touch-target"
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
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-success transition-colors touch-target"
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
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-success transition-colors touch-target"
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
        className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-surface border border-border hover:border-success transition-colors touch-target"
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
    </div>
  );
}

export default function FoundReportPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [speciesGuess, setSpeciesGuess] = useState<string>("");
  const [breedGuess, setBreedGuess] = useState("");
  const [colorDescription, setColorDescription] = useState("");
  const [sizeEstimate, setSizeEstimate] = useState<string>("");
  const [condition, setCondition] = useState<string>("healthy");
  const [hasCollar, setHasCollar] = useState(false);
  const [collarDescription, setCollarDescription] = useState("");
  const [description, setDescription] = useState("");

  const [custodyStatus, setCustodyStatus] = useState<string>("with_finder");
  const [shelterName, setShelterName] = useState("");
  const [shelterAddress, setShelterAddress] = useState("");
  const [secretDetail, setSecretDetail] = useState("");

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setLocation({ lat: 13.7563, lng: 100.5018 });
        }
      );
    }
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...photoFiles, ...files].slice(0, 5);
    setPhotoFiles(newFiles);
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setPhotoUrls(urls);
  };

  const removePhoto = (index: number) => {
    const newFiles = photoFiles.filter((_, i) => i !== index);
    setPhotoFiles(newFiles);
    URL.revokeObjectURL(photoUrls[index]);
    setPhotoUrls(newFiles.map((f) => URL.createObjectURL(f)));
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return photoFiles.length > 0 && !!location;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
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
    if (!user || !location || photoFiles.length === 0) return;
    setSubmitting(true);

    try {
      const uploadedUrls: string[] = [];
      for (const file of photoFiles) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const uploadResult = await apiFetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          uploadedUrls.push(uploadResult.url);
        } catch {
          uploadedUrls.push(`https://placeholder.pawrent.app/${file.name}`);
        }
      }

      const body = {
        photo_urls: uploadedUrls,
        lat: location.lat,
        lng: location.lng,
        species_guess: speciesGuess || undefined,
        breed_guess: breedGuess || undefined,
        color_description: colorDescription || undefined,
        size_estimate: sizeEstimate || undefined,
        description: description || undefined,
        has_collar: hasCollar,
        collar_description: hasCollar ? collarDescription || undefined : undefined,
        condition,
        custody_status: custodyStatus,
        shelter_name: custodyStatus === "at_shelter" ? shelterName || undefined : undefined,
        shelter_address: custodyStatus === "at_shelter" ? shelterAddress || undefined : undefined,
        secret_verification_detail: secretDetail || undefined,
      };

      const result = await apiFetch("/api/found-reports", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setSubmittedId(result.id || result.data?.id || null);
      setSubmitted(true);
    } catch (error) {
      console.error("Error creating found report:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen with mascot + share row
  if (submitted && submittedId) {
    return (
      <div className="min-h-screen-safe">
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3">
          <h1 className="text-base font-bold text-success">ส่งรายงานเรียบร้อย!</h1>
        </header>
        <main className="px-4 py-8 max-w-md mx-auto space-y-5">
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-pops-gradient animate-pulse shadow-glow" />
              <div className="relative w-full h-full rounded-full bg-surface flex items-center justify-center">
                <span className="text-5xl" aria-hidden>
                  🎉
                </span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-main mb-2">ขอบคุณที่ช่วยน้อง!</h2>
            <p className="text-sm text-text-muted leading-relaxed max-w-xs mx-auto">
              AI จะช่วยจับคู่กับประกาศน้องหาย
              <br />
              และแจ้งเตือนเจ้าของให้อัตโนมัติ
            </p>
          </div>

          <BubbleCard>
            <h3 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-success" aria-hidden />
              แชร์รายงานช่วยกระจายข่าว
            </h3>
            <FoundShareRow reportId={submittedId} />
          </BubbleCard>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/post/found/${submittedId}`)}
              className="w-full"
            >
              ดูรายงาน
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
        {/* Step 1: Photo & Location */}
        {step === 0 && (
          <>
            <BubbleCard>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-text-main font-bold flex items-center gap-2">
                  <Camera className="w-4 h-4 text-success" aria-hidden />
                  รูปภาพน้องที่พบ
                </Label>
                <PillTag className="bg-success-bg text-success">{photoUrls.length}/5 ภาพ</PillTag>
              </div>

              {photoUrls.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {photoUrls.map((url, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-2xl overflow-hidden border-2 border-border"
                    >
                      <Image
                        src={url}
                        alt={`รูปที่ ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        aria-label={`ลบรูปที่ ${i + 1}`}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-danger text-white rounded-full text-xs flex items-center justify-center shadow-soft"
                      >
                        <X className="w-3 h-3" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photoUrls.length < 5 && (
                <label className="block w-full py-4 border-2 border-dashed border-success/50 rounded-[20px] text-center cursor-pointer hover:bg-success-bg/50 transition-colors touch-target">
                  <Camera className="w-7 h-7 text-success mx-auto mb-1" aria-hidden />
                  <span className="text-sm text-success font-bold">ถ่ายรูป / เลือกรูป</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </BubbleCard>

            <BubbleCard>
              <Label className="text-text-main font-bold flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-success" aria-hidden />
                ตำแหน่งที่พบน้อง *
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
                  "กำลังค้นหาตำแหน่ง… แตะบนแผนที่เพื่อปรับได้"
                )}
              </p>
            </BubbleCard>
          </>
        )}

        {/* Step 2: Description */}
        {step === 1 && (
          <>
            <BubbleCard>
              <Label className="text-text-main font-bold mb-3 block">ประเภท</Label>
              <div className="grid grid-cols-3 gap-2">
                {SPECIES_OPTIONS.map((opt) => {
                  const isActive = speciesGuess === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSpeciesGuess(opt.value)}
                      aria-pressed={isActive}
                      className={cn(
                        "py-3 rounded-2xl border-2 text-center transition-all touch-target",
                        isActive
                          ? "border-success bg-success-bg shadow-[0_4px_14px_rgba(76,107,60,0.15)]"
                          : "border-border bg-surface hover:border-success/50"
                      )}
                    >
                      <span className="text-xl block" aria-hidden>
                        {opt.emoji}
                      </span>
                      <span className="text-xs font-bold mt-1 block">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </BubbleCard>

            <BubbleCard>
              <Label className="text-text-main font-bold mb-2 block">สายพันธุ์ (ถ้าทราบ)</Label>
              <Input
                value={breedGuess}
                onChange={(e) => setBreedGuess(e.target.value)}
                placeholder="เช่น พุดเดิ้ล, บางแก้ว, สก็อตติช โฟลด์"
                maxLength={100}
              />

              <Label className="text-text-main font-bold mt-3 mb-2 block">สีขน</Label>
              <Input
                value={colorDescription}
                onChange={(e) => setColorDescription(e.target.value)}
                placeholder="เช่น ขาว-น้ำตาล, ดำทั้งตัว, ลายสามสี"
                maxLength={200}
              />
            </BubbleCard>

            <BubbleCard>
              <Label className="text-text-main font-bold mb-2 block">ขนาด</Label>
              <div className="flex gap-1.5 flex-wrap">
                {SIZE_OPTIONS.map((opt) => {
                  const isActive = sizeEstimate === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSizeEstimate(opt.value)}
                      aria-pressed={isActive}
                      className={cn(
                        "px-3 py-2 rounded-full border text-xs font-bold transition-all touch-target",
                        isActive
                          ? "border-success bg-success-bg text-success"
                          : "border-border bg-surface text-text-main hover:border-success/50"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </BubbleCard>

            <BubbleCard>
              <Label className="text-text-main font-bold mb-3 block">สภาพน้อง</Label>
              <div className="grid grid-cols-2 gap-2">
                {CONDITION_OPTIONS.map((opt) => {
                  const isActive = condition === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCondition(opt.value)}
                      aria-pressed={isActive}
                      className={cn(
                        "py-3 rounded-2xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-1.5 touch-target",
                        isActive
                          ? "border-success bg-success-bg text-success"
                          : "border-border bg-surface text-text-main hover:border-success/50"
                      )}
                    >
                      <span aria-hidden>{opt.emoji}</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </BubbleCard>

            <BubbleCard>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="hasCollar"
                  checked={hasCollar}
                  onChange={(e) => setHasCollar(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded accent-primary"
                />
                <div className="flex-1">
                  <Label htmlFor="hasCollar" className="text-text-main font-bold">
                    มีปลอกคอ
                  </Label>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                    บอกรายละเอียดปลอกคอเพื่อช่วยระบุตัวตน
                  </p>
                </div>
              </div>
              {hasCollar && (
                <div className="mt-3">
                  <Input
                    value={collarDescription}
                    onChange={(e) => setCollarDescription(e.target.value)}
                    placeholder="เช่น ปลอกคอสีแดง มีกระดิ่ง"
                    maxLength={200}
                  />
                </div>
              )}
            </BubbleCard>

            <BubbleCard>
              <Label className="text-text-main font-bold mb-2 block">รายละเอียดเพิ่มเติม</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น พบเดินอยู่หน้าเซเว่น ดูหิว ขนยุ่ง"
                className="w-full p-3 border border-border rounded-[20px] bg-surface text-text-main min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-success/30 focus:border-success text-sm"
                maxLength={2000}
              />
            </BubbleCard>
          </>
        )}

        {/* Step 3: Custody */}
        {step === 2 && (
          <>
            <BubbleCard>
              <Label className="text-text-main font-bold mb-3 block">ตอนนี้น้องอยู่ที่ไหน?</Label>
              <div className="space-y-2">
                {CUSTODY_OPTIONS.map((opt) => {
                  const isActive = custodyStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCustodyStatus(opt.value)}
                      aria-pressed={isActive}
                      className={cn(
                        "w-full py-3 px-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 touch-target",
                        isActive
                          ? "border-success bg-success-bg shadow-[0_4px_14px_rgba(76,107,60,0.15)]"
                          : "border-border bg-surface hover:border-success/50"
                      )}
                    >
                      <span className="text-xl" aria-hidden>
                        {opt.emoji}
                      </span>
                      <span className="text-sm font-bold">{opt.label}</span>
                      {isActive && (
                        <CheckCircle className="w-4 h-4 text-success ml-auto" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </BubbleCard>

            {custodyStatus === "at_shelter" && (
              <BubbleCard>
                <Label className="text-text-main font-bold mb-2 block">ข้อมูลสถานสงเคราะห์</Label>
                <div className="space-y-3">
                  <Input
                    value={shelterName}
                    onChange={(e) => setShelterName(e.target.value)}
                    placeholder="ชื่อสถานสงเคราะห์"
                    maxLength={200}
                  />
                  <Input
                    value={shelterAddress}
                    onChange={(e) => setShelterAddress(e.target.value)}
                    placeholder="ที่อยู่"
                    maxLength={500}
                  />
                </div>
              </BubbleCard>
            )}

            <BubbleCard className="border-success/30 bg-success-bg/40">
              <Label className="text-text-main font-bold flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-success" aria-hidden />
                ลักษณะลับ (ป้องกันการแอบอ้าง)
              </Label>
              <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                บอกลักษณะที่เจ้าของตัวจริงเท่านั้นจะรู้ เช่น ข้อความบนปลอกคอ เบอร์แท็ก
                ลายเฉพาะที่ซ่อนอยู่ — ข้อมูลนี้ไม่แสดงสาธารณะ
              </p>
              <textarea
                value={secretDetail}
                onChange={(e) => setSecretDetail(e.target.value)}
                placeholder="เช่น ปลอกคอมีข้อความว่า 'Lucky' / มีรอยแผลเป็นที่ท้อง"
                className="w-full p-3 border border-success/30 rounded-[20px] bg-surface text-text-main min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-success/30 focus:border-success text-sm"
                maxLength={500}
              />
            </BubbleCard>
          </>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <BubbleCard>
            <h2 className="text-lg font-bold text-text-main mb-3">ตรวจสอบก่อนส่ง</h2>

            {photoUrls.length > 0 && (
              <div className="grid grid-cols-5 gap-2 mb-4 pb-3 border-b border-border-subtle">
                {photoUrls.slice(0, 5).map((url, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-border"
                  >
                    <Image
                      src={url}
                      alt={`รูปที่ ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ))}
              </div>
            )}

            <dl className="space-y-2.5 text-sm">
              {speciesGuess && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">ประเภท</dt>
                  <dd className="text-text-main font-bold">
                    {SPECIES_OPTIONS.find((s) => s.value === speciesGuess)?.label ?? speciesGuess}
                  </dd>
                </div>
              )}
              {breedGuess && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">สายพันธุ์</dt>
                  <dd className="text-text-main font-bold">{breedGuess}</dd>
                </div>
              )}
              {colorDescription && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">สีขน</dt>
                  <dd className="text-text-main font-bold text-right">{colorDescription}</dd>
                </div>
              )}
              {sizeEstimate && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">ขนาด</dt>
                  <dd className="text-text-main font-bold">
                    {SIZE_OPTIONS.find((s) => s.value === sizeEstimate)?.label ?? sizeEstimate}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">สภาพ</dt>
                <dd className="text-text-main font-bold">
                  {CONDITION_OPTIONS.find((c) => c.value === condition)?.label ?? condition}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">การดูแล</dt>
                <dd className="text-text-main font-bold">
                  {CUSTODY_OPTIONS.find((c) => c.value === custodyStatus)?.label ?? custodyStatus}
                </dd>
              </div>
              {location && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">ตำแหน่ง</dt>
                  <dd className="text-text-main font-bold">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">รูปภาพ</dt>
                <dd className="text-text-main font-bold">{photoUrls.length} รูป</dd>
              </div>
              {hasCollar && collarDescription && (
                <div>
                  <dt className="text-text-muted text-xs mb-1">ปลอกคอ</dt>
                  <dd className="text-text-main text-xs bg-surface-alt rounded-2xl p-3">
                    {collarDescription}
                  </dd>
                </div>
              )}
              {description && (
                <div>
                  <dt className="text-text-muted text-xs mb-1">รายละเอียด</dt>
                  <dd className="text-text-main text-xs whitespace-pre-line leading-relaxed bg-surface-alt rounded-2xl p-3">
                    {description}
                  </dd>
                </div>
              )}
              {secretDetail && (
                <div className="border border-success/30 bg-success-bg/40 rounded-2xl p-3">
                  <dt className="text-success text-xs font-bold mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" aria-hidden />
                    ลักษณะลับ (ไม่แสดงสาธารณะ)
                  </dt>
                  <dd className="text-text-main text-xs leading-relaxed">{secretDetail}</dd>
                </div>
              )}
            </dl>
          </BubbleCard>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur-md border-t border-border p-4 safe-area-bottom z-30">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="outline" onClick={handleBack} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-1" aria-hidden />
            {step === 0 ? "ยกเลิก" : "ย้อนกลับ"}
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 bg-success hover:brightness-105 shadow-[0_4px_14px_rgba(76,107,60,0.3)]"
            >
              ถัดไป
              <ArrowRight className="w-4 h-4 ml-1" aria-hidden />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              className="flex-1 bg-success hover:brightness-105 shadow-[0_4px_14px_rgba(76,107,60,0.3)]"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              ) : (
                <>
                  <PawPrint className="w-4 h-4 mr-1" aria-hidden />
                  ส่งรายงาน
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
