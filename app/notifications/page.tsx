/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getActiveSOSAlerts, getRecentlyFoundPets, calculateDistance } from "@/lib/db";
import type { SOSAlert, Pet } from "@/lib/types";
import { AlertTriangle, MapPin, Loader2, Navigation, PartyPopper } from "lucide-react";

function NotificationsContent() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<(SOSAlert & { pets: Pet })[]>([]);
  const [foundPets, setFoundPets] = useState<(SOSAlert & { pets: Pet })[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    const [activeResult, foundResult] = await Promise.all([
      getActiveSOSAlerts(),
      getRecentlyFoundPets(),
    ]);
    setAlerts(activeResult.data || []);
    setFoundPets(foundResult.data || []);
    setLoading(false);
  };

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Default to Bangkok if geolocation fails
          setUserLocation({ lat: 13.7563, lng: 100.5018 });
        }
      );
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, []);

  // Filter and sort alerts by distance
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">SOS alerts nearby</p>
          </div>
          {nearbyAlerts.length > 0 && (
            <Badge className="bg-destructive text-white">{nearbyAlerts.length} nearby</Badge>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-6 max-w-md mx-auto space-y-6">
        {/* Good News Section - Recently Found Pets */}
        {foundPets.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
              <PartyPopper className="w-4 h-4" />
              Good News!
            </h2>
            <div className="space-y-3">
              {foundPets.map((alert) => (
                <Card key={alert.id} className="p-3 rounded-xl border-green-200 bg-green-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center overflow-hidden">
                      {alert.pets?.photo_url ? (
                        <img
                          src={alert.pets.photo_url}
                          alt={alert.pets.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">🐕</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-800">
                        {alert.pets?.name || "A pet"} was found!
                      </h3>
                      <p className="text-xs text-green-600">
                        {alert.pets?.breed} • Found{" "}
                        {new Date(alert.resolved_at || "").toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-2xl">🎉</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {alertsWithDistance.length === 0 && foundPets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎉</span>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">No active alerts</h2>
            <p className="text-muted-foreground">All pets in your area are safe!</p>
          </div>
        ) : alertsWithDistance.length > 0 ? (
          <>
            {/* Nearby Alerts (< 5km) */}
            {nearbyAlerts.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Nearby Alerts (within 5km)
                </h2>
                <div className="space-y-3">
                  {nearbyAlerts.map((alert) => (
                    <Card
                      key={alert.id}
                      className="p-4 rounded-xl border-destructive/30 bg-destructive/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                          <span className="text-xl">🐕</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">
                            {alert.pets?.name || "Unknown Pet"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {alert.pets?.breed || "Unknown breed"}
                          </p>
                          {alert.description && (
                            <p className="text-sm text-foreground mt-1">{alert.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="outline"
                              className="text-destructive border-destructive/30"
                            >
                              <Navigation className="w-3 h-3 mr-1" />
                              {alert.distance?.toFixed(1)} km away
                            </Badge>
                            <Badge variant="outline" className="text-muted-foreground">
                              <MapPin className="w-3 h-3 mr-1" />
                              {alert.lat.toFixed(3)}, {alert.lng.toFixed(3)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Other Alerts */}
            {otherAlerts.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                  Other Active Alerts
                </h2>
                <div className="space-y-3">
                  {otherAlerts.map((alert) => (
                    <Card key={alert.id} className="p-4 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-lg">🐕</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">
                            {alert.pets?.name || "Unknown Pet"}
                          </h3>
                          <p className="text-sm text-muted-foreground">{alert.pets?.breed}</p>
                          {alert.distance !== null && (
                            <Badge variant="outline" className="mt-2 text-muted-foreground">
                              <Navigation className="w-3 h-3 mr-1" />
                              {alert.distance.toFixed(1)} km away
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  );
}

export default function NotificationsPage() {
  return <NotificationsContent />;
}
