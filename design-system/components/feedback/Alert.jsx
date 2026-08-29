import React from "react";

const TONES = {
  info: { bg: "var(--info-bg)", border: "var(--info-border)", text: "var(--info-text)" },
  success: { bg: "var(--success-bg)", border: "var(--success-border)", text: "var(--success-text)" },
  warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", text: "var(--warning-text)" },
  error: { bg: "var(--error-bg)", border: "var(--error-border)", text: "var(--error-text)" }
};

export function Alert({ tone = "info", title, action, onDismiss, children }) {
  const t = TONES[tone] || TONES.info;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        gap: "var(--space-04)",
        padding: "14px 16px",
        borderRadius: "var(--radius-m)",
        background: t.bg,
        border: "1px solid " + t.border
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 18, height: 18, flex: "none", marginTop: 1, borderRadius: "50%", border: "1.5px solid " + t.text }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: "var(--weight-semibold)", lineHeight: 1.4, color: t.text }}>
            {title}
          </div>
        )}
        {children && (
          <div style={{ marginTop: title ? 5 : 0, fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.6, color: t.text, opacity: 0.9 }}>
            {children}
          </div>
        )}
        {action && <div style={{ marginTop: "var(--space-04)" }}>{action}</div>}
      </div>
      {onDismiss && (
        <button aria-label="Kapat" onClick={onDismiss}
          style={{ flex: "none", border: "none", background: "none", color: t.text, fontSize: 17, lineHeight: 1, cursor: "pointer" }}>
          ×
        </button>
      )}
    </div>
  );
}
