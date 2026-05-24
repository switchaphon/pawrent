"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PillTag } from "@/components/ui/pill-tag";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/liff-provider";
import { cn } from "@/lib/utils";
import type { LostPetAlert, AlertStatus } from "@/components/post/types";
import { PosterButtons } from "@/components/post/poster-buttons";
import {
  ArrowLeft,
  Share2,
  Link as LinkIcon,
  MapPin,
  Clock,
  FileText,
  Eye,
  MessageCircle,
  CheckCircle,
  Facebook,
  Twitter,
  MessageSquare,
  Gift,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/skeleton-card";

const ReadOnlyMap = dynamic(
  () =>
    import("@/components/map-picker").then((mod) => {
      function ReadOnlyMapInner({ lat, lng }: { lat: number; lng: number }) {
        return <mod.MapPicker initialLat={lat} initialLng={lng} onLocationSelect={() => {}} />;
      }
      ReadOnlyMapInner.displayName = "ReadOnlyMap";
      return ReadOnlyMapInner;
    }),
  {
    ssr: false,
    loading: () => <div className="h-48 bg-surface-alt rounded-[20px] animate-pulse" />,
  }
);

function BubbleCard({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[24px] border border-border bg-card shadow-soft p-5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  iconClass?: string;
}) {
  return (
    <h3 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
      <Icon className={cn("w-4 h-4 text-primary", iconClass)} />
      {children}
    </h3>
  );
}

function getStatusChip(status: AlertStatus, alertType: string) {
  if (status === "resolved_found" || status === "resolved_owner") {
    return { label: "กลับบ้านแล้ว", className: "bg-info text-white" };
  }
  if (status === "resolved_other" || status === "expired") {
    return { label: "ปิดประกาศ", className: "bg-text-muted text-white" };
  }
  if (alertType === "found" || alertType === "stray") {
    return { label: "พบแล้ว", className: "bg-success text-white" };
  }
  return { label: "หาย", className: "bg-danger text-white" };
}

function formatThaiDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const month = thaiMonths[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;
  return `${day} ${month} ${buddhistYear}`;
}

function getRelativeTimeThai(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`;
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} สัปดาห์ที่แล้ว`;
  return `${Math.floor(diffDay / 30)} เดือนที่แล้ว`;
}

function getSexLabel(sex: string | null): string {
  if (!sex) return "ไม่ระบุเพศ";
  if (sex === "male") return "♂️ ผู้";
  if (sex === "female") return "♀️ เมีย";
  return sex;
}

function calculateAge(dob: string | null): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years > 0 && months > 0) return `${years} ปี ${months} เดือน`;
  if (years > 0) return `${years} ปี`;
  if (months > 0) return `${months} เดือน`;
  return "ไม่ถึง 1 เดือน";
}

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const alertId = params.id as string;

  const [alert, setAlert] = useState<LostPetAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchAlert() {
      try {
        const data = await apiFetch(`/api/post?id=${alertId}`);
        setAlert(data.alert || data.data || data);
      } catch {
        console.error("Failed to fetch alert");
      } finally {
        setLoading(false);
      }
    }
    if (alertId) fetchAlert();
  }, [alertId]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft;
      const width = carousel.offsetWidth;
      const index = Math.round(scrollLeft / width);
      setCurrentPhoto(index);
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    return () => carousel.removeEventListener("scroll", handleScroll);
  }, [alert]);

  const handleLineShare = async () => {
    try {
      const { isInLiffBrowser } = await import("@/lib/liff");
      if (isInLiffBrowser()) {
        const liff = (await import("@line/liff")).default;
        if (liff.isApiAvailable("shareTargetPicker")) {
          await liff.shareTargetPicker([
            {
              type: "text",
              text: `🚨 สัตว์เลี้ยงหาย! ${alert?.pet_name || ""}\n${alert?.location_description || ""}\nดูรายละเอียด: ${window.location.href}`,
            },
          ]);
        }
      }
    } catch {
      // Not in LIFF
    }
  };

  const handleFacebookShare = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const handleTwitterShare = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`🚨 สัตว์เลี้ยงหาย! ${alert?.pet_name || ""}`);
    window.open(
      `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-alt pb-24">
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3">
          <button
            onClick={() => router.back()}
            aria-label="กลับ"
            className="flex items-center gap-2 text-text-main min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold text-sm">กลับ</span>
          </button>
        </header>
        <main className="px-4 py-4 max-w-md mx-auto space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </main>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen bg-surface-alt pb-24">
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3">
          <button
            onClick={() => router.back()}
            aria-label="กลับ"
            className="flex items-center gap-2 text-text-main min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">กลับ</span>
          </button>
        </header>
        <EmptyState emoji="🔎" title="ไม่พบประกาศ" description="ประกาศนี้อาจถูกลบหรือปิดไปแล้ว" />
      </div>
    );
  }

  const chip = getStatusChip(alert.status, alert.alert_type);
  const allPhotos = [
    ...(alert.photo_urls || []),
    ...(alert.pet_photo_url && !alert.photo_urls?.includes(alert.pet_photo_url)
      ? [alert.pet_photo_url]
      : []),
  ];
  const age = calculateAge(alert.pet_date_of_birth);
  const isLost = alert.alert_type === "lost";

  return (
    <div className="min-h-screen bg-surface-alt pb-24">
      {/* Compact header with back + status */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            aria-label="กลับ"
            className="flex items-center gap-2 text-text-main min-h-[44px] -ml-1 pl-1 pr-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold text-sm">กลับ</span>
          </button>
          <span className={cn("text-[11px] font-bold px-3 py-1 rounded-full", chip.className)}>
            {chip.label}
          </span>
        </div>
      </header>

      <main className="max-w-md mx-auto">
        {/* Photo carousel */}
        {allPhotos.length > 0 && (
          <div className="relative">
            <div
              ref={carouselRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {allPhotos.map((url, i) => (
                <div
                  key={i}
                  className="w-full flex-shrink-0 snap-center"
                  style={{ scrollSnapAlign: "center" }}
                >
                  <div className="relative w-full aspect-square bg-surface-alt">
                    <Image
                      src={url}
                      alt={`รูปที่ ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 448px) 100vw, 448px"
                      priority={i === 0}
                    />
                    {isLost && (
                      <span className="absolute top-3 left-3 bg-danger text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-soft">
                        🚨 {i + 1}/{allPhotos.length}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {allPhotos.length > 1 && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                {allPhotos.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      i === currentPhoto ? "bg-surface" : "bg-surface/50"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-4 space-y-4">
          {/* Pet name + breed hero */}
          <div className="pt-1">
            <h1 className="text-[26px] font-extrabold text-text-main leading-tight">
              {alert.pet_name || "ไม่ระบุชื่อ"}
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              {alert.pet_breed || "ไม่ระบุสายพันธุ์"}
            </p>
          </div>

          {/* When card */}
          <BubbleCard>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  isLost ? "bg-danger-bg" : "bg-success-bg"
                )}
              >
                <Clock className={cn("w-5 h-5", isLost ? "text-danger" : "text-success")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-muted mb-0.5">{isLost ? "หายเมื่อ" : "พบเมื่อ"}</p>
                <p className="font-bold text-text-main text-sm leading-snug">
                  {formatThaiDateFull(alert.lost_date)}
                  {alert.lost_time && ` · ${alert.lost_time} น.`}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {getRelativeTimeThai(alert.created_at)}
                </p>
              </div>
            </div>
          </BubbleCard>

          {/* Reward banner — coral→amber gradient */}
          {alert.reward_amount > 0 && (
            <div className="relative rounded-[24px] bg-gradient-to-br from-primary to-primary-light p-5 text-center shadow-glow overflow-hidden">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 bg-white/25 text-white text-[11px] font-bold px-3 py-1 rounded-full mb-2">
                  <Gift className="w-3.5 h-3.5" />
                  รางวัลนำส่งคืน
                </div>
                <p className="text-4xl font-extrabold text-white drop-shadow-sm">
                  ฿{alert.reward_amount.toLocaleString()}
                </p>
                {alert.reward_note && (
                  <p className="text-xs text-white/90 mt-2 px-2">{alert.reward_note}</p>
                )}
              </div>
            </div>
          )}

          {/* Pet metadata as pill chips */}
          <BubbleCard>
            <SectionTitle icon={Eye}>ข้อมูลสัตว์เลี้ยง</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {alert.pet_breed && <PillTag>🐾 {alert.pet_breed}</PillTag>}
              {alert.pet_color && <PillTag>🎨 {alert.pet_color}</PillTag>}
              <PillTag>{getSexLabel(alert.pet_sex)}</PillTag>
              {age && <PillTag>📆 {age}</PillTag>}
              {alert.pet_neutered === true && (
                <PillTag className="bg-success-bg text-success">✓ ทำหมัน</PillTag>
              )}
              {alert.pet_neutered === false && <PillTag>ยังไม่ทำหมัน</PillTag>}
              {alert.pet_microchip && (
                <PillTag className="font-mono normal-case">🔗 {alert.pet_microchip}</PillTag>
              )}
            </div>
          </BubbleCard>

          {/* Distinguishing marks */}
          {alert.distinguishing_marks && (
            <BubbleCard>
              <SectionTitle icon={Eye}>จุดสังเกต / ลักษณะเฉพาะ</SectionTitle>
              <p className="text-sm text-text-main whitespace-pre-line leading-relaxed">
                {alert.distinguishing_marks}
              </p>
            </BubbleCard>
          )}

          {/* Description */}
          {alert.description && (
            <BubbleCard>
              <SectionTitle icon={FileText}>รายละเอียดเพิ่มเติม</SectionTitle>
              <p className="text-sm text-text-main whitespace-pre-line leading-relaxed">
                {alert.description}
              </p>
            </BubbleCard>
          )}

          {/* Location */}
          <BubbleCard>
            <SectionTitle icon={MapPin} iconClass="text-danger">
              {isLost ? "ตำแหน่งที่เห็นครั้งสุดท้าย" : "ตำแหน่งที่พบ"}
            </SectionTitle>
            {alert.location_description && (
              <p className="text-sm text-text-main mb-3 leading-relaxed">
                {alert.location_description}
              </p>
            )}
            <div className="rounded-[20px] overflow-hidden border border-border">
              <ReadOnlyMap lat={alert.fuzzy_lat || alert.lat} lng={alert.fuzzy_lng || alert.lng} />
            </div>
            <p className="text-[11px] text-text-muted mt-2 text-center">
              ตำแหน่งโดยประมาณ (เพื่อความเป็นส่วนตัว)
            </p>
          </BubbleCard>

          {/* Primary action buttons (placeholders) */}
          <div className="space-y-2">
            <Button disabled className="w-full h-12 rounded-full bg-success text-white opacity-50">
              <CheckCircle className="w-5 h-5 mr-2" />
              ฉันเห็นน้อง! — เร็วๆ นี้
            </Button>
            <Button disabled variant="outline" className="w-full h-12 rounded-full opacity-50">
              <MessageCircle className="w-5 h-5 mr-2" />
              ติดต่อเจ้าของ — เร็วๆ นี้
            </Button>
          </div>

          {/* Polished share row — 4 buttons */}
          <BubbleCard>
            <SectionTitle icon={Share2}>แชร์ประกาศ</SectionTitle>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleLineShare}
                aria-label="แชร์ผ่าน LINE"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-[18px] bg-success-bg hover:bg-success/20 active:scale-95 transition-all min-h-[64px]"
              >
                <MessageSquare className="w-5 h-5 text-success" />
                <span className="text-[10px] font-bold text-success">LINE</span>
              </button>
              <button
                type="button"
                onClick={handleFacebookShare}
                aria-label="แชร์ผ่าน Facebook"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-[18px] bg-info-bg hover:bg-info/20 active:scale-95 transition-all min-h-[64px]"
              >
                <Facebook className="w-5 h-5 text-info" />
                <span className="text-[10px] font-bold text-info">Facebook</span>
              </button>
              <button
                type="button"
                onClick={handleTwitterShare}
                aria-label="แชร์ผ่าน X"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-[18px] bg-surface-alt hover:bg-border active:scale-95 transition-all min-h-[64px]"
              >
                <Twitter className="w-5 h-5 text-text-main" />
                <span className="text-[10px] font-bold text-text-main">X</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="คัดลอกลิงก์"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-[18px] bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all min-h-[64px]"
              >
                <LinkIcon className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-bold text-primary">
                  {linkCopied ? "คัดลอก!" : "คัดลอก"}
                </span>
              </button>
            </div>
          </BubbleCard>

          {/* Owner-only poster buttons */}
          <PosterButtons
            alertId={alertId}
            ownerId={alert.owner_id}
            currentUserId={currentUser?.id ?? null}
          />
        </div>
      </main>
    </div>
  );
}
