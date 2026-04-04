"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Phone, Clock, Navigation, Cross, BadgeCheck, Stethoscope } from "lucide-react";
import hospitalsData from "@/data/hospitals.json";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Fix Leaflet default icon issue in Next.js
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Hospital Icon (Cross)
const hospitalIcon = L.divIcon({
  className: "bg-transparent",
  html: `<div class="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-white shadow-lg">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cross"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function LocationMarker() {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    });
  }, [map]);

  return position === null ? null : (
    <Marker position={position} icon={DefaultIcon}>
      <Popup>You are here</Popup>
    </Marker>
  );
}

// Marker component with click handler
function HospitalMarker({ hospital }: { hospital: any }) {
  const map = useMap();

  return (
    <Marker 
      position={[hospital.lat, hospital.lng]} 
      icon={hospitalIcon}
      eventHandlers={{
        click: () => {
          // Offset the latitude slightly to center the popup (which is above the marker)
          // 0.005 is roughly accurate for Zoom 15 to place the popup near center
          const latOffset = 0.005; 
          map.flyTo([hospital.lat + latOffset, hospital.lng], 15, {
            animate: true,
            duration: 1.5
          });
        }
      }}
    >
      <Popup className="custom-popup">
        <div className="p-0.5 min-w-[220px]">
          {/* Badges */}
          <div className="flex gap-1 mb-1.5">
            {hospital.certified && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <BadgeCheck className="w-3 h-3" />
                Certified
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-200">
              <Stethoscope className="w-3 h-3" />
              {hospital.specialists.length} Specialists
            </span>
          </div>

          {/* Header with name and opening hours */}
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h3 className="font-bold text-sm">{hospital.name}</h3>
            <span className={`text-[10px] flex items-center gap-0.5 whitespace-nowrap ${hospital.open_hours === "24 Hours" ? "text-green-600 font-medium" : "text-gray-500"}`}>
              <Clock className="w-2.5 h-2.5" />
              {hospital.open_hours}
            </span>
          </div>
          
          <div className="space-y-0 mb-1">
            <p className="text-[11px] text-gray-500 flex items-start gap-1 leading-tight">
              <MapPin className="w-2.5 h-2.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <span>{hospital.address}</span>
            </p>
            
            <div className="flex items-center justify-between gap-1 py-0">
              <p className="text-[11px] text-gray-700 flex items-center gap-1 font-medium leading-none">
                <Phone className="w-2.5 h-2.5 flex-shrink-0 text-muted-foreground" />
                {hospital.phone}
              </p>
              <Button size="sm" className="bg-primary hover:bg-primary/90 h-6 text-[10px] px-3 rounded-full shadow-sm" asChild>
                <a href={`tel:${hospital.phone}`} className="flex items-center gap-1" style={{ color: '#FFFFFF' }}>
                  <Phone className="w-2.5 h-2.5" style={{ color: '#FFFFFF' }} />
                  <span style={{ color: '#FFFFFF' }}>Call</span>
                </a>
              </Button>
            </div>
          </div>

          {/* Specialist Tags */}
          {hospital.specialists && hospital.specialists.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mb-1.5">
              {hospital.specialists.slice(0, 3).map((spec: string, i: number) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                  {spec}
                </span>
              ))}
              {hospital.specialists.length > 3 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                  +{hospital.specialists.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="w-full">
            <Button size="sm" variant="outline" className="w-full h-8 text-xs font-medium bg-white" asChild>
              <a 
                href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation className="w-3 h-3 mr-1" />
                Get Directions
              </a>
            </Button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function HospitalMap() {
  const defaultCenter: [number, number] = [13.7563, 100.5018]; // Bangkok default

  return (
    <div className="h-[calc(100vh-64px)] w-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* User Location */}
        <LocationMarker />

        {/* Hospital Markers */}
        {hospitalsData.map((hospital) => (
          <HospitalMarker key={hospital.id} hospital={hospital} />
        ))}
      </MapContainer>
      
      {/* Overlay Title - Compact Rectangular */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex justify-center">
        <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-lg px-6 py-2">
          <h1 className="font-bold text-sm text-foreground text-center">Nearby Hospital</h1>
        </div>
      </div>
    </div>
  );
}
