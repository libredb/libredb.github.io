import React from "react";

const SIZES = { s: 16, m: 24, l: 36 };

export function Spinner({ size = "m", label = "Yükleniyor", tone = "brand" }) {
  const box = SIZES[size] || SIZES.m;
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: "inline-block",
        width: box,
        height: box,
        flex: "none",
        borderRadius: "50%",
        border: Math.max(2, Math.round(box / 12)) + "px solid " + (tone === "inverse" ? "rgba(255,255,255,.3)" : "var(--border)"),
        borderTopColor: tone === "inverse" ? "#fff" : "var(--action-primary)",
        animation: "ldb-spin .7s linear infinite"
      }}
    />
  );
}

export function ProgressBar({ value = 0, label, tone = "brand", showValue = true }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      {(label || showValue) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-03)", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--text-tertiary)" }}>
          <span>{label}</span>
          {showValue && <span style={{ fontFamily: "var(--font-mono)" }}>{clamped}%</span>}
        </div>
      )}
      <div role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}
        style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ width: clamped + "%", height: "100%", borderRadius: 3, background: tone === "data" ? "var(--gradient-data)" : "var(--gradient-brand)", transition: "width var(--duration-normal) var(--ease-out)" }} />
      </div>
    </div>
  );
}
