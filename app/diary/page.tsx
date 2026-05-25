"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { TriangleAlert, Syringe, Pill, Scale, User } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { DiaryFab } from "@/components/diary-fab";
import { AddVaccineForm } from "@/components/add-vaccine-form";
import { AddParasiteLogForm } from "@/components/add-parasite-log-form";
import { AddWeightForm } from "@/components/add-weight-form";
import { AddHealthEventForm } from "@/components/add-health-event-form";
import { AddDiaryEntryForm } from "@/components/add-diary-entry-form";
import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-token";
import type { TimelineItem } from "@/app/api/diary/timeline/route";

// ─── Thai date helpers ────────────────────────────────────────────────────────

const TH_MONTHS_SHORT = [
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

const TH_MONTHS_FULL = [
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

function toLocalDate(ts: string): Date {
  return new Date(ts);
}

function formatShort(d: Date): string {
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Hybrid day grouping as per spec:
 * today → "วันนี้ · 14 พ.ค."
 * yesterday → "เมื่อวาน · 13 พ.ค."
 * 2-7 days ago → "12 พ.ค."
 * 1-2 weeks ago → "สัปดาห์ที่แล้ว"
 * 2-4 weeks ago → "2 สัปดาห์ก่อน"
 * older → "เม.ย. 2569"
 */
function getGroupKey(d: Date, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfItem = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor(
    (startOfToday.getTime() - startOfItem.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  if (diffDays <= 7) return `DAY:${startOfItem.toISOString().slice(0, 10)}`;
  if (diffDays <= 14) return "WEEK:1";
  if (diffDays <= 28) return "WEEK:2";
  // Older: group by month+year
  return `MONTH:${d.getFullYear()}-${d.getMonth()}`;
}

function getGroupLabel(key: string, now: Date, sampleDate: Date): string {
  if (key === "TODAY") return `วันนี้ · ${formatShort(sampleDate)}`;
  if (key === "YESTERDAY") return `เมื่อวาน · ${formatShort(sampleDate)}`;
  if (key.startsWith("DAY:")) return formatShort(sampleDate);
  if (key === "WEEK:1") return "สัปดาห์ที่แล้ว";
  if (key === "WEEK:2") return "2 สัปดาห์ก่อน";
  if (key.startsWith("MONTH:")) {
    const thYear = sampleDate.getFullYear() + 543;
    return `${TH_MONTHS_FULL[sampleDate.getMonth()]} ${thYear}`;
  }
  return formatShort(sampleDate);
}

// ─── Item type metadata ───────────────────────────────────────────────────────

function typeIcon(type: TimelineItem["type"]): React.ReactNode {
  switch (type) {
    case "diary_entry":
      return (
        <span className="text-[16px]" aria-hidden>
          📸
        </span>
      );
    case "vaccination":
      return <Syringe size={16} className="text-success" />;
    case "parasite_log":
      return <Pill size={16} className="text-info" />;
    case "weight_log":
      return <Scale size={16} className="text-primary" />;
    case "health_event":
      return (
        <span className="text-[16px]" aria-hidden>
          🏥
        </span>
      );
    case "milestone":
      return (
        <span className="text-[16px]" aria-hidden>
          🏆
        </span>
      );
  }
}

function typeIconBg(type: TimelineItem["type"]): string {
  switch (type) {
    case "diary_entry":
      return "bg-[rgba(255,130,99,0.08)]";
    case "vaccination":
      return "bg-success-bg";
    case "parasite_log":
      return "bg-info-bg";
    case "weight_log":
      return "bg-[rgba(255,130,99,0.08)]";
    case "health_event":
      return "bg-[rgba(255,203,107,0.15)]";
    case "milestone":
      return "bg-warning-bg";
  }
}

function typeLabel(type: TimelineItem["type"]): string {
  switch (type) {
    case "diary_entry":
      return "ไดอารี่";
    case "vaccination":
      return "วัคซีน";
    case "parasite_log":
      return "ยากำจัดปรสิต";
    case "weight_log":
      return "ชั่งน้ำหนัก";
    case "health_event":
      return "สุขภาพ";
    case "milestone":
      return "ไมลสโตน";
  }
}

// ─── Enrich prompt (48-hour window) ──────────────────────────────────────────

function isWithin48h(timestamp: string, now: Date): boolean {
  const ts = new Date(timestamp);
  return now.getTime() - ts.getTime() < 48 * 60 * 60 * 1000;
}

// ─── Grouped timeline helper ──────────────────────────────────────────────────

interface TimelineGroup {
  key: string;
  label: string;
  sampleDate: Date;
  items: TimelineItem[];
}

function groupItems(items: TimelineItem[], now: Date): TimelineGroup[] {
  const groupMap = new Map<string, TimelineGroup>();

  for (const item of items) {
    const d = toLocalDate(item.timestamp);
    const key = getGroupKey(d, now);
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        label: getGroupLabel(key, now, d),
        sampleDate: d,
        items: [],
      });
    }
    groupMap.get(key)!.items.push(item);
  }

  return Array.from(groupMap.values());
}

// ─── Mini pet type ────────────────────────────────────────────────────────────

interface UserPet {
  id: string;
  name: string;
  species: string | null;
}

// ─── Urgent item (reused from passport logic) ─────────────────────────────────

interface UrgentItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  variant: "danger" | "warn";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiaryPage() {
  const now = new Date();
  const searchParams = useSearchParams();

  const [pets, setPets] = useState<UserPet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [urgentItems, setUrgentItems] = useState<UrgentItem[]>([]);

  // Fetch pets list, then apply pet_id URL param if present
  useEffect(() => {
    async function loadPets() {
      if (!getAuthToken()) return;
      try {
        const data: UserPet[] = await apiFetch("/api/pets");
        setPets(data);
        const urlPetId = searchParams.get("pet_id");
        if (urlPetId && data.some((p) => p.id === urlPetId)) {
          setSelectedPetId(urlPetId);
        }
      } catch {
        // silently ignore — pets list failing doesn't block timeline
      }
    }
    loadPets();
    // searchParams is stable across renders; omit to avoid re-fetching on unrelated param changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch urgent items for the selected pet
  useEffect(() => {
    async function loadUrgent() {
      if (!getAuthToken() || !selectedPetId) {
        setUrgentItems([]);
        return;
      }
      try {
        const params = new URLSearchParams({ pet_id: selectedPetId });
        const weightLogs = await apiFetch(`/api/pet-weight?${params}`);
        const built: UrgentItem[] = [];

        if (weightLogs.length === 0) {
          built.push({
            id: "weight-never",
            icon: <Scale size={18} />,
            title: "บันทึกน้ำหนักครั้งแรก",
            detail: "ยังไม่เคยบันทึกน้ำหนัก",
            variant: "warn",
          });
        } else {
          const last = weightLogs[0];
          const daysSince = Math.floor(
            (now.getTime() - new Date(last.measured_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSince > 30) {
            built.push({
              id: "weight-stale",
              icon: <Scale size={18} />,
              title: "ชั่งน้ำหนักใหม่",
              detail: `ครบ ${daysSince} วันแล้ว`,
              variant: "warn",
            });
          }
        }

        setUrgentItems(built);
      } catch {
        setUrgentItems([]);
      }
    }
    loadUrgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPetId]);

  // Fetch timeline
  const fetchTimeline = useCallback(
    async (cursor?: string) => {
      if (!getAuthToken()) return;
      const isFirstPage = !cursor;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({ limit: "20" });
        if (selectedPetId) params.set("pet_id", selectedPetId);
        if (cursor) params.set("cursor", cursor);

        const json: { items: TimelineItem[]; next_cursor: string | null } = await apiFetch(
          `/api/diary/timeline?${params}`
        );
        setItems((prev) => (isFirstPage ? json.items : [...prev, ...json.items]));
        setNextCursor(json.next_cursor);
      } catch {
        // timeline failing renders empty state
      } finally {
        if (isFirstPage) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [selectedPetId]
  );

  // Re-fetch when pet filter changes
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!nextCursor || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchTimeline(nextCursor);
        }
      },
      { threshold: 0.1 }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [nextCursor, loadingMore, fetchTimeline]);

  // Group timeline
  const groups = groupItems(items, now);

  const [fabModal, setFabModal] = useState<{ type: string; petId?: string | null } | null>(null);

  const handleFabSelect = useCallback((key: string, petId?: string | null) => {
    setFabModal({ type: key, petId });
  }, []);

  const closeFabModal = useCallback(() => setFabModal(null), []);

  const handleFabSuccess = useCallback(() => {
    setFabModal(null);
    fetchTimeline();
  }, [fetchTimeline]);

  return (
    <div className="min-h-dvh pb-24">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pb-4 pt-1">
        <div>
          <p className="text-[12px] text-text-subtle">บันทึกสุขภาพ</p>
          <h1 className="text-[20px] font-extrabold leading-tight text-text-main">
            ไดอารี่<em className="not-italic text-primary">น้อง</em> 🐾
          </h1>
        </div>
        <Link href="/owner" className="flex-shrink-0" aria-label="โปรไฟล์เจ้าของ">
          <div className="h-[42px] w-[42px] rounded-full bg-gradient-to-br from-[#F06FA8] via-[#FF9285] to-[#FFCB6B] p-[2px] shadow-[0_2px_8px_rgba(240,94,56,0.2)]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#E8DDD5] text-text-muted">
              <User size={18} />
            </div>
          </div>
        </Link>
      </div>

      {/* ── Pet filter chips (single-select) ── */}
      {pets.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* "ทั้งหมด" chip */}
          <button
            onClick={() => setSelectedPetId(null)}
            className={[
              "flex flex-shrink-0 items-center gap-[5px] rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] font-medium transition-all",
              selectedPetId === null
                ? "border-primary bg-primary text-white shadow-[0_2px_8px_rgba(255,130,99,0.2)]"
                : "border-border bg-surface text-text-subtle",
            ].join(" ")}
          >
            🐾 ทั้งหมด
          </button>
          {pets.map((p) => {
            const isActive = selectedPetId === p.id;
            const emoji = (() => {
              const s = (p.species ?? "").toLowerCase();
              if (s.includes("cat") || s.includes("แมว")) return "🐱";
              if (s.includes("dog") || s.includes("สุนัข") || s.includes("หมา")) return "🐶";
              if (s.includes("rabbit") || s.includes("กระต่าย")) return "🐰";
              return "🐾";
            })();
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPetId(isActive ? null : p.id)}
                className={[
                  "flex flex-shrink-0 items-center gap-[5px] rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] font-medium transition-all",
                  isActive
                    ? "border-primary bg-primary text-white shadow-[0_2px_8px_rgba(255,130,99,0.2)]"
                    : "border-border bg-surface text-text-subtle",
                ].join(" ")}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                  {emoji}
                </span>
                {p.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="px-4 max-w-md mx-auto space-y-3">
        {/* ── Urgent card ── */}
        {urgentItems.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] font-extrabold text-text-main">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-danger-bg text-danger">
                  <TriangleAlert size={12} />
                </div>
                ต้องทำวันนี้
              </div>
              <span className="rounded-full bg-danger-bg px-2 py-[2px] text-[10px] font-bold text-danger">
                {urgentItems.length} รายการ
              </span>
            </div>
            {urgentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0"
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                    item.variant === "danger"
                      ? "bg-danger-bg text-danger"
                      : "bg-warning-bg text-warning"
                  }`}
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-text-main">{item.title}</p>
                  <p
                    className={`mt-[1px] text-[10px] font-semibold ${
                      item.variant === "danger" ? "text-danger" : "text-text-muted"
                    }`}
                  >
                    {item.detail}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (selectedPetId) {
                      setFabModal({ type: "pet_weight_logs", petId: selectedPetId });
                    }
                  }}
                  className="flex min-h-9 flex-shrink-0 items-center gap-1 rounded-full bg-gradient-to-br from-primary to-primary-light px-3.5 py-2 text-[11px] font-bold text-white shadow-[0_4px_14px_rgba(255,130,99,0.3)]"
                >
                  ทำตอนนี้
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Timeline ── */}
        {loading ? (
          <DiaryTimelineSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            size="full"
            emoji="📖"
            title="ยังไม่มีบันทึก"
            description="กด + เพื่อเริ่มบันทึกสุขภาพน้อง"
          />
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.key}>
                {/* Day group label */}
                <p className="mb-2 mt-1 px-1 text-[11px] font-bold text-text-subtle">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="mb-2.5">
                    <TimelineCard item={item} now={now} />
                  </div>
                ))}
              </div>
            ))}

            {/* Load more sentinel */}
            <div ref={sentinelRef} className="h-4" aria-hidden />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FAB form modals ── */}
      {fabModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="ปิด"
            tabIndex={-1}
            onClick={closeFabModal}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <div className="relative max-w-sm w-full max-h-[90vh] overflow-y-auto">
            {fabModal.type === "diary_entries" && (
              <AddDiaryEntryForm
                petId={fabModal.petId}
                pets={pets}
                onSuccess={handleFabSuccess}
                onCancel={closeFabModal}
              />
            )}
            {fabModal.type === "vaccinations" && fabModal.petId && (
              <AddVaccineForm
                petId={fabModal.petId}
                petSpecies={pets.find((p) => p.id === fabModal.petId)?.species ?? null}
                onSuccess={handleFabSuccess}
                onCancel={closeFabModal}
              />
            )}
            {fabModal.type === "parasite_external" && fabModal.petId && (
              <AddParasiteLogForm
                petId={fabModal.petId}
                petSpecies={pets.find((p) => p.id === fabModal.petId)?.species ?? null}
                onSuccess={handleFabSuccess}
                onCancel={closeFabModal}
              />
            )}
            {fabModal.type === "parasite_internal" && fabModal.petId && (
              <AddParasiteLogForm
                petId={fabModal.petId}
                petSpecies={pets.find((p) => p.id === fabModal.petId)?.species ?? null}
                onSuccess={handleFabSuccess}
                onCancel={closeFabModal}
              />
            )}
            {fabModal.type === "pet_weight_logs" && fabModal.petId && (
              <AddWeightForm
                petId={fabModal.petId}
                onSuccess={handleFabSuccess}
                onCancel={closeFabModal}
              />
            )}
            {fabModal.type === "grooming" && fabModal.petId && (
              <AddHealthEventForm
                petId={fabModal.petId}
                defaultType="grooming"
                onSuccess={handleFabSuccess}
                onCancel={closeFabModal}
              />
            )}
            {fabModal.type === "vet_visit" && fabModal.petId && (
              <AddHealthEventForm
                petId={fabModal.petId}
                defaultType="vet_visit"
                onSuccess={handleFabSuccess}
                onCancel={closeFabModal}
              />
            )}
            {/* If no pet selected, prompt user to select one for pet-specific forms */}
            {fabModal.type !== "diary_entries" && !fabModal.petId && (
              <div className="bg-surface rounded-2xl p-6 text-center shadow-soft">
                <p className="text-3xl mb-3" aria-hidden>
                  🐾
                </p>
                <p className="text-sm font-bold text-text-main mb-1">เลือกน้องก่อน</p>
                <p className="text-xs text-text-muted mb-4">
                  กรุณาเลือกน้องจากแถบด้านบนก่อนเพิ่มบันทึก
                </p>
                <button
                  onClick={closeFabModal}
                  className="px-6 py-2 rounded-full bg-primary text-white text-sm font-bold"
                >
                  ตกลง
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <DiaryFab selectedPetId={selectedPetId} onSelect={handleFabSelect} />
    </div>
  );
}

// ─── Timeline Card ─────────────────────────────────────────────────────────────

function TimelineCard({ item, now }: { item: TimelineItem; now: Date }) {
  const d = toLocalDate(item.timestamp);
  const isDiaryEntry = item.type === "diary_entry";
  const isHealthEvent = item.type === "health_event";

  // Enrich prompt: health events < 48h and no photo
  const showEnrichPrompt =
    isHealthEvent &&
    (!item.photo_urls || item.photo_urls.length === 0) &&
    isWithin48h(item.timestamp, now);

  // Photo layout: diary → full-width 160px; health enriched → 80px thumbnail
  const hasFullPhoto = isDiaryEntry && item.photo_urls && item.photo_urls.length > 0;
  const hasThumbnail = isHealthEvent && item.photo_urls && item.photo_urls.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${typeIconBg(item.type)}`}
          >
            {typeIcon(item.type)}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-bold text-text-main leading-snug line-clamp-2">
                {item.title ?? typeLabel(item.type)}
              </p>
              {/* Thumbnail for enriched health event */}
              {hasThumbnail && (
                <div className="relative h-[80px] w-[80px] flex-shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={item.photo_urls![0]}
                    alt={item.title ?? ""}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              )}
            </div>

            {/* Detail line */}
            {item.detail && (
              <p className="mt-0.5 text-[11px] text-text-muted line-clamp-2">{item.detail}</p>
            )}

            {/* Caption */}
            {item.caption && (
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted line-clamp-3">
                {item.caption}
              </p>
            )}

            {/* Mood */}
            {item.mood && (
              <span className="mt-1 inline-block rounded-full bg-[rgba(255,203,107,0.2)] px-2 py-[2px] text-[10px] font-semibold text-warning">
                {item.mood}
              </span>
            )}

            {/* Meta: pet name + time */}
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-text-muted">
              <span className="font-semibold">{item.pet_name}</span>
              <span aria-hidden>·</span>
              <span>{formatTime(d)}</span>
              <span aria-hidden>·</span>
              <span className="rounded-full bg-surface-alt px-1.5 py-[1px] font-medium">
                {typeLabel(item.type)}
              </span>
            </div>
          </div>
        </div>

        {/* Photo grid for diary entries */}
        {hasFullPhoto && (
          <div
            className={`mt-3 gap-1.5 ${
              item.photo_urls!.length === 1
                ? ""
                : `grid ${item.photo_urls!.length === 2 ? "grid-cols-2" : "grid-cols-2"}`
            }`}
          >
            {item.photo_urls!.slice(0, 4).map((url, i) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-xl ${
                  item.photo_urls!.length === 1 ? "h-[160px] w-full" : "aspect-square"
                }`}
              >
                <Image
                  src={url}
                  alt={item.caption ?? item.title ?? ""}
                  fill
                  className="object-cover"
                  sizes={
                    item.photo_urls!.length === 1 ? "(max-width: 448px) 100vw, 400px" : "180px"
                  }
                />
                {i === 3 && item.photo_urls!.length > 4 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-bold">
                    +{item.photo_urls!.length - 4}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enrich prompt — 48h window, dashed border */}
      {showEnrichPrompt && (
        <button className="flex w-full items-center justify-center gap-2 border-t border-dashed border-[rgba(255,130,99,0.4)] px-4 py-2.5 text-[11px] font-semibold text-primary active:bg-surface-alt">
          <span aria-hidden>📸</span>
          เพิ่มรูปหรือข้อความไหม?
        </button>
      )}
    </div>
  );
}

// ─── Inline skeleton while loading first page ─────────────────────────────────

function DiaryTimelineSkeleton() {
  return (
    <>
      <span className="skeleton block rounded-full h-2.5 w-28 ml-1" aria-hidden />
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface border border-border rounded-2xl shadow-soft p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="skeleton rounded-full w-9 h-9 flex-shrink-0" aria-hidden />
            <div className="flex-1 space-y-1.5">
              <span className="skeleton block rounded-full h-3 w-32" aria-hidden />
              <span className="skeleton block rounded-full h-2 w-20" aria-hidden />
            </div>
          </div>
          {i === 1 && <span className="skeleton block rounded-xl h-[160px] w-full" aria-hidden />}
        </div>
      ))}
    </>
  );
}
