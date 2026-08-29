import React from "react";

const shimmer = {
  background: "linear-gradient(90deg, var(--background-subtle) 25%, var(--border-subtle) 37%, var(--background-subtle) 63%)",
  backgroundSize: "200% 100%",
  animation: "ldb-shimmer 1.6s linear infinite"
};

export function Skeleton({ variant = "text", width, height, lines = 3, ratio = "16 / 9" }) {
  if (variant === "media") {
    return <div aria-hidden="true" style={{ ...shimmer, width: width || "100%", aspectRatio: height ? undefined : ratio, height, borderRadius: "var(--radius-m)" }} />;
  }
  if (variant === "circle") {
    const box = width || height || 40;
    return <div aria-hidden="true" style={{ ...shimmer, width: box, height: box, borderRadius: "50%", flex: "none" }} />;
  }
  const widths = ["92%", "74%", "84%", "62%"];
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-03)" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ ...shimmer, height: height || (i === 0 ? 13 : 11), width: width || widths[i % widths.length], borderRadius: 4 }} />
      ))}
    </div>
  );
}
