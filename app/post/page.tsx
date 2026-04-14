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
import { AlertTriangle, Loader2, MapPin, CheckCircle, ChevronDown } from "lucide-react";

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

// Owner's active alerts section
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
    <section className="mb-4">
      <h2 className="text-sm font-bold text-foreground mb-2 px-1">ประกาศของฉัน</h2>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="bg-white rounded-xl border border-border p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/post/${alert.id}`}
                  className="font-semibold text-sm text-foreground hover:text-primary truncate block"
                >
                  {alert.pet_name || "ไม่ระบุชื่อ"} —{" "}
                  <span className="text-red-500 text-xs font-bold">หาย</span>
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getRelativeTimeThai(alert.created_at)}
                </p>
              </div>
              <button
                onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                className="ml-2 text-xs text-primary font-medium flex items-center gap-1"
              >
                จัดการ
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    expandedId === alert.id && "rotate-180"
                  )}
                />
              </button>
            </div>
            {expandedId === alert.id && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <p className="text-xs text-muted-foreground mb-2">เปลี่ยนสถานะประกาศ:</p>
                <button
                  onClick={() => onResolve(alert.id, "resolved_found")}
                  className="w-full py-2 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  พบน้องแล้ว (คนอื่นเจอ)
                </button>
                <button
                  onClick={() => onResolve(alert.id, "resolved_owner")}
                  className="w-full py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  น้องกลับบ้านเองแล้ว
                </button>
                <button
                  onClick={() => onResolve(alert.id, "resolved_other")}
                  className="w-full py-2 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ปิดประกาศ (อื่นๆ)
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
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Get user location
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
          // Default to Bangkok
          setUserLocation({ lat: 13.7563, lng: 100.5018 });
        }
      );
    } else {
      setUserLocation({ lat: 13.7563, lng: 100.5018 });
    }
  }, []);

  // Fetch alerts
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
        // API may not exist yet - that's expected during parallel development
        if (!append) setAlerts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userLocation, radius, activeTab, species, cursor]
  );

  // Fetch my alerts
  const fetchMyAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch(`/api/post?owner_id=${user.id}&status=active`);
      setMyAlerts(data.alerts || data.data || []);
    } catch {
      setMyAlerts([]);
    }
  }, [user]);

  // Initial load and reload on filter changes
  useEffect(() => {
    if (userLocation) {
      fetchAlerts(false);
    }
  }, [userLocation, radius, activeTab, species]);

  useEffect(() => {
    fetchMyAlerts();
  }, [user]);

  // Infinite scroll via IntersectionObserver
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

  // Resolve alert handler
  const handleResolve = async (alertId: string, status: string) => {
    try {
      await apiFetch("/api/post", {
        method: "PUT",
        body: JSON.stringify({ alert_id: alertId, status }),
      });
      // Refresh both lists
      fetchMyAlerts();
      fetchAlerts(false);
    } catch (err) {
      console.error("Error resolving alert:", err);
    }
  };

  const tabs: { key: TabType; label: string; color: string }[] = [
    { key: "lost", label: "หาย", color: "bg-red-500" },
    { key: "found", label: "พบ", color: "bg-green-500" },
    { key: "all", label: "ทั้งหมด", color: "bg-gray-500" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">สัตว์เลี้ยงหาย</h1>
        </div>
        <p className="text-sm text-muted-foreground">ช่วยกันตามหาสัตว์เลี้ยงในชุมชน</p>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        {/* My Alerts */}
        <MyAlertsSection alerts={myAlerts} onResolve={handleResolve} />

        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5",
                activeTab === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  activeTab === tab.key ? "bg-white" : tab.color
                )}
              />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <RadiusSelector value={radius} onChange={setRadius} />
          <SpeciesFilter value={species} onChange={setSpecies} />
        </div>

        {/* Found tab placeholder */}
        {activeTab === "found" && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🐾</span>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">เร็วๆ นี้</h3>
            <p className="text-sm text-muted-foreground">
              ระบบแจ้งพบสัตว์เลี้ยงจะเปิดให้ใช้งานเร็วๆ นี้
            </p>
          </div>
        )}

        {/* Alert list */}
        {activeTab !== "found" && (
          <>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-primary/50" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">ไม่พบประกาศ</h3>
                <p className="text-sm text-muted-foreground">
                  {radius ? "ไม่มีประกาศในรัศมีที่เลือก ลองขยายรัศมีดู" : "ยังไม่มีประกาศในขณะนี้"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating CTA */}
      <Link
        href="/post/lost"
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-destructive text-white font-bold shadow-xl hover:scale-105 transition-transform active:scale-95"
      >
        <AlertTriangle className="w-5 h-5" />
        <span>แจ้งสัตว์เลี้ยงหาย</span>
      </Link>
    </div>
  );
}
