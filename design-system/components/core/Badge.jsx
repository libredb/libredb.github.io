import React from "react";

const TONES = {
  neutral: { background: "var(--background-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border)" },
  primary: { background: "var(--surface-brand)", color: "var(--text-brand)", border: "1px solid transparent" },
  success: { background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-border)" },
  warning: { background: "var(--warning-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-border)" },
  error: { background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" },
  info: { background: "var(--info-bg)", color: "var(--info-text)", border: "1px solid var(--info-border)" },
  brand: { background: "var(--gradient-brand)", color: "#fff", border: "1px solid transparent" }
};

export function Badge({ tone = "neutral", dot = false, children, ...rest }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-02)",
        padding: "6px 10px",
        borderRadius: "var(--radius-xs)",
        fontFamily: "var(--font-ui)",
        fontSize: 12,
        fontWeight: "var(--weight-medium)",
        lineHeight: 1,
        ...(TONES[tone] || TONES.neutral)
      }}
      {...rest}
    >
      {dot && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />}
      {children}
    </span>
  );
}
