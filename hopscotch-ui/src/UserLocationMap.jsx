// src/UserLocationMap.jsx — World map with gradient heatmap layer
import React, { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";

/**
 * Inner component that renders the L.heatLayer on the Leaflet map.
 * Uses useMap() to access the map instance after it's created.
 */
function HeatLayer({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (!locations.length) return;

    // Build heat data: [lat, lng, intensity]
    // Intensity is the login count — leaflet.heat normalizes automatically
    const points = locations.map((loc) => [loc.lat, loc.lng, loc.count]);

    const heat = L.heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 10,
      max: Math.max(...locations.map((l) => l.count)),
      minOpacity: 0.35,
      gradient: {
        0.0: "#2B5EA7",   // cool blue
        0.25: "#00AEEF",  // light blue
        0.45: "#16A34A",  // green
        0.6: "#F0B429",   // yellow
        0.8: "#F5922A",   // orange
        1.0: "#DC2626",   // red
      },
    });

    heat.addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, locations]);

  return null;
}

/**
 * Invisible markers for popups — so users can still click locations
 * to see details, even with the heatmap overlay.
 */
function ClickablePoints({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (!locations.length) return;

    const markers = locations.map((loc) => {
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: 6,
        fillColor: "#fff",
        fillOpacity: 0.7,
        color: "#2B5EA7",
        weight: 1.5,
        opacity: 0.9,
      });

      const usersStr = (loc.users || []).join(", ");
      const lastStr = loc.last_login
        ? new Date(loc.last_login).toLocaleString()
        : "N/A";

      marker.bindPopup(
        `<strong>${loc.city || ""}${loc.country ? `, ${loc.country}` : ""}</strong><br/>` +
        `${loc.count} login(s)<br/>` +
        `Users: ${usersStr}<br/>` +
        `Last: ${lastStr}`
      );

      marker.bindTooltip(
        `<strong>${loc.city || ""}${loc.country ? `, ${loc.country}` : ""}</strong><br/>${loc.count} login(s)`,
        { direction: "top", offset: [0, -8], opacity: 0.95 }
      );

      marker.addTo(map);
      return marker;
    });

    return () => {
      markers.forEach((m) => map.removeLayer(m));
    };
  }, [map, locations]);

  return null;
}

export default function UserLocationMap({ locations = [] }) {
  if (!locations.length) {
    return (
      <div className="ad-empty">
        No location data available yet. Locations appear after users log in.
      </div>
    );
  }

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height: "500px", width: "100%", borderRadius: "8px" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <HeatLayer locations={locations} />
      <ClickablePoints locations={locations} />
    </MapContainer>
  );
}
