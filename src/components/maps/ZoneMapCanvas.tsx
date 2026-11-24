import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ServiceZone } from '../../types/domain';

interface ZoneMapCanvasProps {
  apiKey: string | null;
  zones: ServiceZone[];
  draftCenter: { lat: number; lng: number } | null;
  draftRadiusKm: number;
  selectedZoneId?: string | null;
  onPickCoordinates: (lat: number, lng: number) => void;
  onSelectZone?: (zone: ServiceZone) => void;
}

const DEFAULT_CENTER: [number, number] = [25.1345, 87.3912];

export const ZoneMapCanvas: React.FC<ZoneMapCanvasProps> = ({
  zones,
  draftCenter,
  draftRadiusKm,
  selectedZoneId,
  onPickCoordinates,
  onSelectZone,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPickCoordinates);
  pickRef.current = onPickCoordinates;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: DEFAULT_CENTER, zoom: 12 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    groupRef.current = group;

    map.on('click', (e: L.LeafletMouseEvent) => {
      pickRef.current(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => map.invalidateSize(), 250);
    return () => {
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    zones.forEach((z: any) => {
      const lat = z.center_lat ?? z.lat;
      const lng = z.center_lng ?? z.lng;
      const radKm = z.radius_km ?? 10;
      if (typeof lat === 'number' && typeof lng === 'number') {
        const isSel = z.id === selectedZoneId;
        const circle = L.circle([lat, lng], {
          radius: radKm * 1000,
          color: isSel ? '#2563eb' : '#10b981',
          fillOpacity: 0.15,
        }).addTo(group);
        if (onSelectZone) circle.on('click', () => onSelectZone(z));
      }
    });

    if (draftCenter) {
      L.circle([draftCenter.lat, draftCenter.lng], {
        radius: (draftRadiusKm || 5) * 1000,
        color: '#f59e0b',
        fillOpacity: 0.2,
      }).addTo(group);
      map.setView([draftCenter.lat, draftCenter.lng], 12);
    }
  }, [zones, draftCenter, draftRadiusKm, selectedZoneId]);

  return <div ref={containerRef} className="w-full h-96 rounded-xl overflow-hidden border border-slate-200 z-0" />;
};
