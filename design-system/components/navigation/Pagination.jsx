import React from "react";

function pageList(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(total - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

export function Pagination({ page = 1, total = 1, onChange }) {
  const cell = {
    display: "grid",
    placeItems: "center",
    width: 38,
    height: 38,
    borderRadius: "var(--radius-s)",
    fontFamily: "var(--font-ui)",
    fontSize: 13.5,
    fontWeight: "var(--weight-medium)",
    cursor: "pointer",
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)"
  };

  return (
    <nav aria-label="Sayfalama" style={{ display: "flex", alignItems: "center", gap: "var(--space-02)", flexWrap: "wrap" }}>
      <button aria-label="Önceki sayfa" disabled={page <= 1} onClick={() => onChange && onChange(page - 1)}
        style={{ ...cell, color: page <= 1 ? "var(--text-disabled)" : "var(--text-secondary)", cursor: page <= 1 ? "not-allowed" : "pointer" }}>←</button>
      {pageList(page, total).map((p, i) =>
        p === "…" ? (
          <span key={"e" + i} style={{ width: 20, textAlign: "center", color: "var(--text-disabled)" }}>…</span>
        ) : (
          <button key={p} aria-current={p === page ? "page" : undefined} onClick={() => onChange && onChange(p)}
            style={p === page ? { ...cell, background: "var(--action-primary)", border: "1px solid transparent", color: "#fff" } : cell}>
            {p}
          </button>
        )
      )}
      <button aria-label="Sonraki sayfa" disabled={page >= total} onClick={() => onChange && onChange(page + 1)}
        style={{ ...cell, color: page >= total ? "var(--text-disabled)" : "var(--text-secondary)", cursor: page >= total ? "not-allowed" : "pointer" }}>→</button>
    </nav>
  );
}
