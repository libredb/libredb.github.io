import React from "react";

const WIDTHS = { s: 400, m: 520, l: 680 };

export function Dialog({ open = true, size = "m", tone = "default", title, description, footer, onClose, children }) {
  React.useEffect(() => {
    if (!open || !onClose) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const badge = {
    default: { background: "var(--surface-brand)", color: "var(--text-brand)", glyph: "i" },
    destructive: { background: "var(--error-bg)", color: "var(--error-text)", glyph: "!" },
    warning: { background: "var(--warning-bg)", color: "var(--warning-text)", glyph: "!" },
    success: { background: "var(--success-bg)", color: "var(--success-text)", glyph: "✓" }
  }[tone] || {};

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: "var(--z-modal)",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-07)",
        background: "rgba(11,13,24,.55)"
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: WIDTHS[size] || WIDTHS.m,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden"
        }}
      >
        <div style={{ padding: "var(--space-07) var(--space-07) 0", display: "flex", justifyContent: "space-between", gap: "var(--space-05)", alignItems: "flex-start" }}>
          <div>
            {tone !== "default" && (
              <div aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "var(--radius-m)", marginBottom: "var(--space-05)", fontFamily: "var(--font-ui)", fontSize: 17, fontWeight: "var(--weight-semibold)", ...badge }}>
                {badge.glyph}
              </div>
            )}
            {title && <h2 style={{ fontSize: 20, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{title}</h2>}
          </div>
          {onClose && (
            <button aria-label="Kapat" onClick={onClose}
              style={{ flex: "none", border: "none", background: "none", color: "var(--text-tertiary)", fontSize: 20, lineHeight: 1, cursor: "pointer" }}>
              ×
            </button>
          )}
        </div>

        {description && (
          <p style={{ padding: "var(--space-04) var(--space-07) 0", fontSize: 14.5, lineHeight: 1.65, color: "var(--text-secondary)" }}>
            {description}
          </p>
        )}

        {children && <div style={{ padding: "var(--space-06) var(--space-07) 0" }}>{children}</div>}

        {footer && (
          <div style={{ marginTop: "var(--space-07)", padding: "var(--space-05) var(--space-07)", borderTop: "1px solid var(--border-subtle)", background: "var(--background-subtle)", display: "flex", justifyContent: "flex-end", gap: "var(--space-04)", flexWrap: "wrap" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
