import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Driver, DriverLocation, Ride } from '../../types/domain';

interface LiveRideMapCanvasProps {
  apiKey: string | null;
  driverLocations: DriverLocation[];
  drivers: Driver[];
  activeRides: Ride[];
  onSelectRide?: (rideId: string) => void;
}

const DEFAULT_CENTER: [number, number] = [25.1345, 87.3912];

export const LiveRideMapCanvas: React.FC<LiveRideMapCanvasProps> = ({
  driverLocations,
  drivers,
  activeRides,
  onSelectRide,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: DEFAULT_CENTER, zoom: 12 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    groupRef.current = group;
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
    const pts: L.LatLngExpression[] = [];

    driverLocations.forEach((loc) => {
      const drv = drivers.find((d) => d.id === loc.driver_id || d.user_id === loc.driver_id);
      const icon = L.divIcon({
        className: 'adm-drv',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
        iconSize: L.point(14, 14),
        iconAnchor: L.point(7, 7),
      });
      L.marker([loc.lat, loc.lng], { icon })
        .bindPopup(`<b>${drv?.full_name || 'Captain'}</b><br/>${drv?.vehicle_number || ''}`)
        .addTo(group);
      pts.push([loc.lat, loc.lng]);
    });

    activeRides.forEach((ride) => {
      if (ride.pickup_lat && ride.pickup_lng) {
        const icon = L.divIcon({
          className: 'adm-ride',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:2px solid #0f172a;"></div>`,
          iconSize: L.point(14, 14),
          iconAnchor: L.point(7, 7),
        });
        const m = L.marker([ride.pickup_lat, ride.pickup_lng], { icon })
          .bindPopup(`<b>Ride #${ride.id.slice(0, 6)}</b><br/>${ride.pickup_address || ''}`)
          .addTo(group);
        if (onSelectRide) m.on('click', () => onSelectRide(ride.id));
        pts.push([ride.pickup_lat, ride.pickup_lng]);
      }
    });

    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts), { padding: L.point(40, 40), maxZoom: 15 });
    }
  }, [driverLocations, drivers, activeRides]);

  return <div ref={containerRef} className="w-full h-96 rounded-xl overflow-hidden border border-slate-200 z-0" />;
};
