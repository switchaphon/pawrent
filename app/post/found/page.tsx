"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useAuth } from "@/components/liff-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

const MapPicker = dynamic(() => import("@/components/map-picker").then((mod) => mod.MapPicker), {
  ssr: false,
  loading: () => <div className="h-48 bg-surface-alt rounded-xl animate-pulse" />,
});

const TOTAL_STEPS = 4;

const STEP_TITLES = ["ถ่ายรูปและตำแหน่ง", "ลักษณะสัตว์เลี้ยง", "สถานะการดูแล", "ตรวจสอบและส่ง"];

const SPECIES_OPTIONS = [
  { value: "dog", label: "สุนัข", emoji: "🐕" },
  { value: "cat", label: "แมว", emoji: "🐱" },
  { value: "other", label: "อื่นๆ", emoji: "🐾" },
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

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-colors",
            i === current
              ? "bg-success scale-110"
              : i < current
                ? "bg-success/40"
                : "bg-border"
          )}
        />
      ))}
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
  const [linkCopied, setLinkCopied] = useState(false);

  // Step 1: Photo & Location
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Step 2: Description
  const [speciesGuess, setSpeciesGuess] = useState<string>("");
  const [breedGuess, setBreedGuess] = useState("");
  const [colorDescription, setColorDescription] = useState("");
  const [sizeEstimate, setSizeEstimate] = useState<string>("");
  const [condition, setCondition] = useState<string>("healthy");
  const [hasCollar, setHasCollar] = useState(false);
  const [collarDescription, setCollarDescription] = useState("");
  const [description, setDescription] = useState("");

  // Step 3: Custody
  const [custodyStatus, setCustodyStatus] = useState<string>("with_finder");
  const [shelterName, setShelterName] = useState("");
  const [shelterAddress, setShelterAddress] = useState("");
  const [secretDetail, setSecretDetail] = useState("");

  // Auto-detect location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Default to Bangkok
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

    // Create preview URLs
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setPhotoUrls(urls);
  };

  const removePhoto = (index: number) => {
    const newFiles = photoFiles.filter((_, i) => i !== index);
    setPhotoFiles(newFiles);
    // Revoke old URL
    URL.revokeObjectURL(photoUrls[index]);
    setPhotoUrls(newFiles.map((f) => URL.createObjectURL(f)));
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return photoFiles.length > 0 && !!location;
      case 1:
        return true; // all optional
      case 2:
        return true; // all optional
      case 3:
        return true; // review
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
      // Upload photos first (using a simple upload approach)
      // For now, use object URLs as placeholders - real implementation would upload to storage
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
          // If upload API not available, use a placeholder
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
      alert("เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
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
              text: `🟢 พบสัตว์เลี้ยง!\nดูรายละเอียด: ${window.location.origin}/post/found/${submittedId}`,
            },
          ]);
        }
      }
    } catch {
      // Fallback: do nothing if LIFF not available
    }
  };

  const handleCopyLink = async () => {
    if (!submittedId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/found/${submittedId}`);
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
        <header className="sticky top-0 z-30 bg-success text-white px-4 py-3">
          <h1 className="text-xl font-bold">ส่งรายงานเรียบร้อย!</h1>
        </header>
        <main className="px-4 py-12 max-w-md mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-text-main mb-2">รายงานถูกส่งแล้ว!</h2>
          <p className="text-text-muted mb-6">
            AI จะช่วยค้นหาและแจ้งเตือนเจ้าของให้อัตโนมัติ
          </p>

          <div className="space-y-3 mb-6">
            <Button
              onClick={handleShare}
              className="w-full h-12 bg-success hover:bg-success text-white font-bold"
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
      <header className="sticky top-0 z-30 bg-success text-white px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={handleBack} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">แจ้งพบสัตว์เลี้ยง</h1>
            <p className="text-xs opacity-80">
              ขั้นตอนที่ {step + 1}/{TOTAL_STEPS}: {STEP_TITLES[step]}
            </p>
          </div>
        </div>
      </header>

      <ProgressDots current={step} total={TOTAL_STEPS} />

      <main className="px-4 max-w-md mx-auto">
        {/* Step 1: Photo & Location */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-text-main">ถ่ายรูปและระบุตำแหน่ง</h2>

            {/* Photo upload */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-success" />
                รูปภาพ ({photoUrls.length}/5) *
              </Label>

              {photoUrls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-3">
                  {photoUrls.map((url, i) => (
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
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-danger text-white rounded-full text-xs flex items-center justify-center"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photoUrls.length < 5 && (
                <label className="block w-full py-3 border-2 border-dashed border-green-300 rounded-xl text-center cursor-pointer hover:bg-success-bg transition-colors">
                  <Camera className="w-6 h-6 text-success mx-auto mb-1" />
                  <span className="text-sm text-success font-medium">ถ่ายรูป / เลือกรูป</span>
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
            </Card>

            {/* Map */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-success" />
                ตำแหน่งที่พบ *
              </Label>
              <MapPicker onLocationSelect={(lat, lng) => setLocation({ lat, lng })} />
              <p className="text-xs text-text-muted mt-2">
                {location
                  ? `📍 ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                  : "กำลังหาตำแหน่ง..."}
              </p>
            </Card>
          </div>
        )}

        {/* Step 2: Animal Description */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-text-main">ลักษณะสัตว์เลี้ยงที่พบ</h2>

            {/* Species */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold mb-2 block">ประเภท</Label>
              <div className="flex gap-2">
                {SPECIES_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSpeciesGuess(opt.value)}
                    className={cn(
                      "flex-1 py-3 rounded-xl border text-center transition-all",
                      speciesGuess === opt.value
                        ? "border-green-500 bg-success-bg shadow-soft"
                        : "border-border bg-surface hover:border-green-300"
                    )}
                  >
                    <span className="text-xl block">{opt.emoji}</span>
                    <span className="text-xs font-medium mt-1 block">{opt.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Breed */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold mb-2 block">
                สายพันธุ์ (ถ้าทราบ)
              </Label>
              <Input
                value={breedGuess}
                onChange={(e) => setBreedGuess(e.target.value)}
                placeholder="เช่น พุดเดิ้ล, บางแก้ว, สก็อตติช โฟลด์"
                className="rounded-xl"
                maxLength={100}
              />
            </Card>

            {/* Color */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold mb-2 block">สีขน</Label>
              <Input
                value={colorDescription}
                onChange={(e) => setColorDescription(e.target.value)}
                placeholder="เช่น ขาว-น้ำตาล, ดำทั้งตัว, ลายสามสี"
                className="rounded-xl"
                maxLength={200}
              />
            </Card>

            {/* Size */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold mb-2 block">ขนาด</Label>
              <div className="flex gap-1.5 flex-wrap">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSizeEstimate(opt.value)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                      sizeEstimate === opt.value
                        ? "border-green-500 bg-success-bg text-success"
                        : "border-border bg-surface text-text-main hover:border-green-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Condition */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold mb-2 block">สภาพ</Label>
              <div className="grid grid-cols-2 gap-2">
                {CONDITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCondition(opt.value)}
                    className={cn(
                      "py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                      condition === opt.value
                        ? "border-green-500 bg-success-bg text-success"
                        : "border-border bg-surface text-text-main hover:border-green-300"
                    )}
                  >
                    <span>{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Collar */}
            <Card className="p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="hasCollar"
                  checked={hasCollar}
                  onChange={(e) => setHasCollar(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded accent-green-500"
                />
                <div className="flex-1">
                  <Label htmlFor="hasCollar" className="text-text-main font-semibold">
                    มีปลอกคอ
                  </Label>
                  <p className="text-xs text-text-muted mt-0.5">
                    บอกรายละเอียดปลอกคอเพื่อช่วยระบุตัวตน
                  </p>
                </div>
              </div>
              {hasCollar && (
                <Input
                  value={collarDescription}
                  onChange={(e) => setCollarDescription(e.target.value)}
                  placeholder="เช่น ปลอกคอสีแดง มีกระดิ่ง"
                  className="rounded-xl mt-3"
                  maxLength={200}
                />
              )}
            </Card>

            {/* Description */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold mb-2 block">
                รายละเอียดเพิ่มเติม
              </Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น พบเดินอยู่หน้าเซเว่น ดูหิว ขนยุ่ง"
                className="w-full p-3 border border-border rounded-xl bg-background text-text-main min-h-[80px] resize-none"
                maxLength={2000}
              />
            </Card>
          </div>
        )}

        {/* Step 3: Custody & Verification */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-text-main">สถานะการดูแล</h2>

            {/* Custody Status */}
            <Card className="p-4 rounded-xl">
              <Label className="text-text-main font-semibold mb-2 block">
                ตอนนี้น้องอยู่ที่ไหน?
              </Label>
              <div className="space-y-2">
                {CUSTODY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCustodyStatus(opt.value)}
                    className={cn(
                      "w-full py-3 px-4 rounded-xl border text-left transition-all flex items-center gap-3",
                      custodyStatus === opt.value
                        ? "border-green-500 bg-success-bg shadow-soft"
                        : "border-border bg-surface hover:border-green-300"
                    )}
                  >
                    <span className="text-lg">{opt.emoji}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Shelter info (conditional) */}
            {custodyStatus === "at_shelter" && (
              <Card className="p-4 rounded-xl">
                <Label className="text-text-main font-semibold mb-2 block">
                  ข้อมูลสถานสงเคราะห์
                </Label>
                <div className="space-y-3">
                  <Input
                    value={shelterName}
                    onChange={(e) => setShelterName(e.target.value)}
                    placeholder="ชื่อสถานสงเคราะห์"
                    className="rounded-xl"
                    maxLength={200}
                  />
                  <Input
                    value={shelterAddress}
                    onChange={(e) => setShelterAddress(e.target.value)}
                    placeholder="ที่อยู่"
                    className="rounded-xl"
                    maxLength={500}
                  />
                </div>
              </Card>
            )}

            {/* Secret verification detail */}
            <Card className="p-4 rounded-xl border-success/30 bg-success-bg/50">
              <Label className="text-text-main font-semibold flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-success" />
                ลักษณะลับ (ป้องกันการแอบอ้าง)
              </Label>
              <p className="text-xs text-text-muted mb-3">
                บอกลักษณะที่เจ้าของตัวจริงเท่านั้นจะรู้ เช่น ข้อความบนปลอกคอ, เบอร์แท็ก,
                ลายเฉพาะที่ซ่อนอยู่ — ข้อมูลนี้จะไม่แสดงสาธารณะ
              </p>
              <textarea
                value={secretDetail}
                onChange={(e) => setSecretDetail(e.target.value)}
                placeholder="เช่น ปลอกคอมีข้อความว่า 'Lucky' / มีรอยแผลเป็นที่ท้อง"
                className="w-full p-3 border border-success/30 rounded-xl bg-surface text-text-main min-h-[80px] resize-none"
                maxLength={500}
              />
            </Card>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-text-main">ตรวจสอบและส่งรายงาน</h2>

            <Card className="p-4 rounded-xl space-y-3">
              {/* Photo preview */}
              {photoUrls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                  {photoUrls.map((url, i) => (
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
              )}

              <hr className="border-border" />

              <div className="space-y-2 text-sm">
                {speciesGuess && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">ประเภท</span>
                    <span className="text-text-main font-medium">
                      {SPECIES_OPTIONS.find((s) => s.value === speciesGuess)?.label ?? speciesGuess}
                    </span>
                  </div>
                )}
                {breedGuess && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">สายพันธุ์</span>
                    <span className="text-text-main font-medium">{breedGuess}</span>
                  </div>
                )}
                {colorDescription && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">สีขน</span>
                    <span className="text-text-main font-medium">{colorDescription}</span>
                  </div>
                )}
                {sizeEstimate && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">ขนาด</span>
                    <span className="text-text-main font-medium">
                      {SIZE_OPTIONS.find((s) => s.value === sizeEstimate)?.label ?? sizeEstimate}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-muted">สภาพ</span>
                  <span className="text-text-main font-medium">
                    {CONDITION_OPTIONS.find((c) => c.value === condition)?.label ?? condition}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">สถานะ</span>
                  <span className="text-text-main font-medium">
                    {CUSTODY_OPTIONS.find((c) => c.value === custodyStatus)?.label ?? custodyStatus}
                  </span>
                </div>
                {location && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">ตำแหน่ง</span>
                    <span className="text-text-main font-medium">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-muted">รูปภาพ</span>
                  <span className="text-text-main font-medium">{photoUrls.length} รูป</span>
                </div>
                {hasCollar && collarDescription && (
                  <div>
                    <span className="text-text-muted">ปลอกคอ:</span>
                    <p className="text-text-main mt-0.5 text-xs">{collarDescription}</p>
                  </div>
                )}
                {description && (
                  <div>
                    <span className="text-text-muted">รายละเอียด:</span>
                    <p className="text-text-main mt-0.5 text-xs whitespace-pre-line">
                      {description}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 inset-x-0 bg-surface border-t border-border p-4 safe-area-bottom z-30">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="outline" onClick={handleBack} className="flex-1 h-12 rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {step === 0 ? "ยกเลิก" : "ย้อนกลับ"}
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 h-12 rounded-xl bg-success hover:bg-success text-white"
            >
              ถัดไป
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              className="flex-1 h-12 rounded-xl bg-success hover:bg-success text-white font-bold"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "ส่งรายงาน"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
