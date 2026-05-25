"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/liff-provider";
import { getPets } from "@/lib/db";
import { cn } from "@/lib/utils";
import { SkeletonCard } from "@/components/skeleton-card";
import { Bell, AlertTriangle, Syringe, Bug, Scissors } from "lucide-react";

interface Pet {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  photo_url: string | null;
  date_of_birth: string | null;
  vaccine_due_date?: string | null;
  parasite_due_date?: string | null;
  weight_logged_at?: string | null;
}

function getThaiGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "สวัสดีตอนเช้า";
  if (h < 16) return "สวัสดีตอนบ่าย";
  if (h < 19) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนค่ำ";
}

function getThaiDateShort(): string {
  const d = new Date();
  const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
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
  return `วัน${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
}

function calculateAgeShort(dob: string | null): string {
  if (!dob) return "";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  if (years >= 1) return `${years} ปี`;
  const months = now.getMonth() - birth.getMonth() + (years < 0 ? 12 : 0);
  return `${Math.max(1, months)} เดือน`;
}

function getPetEmoji(species: string | null): string {
  if (!species) return "🐾";
  if (species === "dog") return "🐕";
  if (species === "cat") return "🐈";
  if (species === "bird") return "🦜";
  if (species === "rabbit") return "🐇";
  return "🐾";
}

function getPetHealthStatus(pet: Pet): { label: string; variant: "success" | "warning" | "info" } {
  const now = Date.now();
  if (pet.vaccine_due_date) {
    const due = new Date(pet.vaccine_due_date).getTime();
    const diffDays = Math.floor((due - now) / 86400000);
    if (diffDays <= 14) return { label: "⚠️ ใกล้ฉีดวัคซีน", variant: "warning" };
  }
  if (pet.parasite_due_date) {
    const due = new Date(pet.parasite_due_date).getTime();
    const diffDays = Math.floor((due - now) / 86400000);
    if (diffDays <= 7) return { label: "⚠️ ใกล้ฉีดยา", variant: "warning" };
  }
  return { label: "💚 ทุกอย่างโอเค", variant: "success" };
}

function GreetingHeader({ userName }: { userName: string }) {
  return (
    <div className="bg-surface rounded-full shadow-owner p-3 flex items-center gap-3 border border-border">
      <div className="w-12 h-12 rounded-full bg-pops-gradient p-[3px] shrink-0">
        <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-2xl">
          👤
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-text-main truncate">
          {getThaiGreeting()} {userName} 👋
        </p>
        <p className="text-[11px] text-text-muted">วันนี้มีอะไรใหม่บ้าง?</p>
      </div>
      <Link
        href="/notifications"
        aria-label="การแจ้งเตือน"
        className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center text-text-subtle relative min-h-[44px]"
      >
        <Bell className="w-5 h-5" />
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
      </Link>
    </div>
  );
}

function WeatherStrip() {
  return (
    <div className="bg-surface/70 backdrop-blur-sm rounded-full px-4 py-2 flex items-center justify-between border border-border/60">
      <div className="flex items-center gap-2 text-[11px] text-text-subtle">
        <span>☀️</span>
        <span className="font-semibold">กรุงเทพฯ</span>
        <span className="text-text-muted">·</span>
        <span className="font-semibold">32°C</span>
        <span className="text-text-muted">·</span>
        <span>{getThaiDateShort()}</span>
      </div>
      <span className="text-[10px] text-text-muted">🌤️ แดดจัด</span>
    </div>
  );
}

function PetStatusCard({ pet }: { pet: Pet }) {
  const status = getPetHealthStatus(pet);
  const age = calculateAgeShort(pet.date_of_birth);
  const emoji = getPetEmoji(pet.species);
  const variantClass = {
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    info: "bg-info-bg text-info",
  }[status.variant];

  return (
    <Link
      href={`/pets?id=${pet.id}`}
      className="flex-1 bg-surface rounded-[24px] shadow-soft p-3 border border-border flex flex-col items-center text-center active:scale-95 transition-transform"
    >
      <div className="w-[60px] h-[60px] rounded-full bg-pops-gradient p-[3px] shadow-glow">
        <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-[28px] overflow-hidden">
          {pet.photo_url ? (
            <Image
              src={pet.photo_url}
              alt={pet.name}
              width={54}
              height={54}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span aria-hidden>{emoji}</span>
          )}
        </div>
      </div>
      <p className="text-xs font-extrabold text-text-main mt-2 truncate w-full">{pet.name}</p>
      <p className="text-[10px] text-text-muted truncate w-full">
        {pet.breed || "ไม่ระบุสายพันธุ์"}
        {age && ` · ${age}`}
      </p>
      <span
        className={cn(
          "mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap",
          variantClass
        )}
      >
        {status.label}
      </span>
    </Link>
  );
}

function PetStatusRow({ pets, loading }: { pets: Pet[]; loading: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-text-main flex items-center gap-1">🐾 สุขภาพน้อง ๆ</p>
        <Link href="/pets" className="text-[11px] text-primary font-semibold flex items-center">
          จัดการ ›
        </Link>
      </div>
      {loading ? (
        <div className="flex gap-3">
          <SkeletonCard className="flex-1 h-[140px]" />
          <SkeletonCard className="flex-1 h-[140px]" />
        </div>
      ) : pets.length === 0 ? (
        <Link
          href="/pets"
          className="block bg-surface rounded-[24px] shadow-soft p-4 border border-dashed border-border text-center active:scale-95 transition-transform"
        >
          <p className="text-3xl mb-1">🐾</p>
          <p className="text-xs font-bold text-text-main">ยังไม่มีน้องในระบบ</p>
          <p className="text-[10px] text-text-muted mt-0.5">เพิ่มน้องเพื่อเริ่มบันทึกสุขภาพ</p>
        </Link>
      ) : (
        <div className="flex items-start gap-3">
          {pets.slice(0, 2).map((pet) => (
            <PetStatusCard key={pet.id} pet={pet} />
          ))}
        </div>
      )}
    </div>
  );
}

function UrgentAlertsCard({ pets }: { pets: Pet[] }) {
  const [now] = useState(() => Date.now());
  const urgent = useMemo(() => {
    const list: Array<{
      id: string;
      petName: string;
      icon: "pill" | "scale";
      title: string;
      subtitle: string;
      variant: "danger" | "warning";
    }> = [];
    for (const pet of pets) {
      if (pet.parasite_due_date) {
        const due = new Date(pet.parasite_due_date).getTime();
        const diffDays = Math.floor((due - now) / 86400000);
        if (diffDays < 0) {
          list.push({
            id: `parasite-${pet.id}`,
            petName: pet.name,
            icon: "pill",
            title: `ฉีดยาป้องกันเห็บหมัดให้${pet.name}`,
            subtitle: `เลยกำหนด ${Math.abs(diffDays)} วัน`,
            variant: "danger",
          });
        }
      }
      if (pet.weight_logged_at) {
        const logged = new Date(pet.weight_logged_at).getTime();
        const diffDays = Math.floor((now - logged) / 86400000);
        if (diffDays > 30) {
          list.push({
            id: `weight-${pet.id}`,
            petName: pet.name,
            icon: "scale",
            title: `ชั่งน้ำหนัก${pet.name}`,
            subtitle: `ครบ ${diffDays} วัน — ควรบันทึกใหม่`,
            variant: "warning",
          });
        }
      }
    }
    return list;
  }, [pets, now]);

  if (urgent.length === 0) return null;

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-border overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
        <p className="text-xs font-extrabold text-text-main flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-danger-bg text-danger flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
          ต้องทำวันนี้
        </p>
        <span className="bg-danger-bg text-danger rounded-full px-2 py-0.5 text-[10px] font-bold">
          {urgent.length} รายการ
        </span>
      </div>
      {urgent.slice(0, 3).map((item, i) => (
        <div
          key={item.id}
          className={cn(
            "px-4 py-3 flex items-center gap-3",
            i < urgent.length - 1 && "border-b border-border/60"
          )}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              item.variant === "danger" ? "bg-danger-bg" : "bg-warning-bg"
            )}
          >
            <span className="text-lg">{item.icon === "pill" ? "💊" : "⚖️"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text-main truncate">{item.title}</p>
            <p
              className={cn(
                "text-[10px] font-semibold",
                item.variant === "danger" ? "text-danger" : "text-text-muted"
              )}
            >
              {item.subtitle}
            </p>
          </div>
          <Link
            href={`/pets?id=${item.id.split("-")[1]}`}
            className={cn(
              "h-10 px-3 rounded-full text-[11px] font-bold shrink-0 flex items-center min-h-[44px]",
              item.variant === "danger"
                ? "text-white bg-primary-gradient shadow-primary"
                : "text-text-subtle bg-surface border-2 border-border"
            )}
          >
            {item.variant === "danger" ? "ทำตอนนี้" : "บันทึก"}
          </Link>
        </div>
      ))}
    </div>
  );
}

const MONTHS_SHORT_TH = [
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

function HealthReminders({ pets }: { pets: Pet[] }) {
  const [now] = useState(() => Date.now());
  const reminders = useMemo(() => {
    const list: Array<{
      id: string;
      icon: "vaccine" | "parasite" | "grooming";
      title: string;
      subtitle: string;
      due: string;
      eta: string;
      etaVariant: "success" | "warning" | "info";
    }> = [];
    for (const pet of pets) {
      if (pet.vaccine_due_date) {
        const due = new Date(pet.vaccine_due_date);
        const diffDays = Math.floor((due.getTime() - now) / 86400000);
        if (diffDays >= 0 && diffDays <= 90) {
          list.push({
            id: `v-${pet.id}`,
            icon: "vaccine",
            title: `วัคซีน · ${pet.name}`,
            subtitle: "นัดฉีดกระตุ้น",
            due: `${due.getDate()} ${MONTHS_SHORT_TH[due.getMonth()]}`,
            eta:
              diffDays < 7
                ? `อีก ${diffDays} วัน`
                : diffDays < 30
                  ? `อีก ${Math.ceil(diffDays / 7)} สัปดาห์`
                  : `อีก ${Math.ceil(diffDays / 30)} เดือน`,
            etaVariant: diffDays < 14 ? "warning" : "success",
          });
        }
      }
      if (pet.parasite_due_date) {
        const due = new Date(pet.parasite_due_date);
        const diffDays = Math.floor((due.getTime() - now) / 86400000);
        if (diffDays >= 0 && diffDays <= 60) {
          list.push({
            id: `p-${pet.id}`,
            icon: "parasite",
            title: `ยาเห็บหมัด · ${pet.name}`,
            subtitle: "ยาป้องกัน รายเดือน",
            due: `${due.getDate()} ${MONTHS_SHORT_TH[due.getMonth()]}`,
            eta: diffDays < 7 ? `อีก ${diffDays} วัน` : `อีก ${Math.ceil(diffDays / 7)} สัปดาห์`,
            etaVariant: diffDays < 7 ? "warning" : "success",
          });
        }
      }
    }
    return list;
  }, [pets, now]);

  if (reminders.length === 0) return null;

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-border overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
        <p className="text-xs font-extrabold text-text-main flex items-center gap-1.5">
          📅 นัดหมายสัปดาห์นี้
        </p>
        <Link href="/pets" className="text-[11px] text-primary font-semibold flex items-center">
          ดูปฏิทิน ›
        </Link>
      </div>
      {reminders.slice(0, 3).map((r, i) => (
        <div
          key={r.id}
          className={cn(
            "px-4 py-3 flex items-center gap-3",
            i < Math.min(reminders.length, 3) - 1 && "border-b border-border/60"
          )}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              r.icon === "vaccine"
                ? "bg-success-bg"
                : r.icon === "parasite"
                  ? "bg-warning-bg"
                  : "bg-info-bg"
            )}
          >
            {r.icon === "vaccine" ? (
              <Syringe className="w-5 h-5 text-success" />
            ) : r.icon === "parasite" ? (
              <Bug className="w-5 h-5 text-warning" />
            ) : (
              <Scissors className="w-5 h-5 text-info" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text-main truncate">{r.title}</p>
            <p className="text-[10px] text-text-muted truncate">{r.subtitle}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-extrabold text-text-main">{r.due}</p>
            <p
              className={cn(
                "text-[9px] font-semibold",
                r.etaVariant === "warning"
                  ? "text-warning"
                  : r.etaVariant === "info"
                    ? "text-info"
                    : "text-success"
              )}
            >
              {r.eta}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HomeDashboard() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);

  useEffect(() => {
    async function fetchPets() {
      if (!user) return;
      const { data } = await getPets(user.id);
      setPets((data || []) as Pet[]);
      setPetsLoading(false);
    }
    fetchPets();
  }, [user]);

  const userName =
    (user as { displayName?: string; name?: string; line_display_name?: string } | null)
      ?.displayName ||
    (user as { name?: string } | null)?.name ||
    (user as { line_display_name?: string } | null)?.line_display_name ||
    "ชาวป๊อปส์";

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-surface-alt/40">
      <main className="max-w-md mx-auto px-4 pt-4 space-y-3">
        <GreetingHeader userName={userName} />
        <WeatherStrip />
        <PetStatusRow pets={pets} loading={petsLoading} />
        <UrgentAlertsCard pets={pets} />
        <HealthReminders pets={pets} />
      </main>
    </div>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-pops-gradient shadow-glow flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl" aria-hidden>
              🐾
            </span>
          </div>
          <p className="text-text-muted text-sm">กำลังเข้าสู่ระบบ…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-pops-gradient shadow-glow flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl" aria-hidden>
              🐾
            </span>
          </div>
          <p className="text-text-muted text-sm">กำลังเข้าสู่ระบบผ่าน LINE…</p>
        </div>
      </div>
    );
  }

  return <HomeDashboard />;
}
