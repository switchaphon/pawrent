"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LostPetAlert, AlertStatus } from "@/components/post/types";
import {
  ArrowLeft,
  Loader2,
  Share2,
  Link as LinkIcon,
  MapPin,
  Clock,
  FileText,
  Eye,
  MessageCircle,
  CheckCircle,
} from "lucide-react";

const ReadOnlyMap = dynamic(
  () =>
    import("@/components/map-picker").then((mod) => {
      // Wrap MapPicker as read-only display
      function ReadOnlyMapInner({ lat, lng }: { lat: number; lng: number }) {
        return <mod.MapPicker initialLat={lat} initialLng={lng} onLocationSelect={() => {}} />;
      }
      ReadOnlyMapInner.displayName = "ReadOnlyMap";
      return ReadOnlyMapInner;
    }),
  {
    ssr: false,
    loading: () => <div className="h-48 bg-muted rounded-xl animate-pulse" />,
  }
);

function getStatusChip(status: AlertStatus, alertType: string) {
  if (status === "resolved_found" || status === "resolved_owner") {
    return { label: "กลับบ้านแล้ว", className: "bg-blue-500 text-white" };
  }
  if (status === "resolved_other" || status === "expired") {
    return { label: "ปิดประกาศ", className: "bg-gray-400 text-white" };
  }
  if (alertType === "found" || alertType === "stray") {
    return { label: "พบแล้ว", className: "bg-green-500 text-white" };
  }
  return { label: "หาย", className: "bg-red-500 text-white" };
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
  if (!sex) return "ไม่ระบุ";
  if (sex === "male") return "ผู้";
  if (sex === "female") return "เมีย";
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
  const alertId = params.id as string;

  const [alert, setAlert] = useState<LostPetAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchAlert() {
      try {
        const data = await apiFetch(`/api/post/${alertId}`);
        setAlert(data.alert || data.data || data);
      } catch {
        console.error("Failed to fetch alert");
      } finally {
        setLoading(false);
      }
    }
    if (alertId) fetchAlert();
  }, [alertId]);

  // Scroll-snap carousel tracking
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

  const handleShare = async () => {
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-foreground">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">กลับ</span>
          </button>
        </header>
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">ไม่พบประกาศ</p>
        </div>
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-foreground">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">กลับ</span>
          </button>
          <span className={cn("text-xs font-bold px-3 py-1 rounded-full", chip.className)}>
            {chip.label}
          </span>
        </div>
      </header>

      <main className="max-w-md mx-auto">
        {/* Photo Carousel */}
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
                  <div className="relative w-full aspect-square bg-muted">
                    <Image
                      src={url}
                      alt={`รูปที่ ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 448px) 100vw, 448px"
                      priority={i === 0}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* Dots */}
            {allPhotos.length > 1 && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                {allPhotos.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      i === currentPhoto ? "bg-white" : "bg-white/50"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-4 space-y-4">
          {/* Pet name & status */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full", chip.className)}>
                {chip.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {alert.pet_name || "ไม่ระบุชื่อ"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {alert.pet_breed || "ไม่ระบุสายพันธุ์"}
            </p>
          </div>

          {/* Lost date/time */}
          <Card className="p-4 rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-destructive flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">
                  หายวันที่ {formatThaiDateFull(alert.lost_date)}
                  {alert.lost_time && ` ประมาณ ${alert.lost_time} น.`}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({getRelativeTimeThai(alert.created_at)})
                </p>
              </div>
            </div>
          </Card>

          {/* Reward banner */}
          {alert.reward_amount > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl p-4 text-center">
              <p className="text-xs text-amber-700 font-medium mb-1">รางวัลนำจับ</p>
              <p className="text-2xl font-bold text-amber-600">
                ฿{alert.reward_amount.toLocaleString()}
              </p>
              {alert.reward_note && (
                <p className="text-xs text-amber-600 mt-1">{alert.reward_note}</p>
              )}
            </div>
          )}

          {/* Pet metadata grid */}
          <Card className="p-4 rounded-xl">
            <h3 className="font-bold text-foreground text-sm mb-3">ข้อมูลสัตว์เลี้ยง</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">ชื่อ</span>
                <p className="font-medium text-foreground">{alert.pet_name || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">สายพันธุ์</span>
                <p className="font-medium text-foreground">{alert.pet_breed || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">สี</span>
                <p className="font-medium text-foreground">{alert.pet_color || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">เพศ</span>
                <p className="font-medium text-foreground">{getSexLabel(alert.pet_sex)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">ทำหมัน</span>
                <p className="font-medium text-foreground">
                  {alert.pet_neutered === true
                    ? "ทำหมันแล้ว ✓"
                    : alert.pet_neutered === false
                      ? "ยังไม่ทำหมัน"
                      : "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">อายุ</span>
                <p className="font-medium text-foreground">{age || "-"}</p>
              </div>
              {alert.pet_microchip && (
                <div className="col-span-2">
                  <span className="text-muted-foreground text-xs">ไมโครชิป</span>
                  <p className="font-medium text-foreground font-mono text-xs">
                    {alert.pet_microchip}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Distinguishing marks */}
          {alert.distinguishing_marks && (
            <Card className="p-4 rounded-xl">
              <h3 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                จุดสังเกต / ลักษณะเฉพาะ
              </h3>
              <p className="text-sm text-foreground whitespace-pre-line">
                {alert.distinguishing_marks}
              </p>
            </Card>
          )}

          {/* Description */}
          {alert.description && (
            <Card className="p-4 rounded-xl">
              <h3 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                รายละเอียดเพิ่มเติม
              </h3>
              <p className="text-sm text-foreground whitespace-pre-line">{alert.description}</p>
            </Card>
          )}

          {/* Location */}
          <Card className="p-4 rounded-xl">
            <h3 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-destructive" />
              ตำแหน่งที่เห็นครั้งสุดท้าย
            </h3>
            {alert.location_description && (
              <p className="text-sm text-foreground mb-3">{alert.location_description}</p>
            )}
            <ReadOnlyMap lat={alert.fuzzy_lat || alert.lat} lng={alert.fuzzy_lng || alert.lng} />
            <p className="text-xs text-muted-foreground mt-2">
              ตำแหน่งโดยประมาณ (เพื่อความเป็นส่วนตัว)
            </p>
          </Card>

          {/* Action buttons (placeholders for PRP-05) */}
          <div className="space-y-2">
            <Button disabled className="w-full h-12 rounded-xl bg-green-500 text-white opacity-50">
              <CheckCircle className="w-5 h-5 mr-2" />
              ฉันเห็นน้อง! — เร็วๆ นี้
            </Button>
            <Button disabled variant="outline" className="w-full h-12 rounded-xl opacity-50">
              <MessageCircle className="w-5 h-5 mr-2" />
              ติดต่อเจ้าของ — เร็วๆ นี้
            </Button>
          </div>

          {/* Share buttons */}
          <Card className="p-4 rounded-xl">
            <h3 className="font-bold text-foreground text-sm mb-3">แชร์ประกาศ</h3>
            <div className="flex gap-2">
              <Button
                onClick={handleShare}
                className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white text-xs rounded-xl"
              >
                <Share2 className="w-4 h-4 mr-1" />
                LINE
              </Button>
              <Button
                onClick={() => {
                  const url = encodeURIComponent(window.location.href);
                  const text = encodeURIComponent(`🚨 สัตว์เลี้ยงหาย! ${alert.pet_name || ""}`);
                  window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${url}`,
                    "_blank",
                    "width=600,height=400"
                  );
                }}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl"
              >
                Facebook
              </Button>
              <Button
                onClick={() => {
                  const url = encodeURIComponent(window.location.href);
                  const text = encodeURIComponent(`🚨 สัตว์เลี้ยงหาย! ${alert.pet_name || ""}`);
                  window.open(
                    `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
                    "_blank",
                    "width=600,height=400"
                  );
                }}
                className="flex-1 h-10 bg-black hover:bg-gray-800 text-white text-xs rounded-xl"
              >
                X
              </Button>
              <Button onClick={handleCopyLink} variant="outline" className="h-10 px-3 rounded-xl">
                <LinkIcon className="w-4 h-4" />
              </Button>
            </div>
            {linkCopied && (
              <p className="text-xs text-green-600 text-center mt-2">คัดลอกลิงก์แล้ว!</p>
            )}
          </Card>

          {/* Poster placeholder */}
          <Button disabled variant="outline" className="w-full h-12 rounded-xl opacity-50">
            <FileText className="w-5 h-5 mr-2" />
            สร้างโปสเตอร์ — เร็วๆ นี้
          </Button>
        </div>
      </main>
    </div>
  );
}
