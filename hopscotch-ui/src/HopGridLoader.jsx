// src/HopGridLoader.jsx
// The animated hopscotch-court logo squares (same art as the VD footer).
// The hop-sq classes animate on screen; during PDF capture the parent gets
// vd-diagram--print-freeze which freezes every square at full color.
import React from "react";

export default function HopGridLoader({ className = "" }) {
  return (
    <svg
      className={`hop-grid-loader ${className}`}
      viewBox="0 0 128 46"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      fill="none"
      aria-hidden="true"
    >
      <rect className="hop-sq sq-1" x="0" y="0" width="18" height="22" rx="6" fill="#2B5EA7" />
      <rect className="hop-sq sq-2" x="0" y="24" width="18" height="22" rx="6" fill="#E8618C" />
      <rect className="hop-sq sq-3" x="22" y="12" width="18" height="22" rx="6" fill="#D94040" />
      <rect className="hop-sq sq-4" x="44" y="0" width="18" height="22" rx="6" fill="#1A8A7D" />
      <rect className="hop-sq sq-5" x="44" y="24" width="18" height="22" rx="6" fill="#B0A47A" />
      <rect className="hop-sq sq-6" x="66" y="12" width="18" height="22" rx="6" fill="#00AEEF" />
      <rect className="hop-sq sq-7" x="88" y="0" width="18" height="22" rx="6" fill="#F0B429" />
      <rect className="hop-sq sq-8" x="88" y="24" width="18" height="22" rx="6" fill="#F5922A" />
      <path className="hop-sq sq-9" d="M110,7 A16,16 0 0,1 110,39 Z" fill="#7B8794" />
    </svg>
  );
}
