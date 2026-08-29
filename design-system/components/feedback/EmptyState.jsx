import React from "react";

export function EmptyState({ tone = "neutral", icon, code, title, description, action, secondaryAction }) {
  const accent = {
    neutral: { background: "var(--background-subtle)", color: "var(--text-tertiary)", border: "1px solid var(--border)" },
    brand: { background: "var(--surface-brand)", color: "var(--text-brand)", border: "1px solid transparent" },
    success: { background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-border)" },
    error: { background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }
  }[tone] || {};

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-l)", background: "var(--surface)", padding: "32px 24px", textAlign: "center" }}>
      {code ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 40, fontWeight: "var(--weight-semibold)", lineHeight: 1, letterSpacing: "-0.02em", color: "var(--text-disabled)" }}>
          {code}
        </div>
      ) : (
        <div aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 48, height: 48, margin: "0 auto", borderRadius: tone === "success" ? "50%" : "var(--radius-m)", fontFamily: "var(--font-ui)", fontSize: 20, fontWeight: "var(--weight-semibold)", ...accent }}>
          {icon || (tone === "success" ? "✓" : null)}
        </div>
      )}
      {title && <div style={{ marginTop: "var(--space-05)", fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: "var(--weight-semibold)", lineHeight: 1.35 }}>{title}</div>}
      {description && (
        <div style={{ marginTop: "var(--space-03)", maxWidth: 44 + "ch", marginLeft: "auto", marginRight: "auto", fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          {description}
        </div>
      )}
      {(action || secondaryAction) && (
        <div style={{ marginTop: "var(--space-05)", display: "flex", gap: "var(--space-03)", justifyContent: "center", flexWrap: "wrap" }}>
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
