import React from "react";

export function Tabs({ items = [], value, variant = "underline", onChange }) {
  const active = value !== undefined ? value : (items[0] && (items[0].value || items[0]));

  const norm = items.map((i) => (typeof i === "string" ? { value: i, label: i } : i));

  if (variant === "pills") {
    return (
      <div role="tablist" style={{ display: "inline-flex", gap: "var(--space-02)", padding: 4, borderRadius: "var(--radius-pill)", background: "var(--background-subtle)", border: "1px solid var(--border)" }}>
        {norm.map((t) => {
          const on = t.value === active;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={on}
              onClick={() => onChange && onChange(t.value)}
              style={{
                padding: "9px 16px",
                border: "none",
                borderRadius: "var(--radius-pill)",
                background: on ? "var(--surface)" : "transparent",
                boxShadow: on ? "var(--shadow-xs)" : "none",
                color: on ? "var(--text-primary)" : "var(--text-tertiary)",
                fontFamily: "var(--font-ui)",
                fontSize: 13.5,
                fontWeight: "var(--weight-medium)",
                lineHeight: 1,
                cursor: "pointer",
                transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)"
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "contained") {
    return (
      <div role="tablist" style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius-m)", overflow: "hidden" }}>
        {norm.map((t, i) => {
          const on = t.value === active;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={on}
              onClick={() => onChange && onChange(t.value)}
              style={{
                flex: 1,
                padding: "11px 0",
                border: "none",
                borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                background: on ? "var(--surface-brand)" : "transparent",
                color: on ? "var(--text-brand)" : "var(--text-tertiary)",
                fontFamily: "var(--font-ui)",
                fontSize: 13.5,
                fontWeight: "var(--weight-medium)",
                lineHeight: 1,
                cursor: "pointer"
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" style={{ display: "flex", gap: "var(--space-07)", borderBottom: "1px solid var(--border)" }}>
      {norm.map((t) => {
        const on = t.value === active;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange && onChange(t.value)}
            style={{
              padding: "0 0 12px",
              marginBottom: -1,
              border: "none",
              borderBottom: "var(--border-width-2) solid " + (on ? "var(--action-primary)" : "transparent"),
              background: "none",
              color: on ? "var(--text-primary)" : "var(--text-tertiary)",
              fontFamily: "var(--font-ui)",
              fontSize: 14.5,
              fontWeight: "var(--weight-medium)",
              lineHeight: 1,
              cursor: "pointer",
              transition: "color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)"
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
