import React from "react";

const TONES = {
  info: { bg: "var(--info-bg)", border: "var(--info-border)", text: "var(--info-text)" },
  success: { bg: "var(--success-bg)", border: "var(--success-border)", text: "var(--success-text)" },
  warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", text: "var(--warning-text)" },
  error: { bg: "var(--error-bg)", border: "var(--error-border)", text: "var(--error-text)" }
};

export function Toast({ tone = "info", loading = false, action, onDismiss, children }) {
  const t = TONES[tone] || TONES.info;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-04)",
        padding: "14px 16px",
        minWidth: 280,
        borderRadius: "var(--radius-m)",
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-l)"
      }}
    >
      {loading ? (
        <span aria-hidden="true" style={{ width: 20, height: 20, flex: "none", borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--action-primary)", animation: "ldb-spin .7s linear infinite" }} />
      ) : (
        <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 22, height: 22, flex: "none", borderRadius: "50%", background: t.bg, color: t.text, fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: "var(--weight-semibold)" }}>
          {tone === "success" ? "✓" : tone === "error" ? "!" : tone === "warning" ? "!" : "i"}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.4, color: "var(--text-primary)" }}>
        {children}
        {action && <div style={{ marginTop: 4 }}>{action}</div>}
      </div>
      {onDismiss && (
        <button aria-label="Kapat" onClick={onDismiss}
          style={{ flex: "none", border: "none", background: "none", color: "var(--text-tertiary)", fontSize: 16, lineHeight: 1, cursor: "pointer" }}>
          ×
        </button>
      )}
    </div>
  );
}
