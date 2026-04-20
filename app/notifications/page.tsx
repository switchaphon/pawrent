/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/liff-provider";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/skeleton-card";
import { getActivePetReports, getRecentlyFoundReports, calculateDistance } from "@/lib/db";
import type { PetReport, Pet } from "@/lib/types";
import { AlertTriangle, MapPin, Navigation, PartyPopper } from "lucide-react";

function NotificationsContent() {
  useAuth();
  const [alerts, setAlerts] = useState<(PetReport & { pets: Pet })[]>([]);
  const [foundPets, setFoundPets] = useState<(PetReport & { pets: Pet })[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    const [activeResult, foundResult] = await Promise.all([
      getActivePetReports(),
      getRecentlyFoundReports(),
    ]);
    setAlerts(activeResult.data || []);
    setFoundPets(foundResult.data || []);
    setLoading(false);
  };

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
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, []);

  const alertsWithDistance = userLocation
    ? alerts
        .map((alert) => ({
          ...alert,
          distance: calculateDistance(userLocation.lat, userLocation.lng, alert.lat, alert.lng),
        }))
        .sort((a, b) => a.distance - b.distance)
    : alerts.map((alert) => ({ ...alert, distance: null }));

  const nearbyAlerts = alertsWithDistance.filter((a) => a.distance !== null && a.distance < 5);
  const otherAlerts = alertsWithDistance.filter((a) => a.distance === null || a.distance >= 5);

  return (
    <div className="min-h-screen-safe">
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-main">แจ้งเตือน</h1>
            <p className="text-xs text-text-muted">ประกาศในละแวกใกล้เคียง</p>
          </div>
          {nearbyAlerts.length > 0 && <Badge variant="danger">ใกล้คุณ {nearbyAlerts.length}</Badge>}
        </div>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto space-y-5">
        {loading ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </>
        ) : (
          <>
            {foundPets.length > 0 && (
              <section aria-label="ข่าวดี">
                <h2 className="text-sm font-bold text-success mb-3 flex items-center gap-2 px-1">
                  <PartyPopper className="w-4 h-4" aria-hidden />
                  ข่าวดี!
                </h2>
                <div className="space-y-3">
                  {foundPets.map((alert) => (
                    <article
                      key={alert.id}
                      className="p-4 rounded-[24px] border border-success/30 bg-success-bg shadow-soft"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-pops-gradient p-[2px] overflow-hidden">
                          <div className="w-full h-full rounded-full bg-surface overflow-hidden">
                            {alert.pets?.photo_url ? (
                              <img
                                src={alert.pets.photo_url}
                                alt={alert.pets.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span
                                className="flex items-center justify-center h-full text-lg"
                                aria-hidden
                              >
                                🐕
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-success truncate">
                            {alert.pets?.name || "น้องคนหนึ่ง"} กลับบ้านแล้ว!
                          </h3>
                          <p className="text-xs text-success/90 truncate">
                            {alert.pets?.breed} · พบเมื่อ{" "}
                            {new Date(alert.resolved_at || "").toLocaleDateString("th-TH")}
                          </p>
                        </div>
                        <span className="text-2xl" aria-hidden>
                          🎉
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {alertsWithDistance.length === 0 && foundPets.length === 0 ? (
              <EmptyState
                emoji="🎉"
                title="ยังไม่มีประกาศที่ต้องจับตา"
                description="สัตว์เลี้ยงในพื้นที่ของคุณปลอดภัยดี"
              />
            ) : alertsWithDistance.length > 0 ? (
              <>
                {nearbyAlerts.length > 0 && (
                  <section aria-label="ประกาศในรัศมี 5 กม.">
                    <h2 className="text-sm font-bold text-danger mb-3 flex items-center gap-2 px-1">
                      <AlertTriangle className="w-4 h-4" aria-hidden />
                      ใกล้คุณ (ภายใน 5 กม.)
                    </h2>
                    <div className="space-y-3">
                      {nearbyAlerts.map((alert) => (
                        <article
                          key={alert.id}
                          className="p-4 rounded-[24px] border border-danger/30 bg-danger-bg shadow-soft"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-danger/15 flex items-center justify-center flex-shrink-0">
                              <span className="text-xl" aria-hidden>
                                🐕
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-text-main truncate">
                                {alert.pets?.name || "น้องไม่ทราบชื่อ"}
                              </h3>
                              <p className="text-xs text-text-muted">
                                {alert.pets?.breed || "ไม่ระบุสายพันธุ์"}
                              </p>
                              {alert.description && (
                                <p className="text-sm text-text-main mt-1 leading-relaxed">
                                  {alert.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="danger">
                                  <Navigation className="w-3 h-3" aria-hidden />
                                  ห่าง {alert.distance?.toFixed(1)} กม.
                                </Badge>
                                <Badge variant="outline">
                                  <MapPin className="w-3 h-3" aria-hidden />
                                  {alert.lat.toFixed(3)}, {alert.lng.toFixed(3)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {otherAlerts.length > 0 && (
                  <section aria-label="ประกาศที่ยังใช้งานอยู่อื่น ๆ">
                    <h2 className="text-sm font-bold text-text-muted mb-3 px-1">ประกาศอื่น ๆ</h2>
                    <div className="space-y-3">
                      {otherAlerts.map((alert) => (
                        <article
                          key={alert.id}
                          className="p-4 rounded-[24px] border border-border bg-surface shadow-soft"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full bg-surface-alt flex items-center justify-center flex-shrink-0">
                              <span className="text-lg" aria-hidden>
                                🐕
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-text-main truncate">
                                {alert.pets?.name || "น้องไม่ทราบชื่อ"}
                              </h3>
                              <p className="text-xs text-text-muted">{alert.pets?.breed}</p>
                              {alert.distance !== null && (
                                <Badge variant="outline" className="mt-2">
                                  <Navigation className="w-3 h-3" aria-hidden />
                                  ห่าง {alert.distance.toFixed(1)} กม.
                                </Badge>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

export default function NotificationsPage() {
  return <NotificationsContent />;
}
