"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/liff-provider";
import { AlertCard } from "@/components/post/alert-card";
import { RadiusSelector } from "@/components/post/radius-selector";
import { SpeciesFilter } from "@/components/post/species-filter";
import type { LostPetAlert } from "@/components/post/types";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FoundReportCard } from "@/components/post/found-report-card";
import type { FoundReport } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/skeleton-card";
import { AlertTriangle, Loader2, MapPin, CheckCircle, ChevronDown, Plus } from "lucide-react";

type TabType = "lost" | "found" | "all";

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
  return `${Math.floor(diffDay / 7)} สัปดาห์ที่แล้ว`;
}

function MyAlertsSection({
  alerts,
  onResolve,
}: {
  alerts: LostPetAlert[];
  onResolve: (alertId: string, status: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (alerts.length === 0) return null;

  return (
    <section aria-label="ประกาศของฉัน" className="mb-4">
      <h2 className="text-sm font-bold text-text-main mb-2 px-1">ประกาศของฉัน</h2>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-surface rounded-2xl border border-border p-3 shadow-soft"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/post/${alert.id}`}
                  className="font-bold text-sm text-text-main hover:text-primary truncate block"
                >
                  {alert.pet_name || "ไม่ระบุชื่อ"} —{" "}
                  <span className="text-danger text-xs font-bold">หาย</span>
                </Link>
                <p className="text-xs text-text-muted mt-0.5">
                  {getRelativeTimeThai(alert.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                aria-expanded={expandedId === alert.id}
                className="text-xs text-primary font-bold flex items-center gap-1 touch-target px-2 -mx-2"
              >
                จัดการ
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    expandedId === alert.id && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
            </div>
            {expandedId === alert.id && (
              <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
                <p className="text-xs text-text-muted mb-2">เปลี่ยนสถานะประกาศ:</p>
                <button
                  type="button"
                  onClick={() => onResolve(alert.id, "resolved_found")}
                  className="w-full py-2.5 text-xs font-bold text-success bg-success-bg rounded-full hover:brightness-105 transition-all flex items-center justify-center gap-1 touch-target"
                >
                  <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                  พบน้องแล้ว (คนอื่นเจอ)
                </button>
                <button
                  type="button"
                  onClick={() => onResolve(alert.id, "resolved_owner")}
                  className="w-full py-2.5 text-xs font-bold text-info bg-info-bg rounded-full hover:brightness-105 transition-all flex items-center justify-center gap-1 touch-target"
                >
                  <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                  น้องกลับบ้านเองแล้ว
                </button>
                <button
                  type="button"
                  onClick={() => onResolve(alert.id, "resolved_other")}
                  className="w-full py-2.5 text-xs font-bold text-text-subtle bg-surface-alt rounded-full hover:bg-border transition-all touch-target"
                >
                  ปิดประกาศ (อื่น ๆ)
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PostPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("lost");
  const [radius, setRadius] = useState<number | null>(1000);
  const [species, setSpecies] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<LostPetAlert[]>([]);
  const [myAlerts, setMyAlerts] = useState<LostPetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [foundReports, setFoundReports] = useState<FoundReport[]>([]);
  const [loadingFound, setLoadingFound] = useState(false);
  const [foundCursor, setFoundCursor] = useState<string | null>(null);
  const [hasMoreFound, setHasMoreFound] = useState(false);
  const [loadingMoreFound, setLoadingMoreFound] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const foundSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          setUserLocation({ lat: 13.7563, lng: 100.5018 });
        }
      );
    } else {
      setUserLocation({ lat: 13.7563, lng: 100.5018 });
    }
  }, []);

  const fetchAlerts = useCallback(
    async (append = false) => {
      if (!userLocation) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setCursor(null);
      }

      try {
        const params = new URLSearchParams();
        params.set("lat", String(userLocation.lat));
        params.set("lng", String(userLocation.lng));
        if (radius) params.set("radius", String(radius));
        if (activeTab !== "all") params.set("alert_type", activeTab);
        if (species) params.set("species", species);
        if (append && cursor) params.set("cursor", cursor);
        params.set("limit", "20");

        const data = await apiFetch(`/api/post?${params.toString()}`);

        const items: LostPetAlert[] = data.alerts || data.data || [];
        const nextCursor = data.cursor || data.next_cursor || null;

        if (append) {
          setAlerts((prev) => [...prev, ...items]);
        } else {
          setAlerts(items);
        }
        setCursor(nextCursor);
        setHasMore(!!nextCursor);
      } catch {
        if (!append) setAlerts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userLocation, radius, activeTab, species, cursor]
  );

  const fetchMyAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch(`/api/post?owner_id=${user.id}&status=active`);
      setMyAlerts(data.alerts || data.data || []);
    } catch {
      setMyAlerts([]);
    }
  }, [user]);

  const fetchFoundReports = useCallback(
    async (append = false) => {
      if (append) {
        setLoadingMoreFound(true);
      } else {
        setLoadingFound(true);
        setFoundCursor(null);
      }

      try {
        const params = new URLSearchParams();
        if (species) params.set("species", species);
        if (append && foundCursor) params.set("cursor", foundCursor);
        params.set("limit", "20");

        const data = await apiFetch(`/api/found-reports?${params.toString()}`);

        const items: FoundReport[] = data.data || [];
        const nextCursor = data.cursor || null;

        if (append) {
          setFoundReports((prev) => [...prev, ...items]);
        } else {
          setFoundReports(items);
        }
        setFoundCursor(nextCursor);
        setHasMoreFound(!!nextCursor);
      } catch {
        if (!append) setFoundReports([]);
      } finally {
        setLoadingFound(false);
        setLoadingMoreFound(false);
      }
    },
    [species, foundCursor]
  );

  useEffect(() => {
    if (userLocation) {
      fetchAlerts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, radius, activeTab, species]);

  useEffect(() => {
    if (activeTab === "found") {
      fetchFoundReports(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, species]);

  useEffect(() => {
    fetchMyAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchAlerts(true);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchAlerts]);

  useEffect(() => {
    if (!hasMoreFound || loadingMoreFound) return;
    const sentinel = foundSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreFound && !loadingMoreFound) {
          fetchFoundReports(true);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreFound, loadingMoreFound, fetchFoundReports]);

  const handleResolve = async (alertId: string, status: string) => {
    try {
      await apiFetch("/api/post", {
        method: "PUT",
        body: JSON.stringify({ alert_id: alertId, status }),
      });
      fetchMyAlerts();
      fetchAlerts(false);
    } catch (err) {
      console.error("Error resolving alert:", err);
    }
  };

  const tabs: { key: TabType; label: string; tone: string }[] = [
    { key: "lost", label: "หาย", tone: "bg-danger" },
    { key: "found", label: "พบ", tone: "bg-success" },
    { key: "all", label: "ทั้งหมด", tone: "bg-text-muted" },
  ];

  return (
    <div className="min-h-screen-safe">
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" aria-hidden />
          <h1 className="text-xl font-bold text-text-main">สัตว์เลี้ยงหาย</h1>
        </div>
        <p className="text-xs text-text-muted">ช่วยกันตามหาสัตว์เลี้ยงในชุมชน</p>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        <MyAlertsSection alerts={myAlerts} onResolve={handleResolve} />

        <div
          role="tablist"
          aria-label="เลือกประเภทประกาศ"
          className="flex gap-1 bg-surface rounded-full p-1 border border-border shadow-soft"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-bold rounded-full transition-all flex items-center justify-center gap-1.5 touch-target",
                  isActive
                    ? "bg-primary-gradient text-white shadow-primary"
                    : "text-text-muted hover:text-text-main"
                )}
              >
                <span
                  className={cn("w-2 h-2 rounded-full", isActive ? "bg-surface" : tab.tone)}
                  aria-hidden
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <RadiusSelector value={radius} onChange={setRadius} />
          <SpeciesFilter value={species} onChange={setSpecies} />
        </div>

        {activeTab === "found" && (
          <>
            {loadingFound ? (
              <div className="space-y-3">
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
              </div>
            ) : foundReports.length === 0 ? (
              <EmptyState
                emoji="🐾"
                title="ยังไม่มีรายงาน"
                description="ยังไม่มีรายงานพบสัตว์เลี้ยงในขณะนี้"
              />
            ) : (
              <div className="space-y-3">
                {foundReports.map((report) => (
                  <FoundReportCard key={report.id} report={report} />
                ))}
              </div>
            )}

            {hasMoreFound && (
              <div ref={foundSentinelRef} className="flex justify-center py-4">
                {loadingMoreFound && (
                  <Loader2 className="w-6 h-6 animate-spin text-success" aria-hidden />
                )}
              </div>
            )}
          </>
        )}

        {activeTab !== "found" && (
          <>
            {loading ? (
              <div className="space-y-3">
                <SkeletonCard lines={4} />
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
              </div>
            ) : alerts.length === 0 ? (
              <EmptyState
                icon={<MapPin className="w-10 h-10" aria-hidden />}
                title="ไม่พบประกาศ"
                description={
                  radius ? "ไม่มีประกาศในรัศมีที่เลือก ลองขยายรัศมีดู" : "ยังไม่มีประกาศในขณะนี้"
                }
              />
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            )}

            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore && (
                  <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {activeTab === "found" ? (
        <Link
          href="/post/found"
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-success text-white font-bold shadow-[0_4px_14px_rgba(76,107,60,0.3)] hover:scale-105 transition-transform active:scale-95 touch-target"
        >
          <Plus className="w-5 h-5" aria-hidden />
          <span>แจ้งพบสัตว์เลี้ยง</span>
        </Link>
      ) : (
        <Link
          href="/post/lost"
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-primary-gradient text-white font-bold shadow-primary hover:scale-105 transition-transform active:scale-95 touch-target"
        >
          <AlertTriangle className="w-5 h-5" aria-hidden />
          <span>แจ้งน้องหาย</span>
        </Link>
      )}
    </div>
  );
}
