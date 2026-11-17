"use client";

import { useEffect, useRef, useState } from "react";

type BusinessPin = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

type AdminMapPickerProps = {
  latitude: string;
  longitude: string;
  existingBusinesses?: BusinessPin[];
  onSelectLocation: (lat: number, lng: number, addressSuggestion?: string) => void;
};

const MSAKEN_CENTER = { lat: 35.7273, lng: 10.5815 };

const PRESET_ZONES = [
  { name: "Av. Habib Bourguiba (Centre)", lat: 35.7289, lng: 10.581, addr: "Avenue Habib Bourguiba, M'Saken Centre" },
  { name: "Av. de l'Environnement", lat: 35.7318, lng: 10.5842, addr: "Avenue de l'Environnement, M'Saken" },
  { name: "Route de Messaadine", lat: 35.742, lng: 10.589, addr: "Route de Messaadine, M'Saken" },
  { name: "Rue Taieb Mhiri", lat: 35.7245, lng: 10.5788, addr: "Rue Taieb Mhiri, M'Saken" },
  { name: "Cité El Bassatine", lat: 35.7296, lng: 10.5767, addr: "Avenue Habib Bourguiba, Cité El Bassatine, M'Saken" },
  { name: "Zone Marché / Sidi Abar", lat: 35.7335, lng: 10.5865, addr: "3 Rue Sidi Abar, M'Saken" },
];

export function AdminMapPicker({
  latitude,
  longitude,
  existingBusinesses = [],
  onSelectLocation,
}: AdminMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const selectedMarkerRef = useRef<any>(null);
  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  const parsedLat = parseFloat(latitude);
  const parsedLng = parseFloat(longitude);
  const hasValidCoords = !isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat !== 0 && parsedLng !== 0;

  // 1. Charger Leaflet CSS et JS dynamiquement sans dépendance SSR
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Charger CSS si absent
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Charger JS si absent
    if ((window as any).L) {
      setIsLeafletReady(true);
    } else {
      const existingScript = document.getElementById("leaflet-js");
      if (existingScript) {
        existingScript.addEventListener("load", () => setIsLeafletReady(true));
      } else {
        const script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        script.onload = () => setIsLeafletReady(true);
        document.body.appendChild(script);
      }
    }
  }, []);

  // 2. Initialiser la carte quand Leaflet est prêt
  useEffect(() => {
    if (!isLeafletReady || !containerRef.current) return;
    if (mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    const initialLat = hasValidCoords ? parsedLat : MSAKEN_CENTER.lat;
    const initialLng = hasValidCoords ? parsedLng : MSAKEN_CENTER.lng;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap · REDGO",
    }).addTo(map);

    mapInstanceRef.current = map;

    // Icône personnalisée pour le restaurant sélectionné (Pin Rouge REDGO)
    const redPinIcon = L.divIcon({
      className: "redgo-active-marker",
      html: `
        <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(255,38,56,0.35); animation:pulse 2s infinite;"></div>
          <div style="width:28px; height:28px; border-radius:50%; background:#FF2638; border:3px solid #FFFFFF; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.5);">
            <span style="font-size:14px;">🏪</span>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    // Icône pour les autres restaurants déjà existants (Pin Gris/Bleu informatif)
    const otherPinIcon = L.divIcon({
      className: "redgo-existing-marker",
      html: `
        <div style="width:20px; height:20px; border-radius:50%; background:#3F3F46; border:2px solid #A1A1AA; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.4);">
          <span style="font-size:10px;">🍽️</span>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    // Ajouter les pins des autres restaurants existants
    existingBusinesses.forEach((b) => {
      if (b.latitude && b.longitude) {
        L.marker([b.latitude, b.longitude], { icon: otherPinIcon })
          .addTo(map)
          .bindPopup(`<b>${b.name}</b><br><span style="font-size:11px;color:#71717A;">Existant dans REDGO</span>`);
      }
    });

    // Si des coordonnées existent déjà, poser le marqueur initial
    if (hasValidCoords) {
      const marker = L.marker([parsedLat, parsedLng], {
        icon: redPinIcon,
        draggable: true,
      }).addTo(map);

      marker.bindPopup("<b>Position du restaurant sélectionné</b><br>Glissez pour ajuster").openPopup();

      marker.on("dragend", (event: any) => {
        const pos = event.target.getLatLng();
        handleNewCoordinates(pos.lat, pos.lng);
      });

      selectedMarkerRef.current = marker;
      setCurrentCoords({ lat: parsedLat, lng: parsedLng });
    }

    // Clic sur la carte pour poser / déplacer le restaurant
    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], {
          icon: redPinIcon,
          draggable: true,
        }).addTo(map);

        marker.on("dragend", (event: any) => {
          const pos = event.target.getLatLng();
          handleNewCoordinates(pos.lat, pos.lng);
        });

        selectedMarkerRef.current = marker;
      }
      handleNewCoordinates(lat, lng);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [isLeafletReady]);

  // Déplacement et notification des nouvelles coordonnées
  const handleNewCoordinates = (lat: number, lng: number, forcedAddress?: string) => {
    const cleanLat = Number(lat.toFixed(6));
    const cleanLng = Number(lng.toFixed(6));
    setCurrentCoords({ lat: cleanLat, lng: cleanLng });

    // Trouver la zone la plus proche de M'Saken pour suggérer l'adresse
    let suggested = forcedAddress;
    if (!suggested) {
      let minDistance = Infinity;
      let nearestPreset: typeof PRESET_ZONES[0] | null = null;
      for (const preset of PRESET_ZONES) {
        const d = Math.hypot(preset.lat - cleanLat, preset.lng - cleanLng);
        if (d < minDistance) {
          minDistance = d;
          nearestPreset = preset;
        }
      }
      if (nearestPreset && minDistance < 0.008) {
        suggested = nearestPreset.addr;
      }
    }

    onSelectLocation(cleanLat, cleanLng, suggested);
  };

  // Sélectionner un preset rapide
  const applyPreset = (preset: typeof PRESET_ZONES[0]) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([preset.lat, preset.lng], 16, { animate: true });
      const L = (window as any).L;
      if (L) {
        if (selectedMarkerRef.current) {
          selectedMarkerRef.current.setLatLng([preset.lat, preset.lng]);
        } else {
          const redPinIcon = L.divIcon({
            className: "redgo-active-marker",
            html: `
              <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
                <div style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(255,38,56,0.35);"></div>
                <div style="width:28px; height:28px; border-radius:50%; background:#FF2638; border:3px solid #FFFFFF; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.5);">
                  <span style="font-size:14px;">🏪</span>
                </div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });

          const marker = L.marker([preset.lat, preset.lng], {
            icon: redPinIcon,
            draggable: true,
          }).addTo(mapInstanceRef.current);

          marker.on("dragend", (event: any) => {
            const pos = event.target.getLatLng();
            handleNewCoordinates(pos.lat, pos.lng);
          });

          selectedMarkerRef.current = marker;
        }
      }
    }
    handleNewCoordinates(preset.lat, preset.lng, preset.addr);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#D4D4D8]">
          🗺️ Sélectionner la position sur la carte de M'Saken :
        </span>
        {currentCoords ? (
          <span className="rounded bg-[#FF2638]/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#FF6370]">
            📍 {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
          </span>
        ) : (
          <span className="text-[11px] text-[#A1A1AA]">
            (Cliquez sur la carte ou choisissez un secteur ci-dessous)
          </span>
        )}
      </div>

      {/* Raccourcis secteurs rapides */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_ZONES.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyPreset(p)}
            className="rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-1 text-[11px] font-medium text-[#D4D4D8] transition hover:border-[#FF2638] hover:bg-[#27272A] hover:text-white"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Conteneur de la carte interactive */}
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-[#3F3F46] bg-[#09090B] shadow-inner">
        <div ref={containerRef} className="h-full w-full" />
        {!isLeafletReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#09090B]/80 text-xs text-[#A1A1AA]">
            Chargement de la carte OpenStreetMap…
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md bg-[#09090B]/90 px-2.5 py-1 text-[10px] text-[#D4D4D8] backdrop-blur border border-[#27272A]">
          👆 <b>Astuce :</b> Cliquez sur la carte ou glissez le pin rouge pour définir l'emplacement exact
        </div>
      </div>
    </div>
  );
}
