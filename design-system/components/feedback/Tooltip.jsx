import React from "react";

export function Tooltip({ label, placement = "top", children }) {
  const [open, setOpen] = React.useState(false);

  const pos = {
    top: { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" }
  }[placement];

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: "var(--z-tooltip)",
            whiteSpace: "nowrap",
            padding: "7px 10px",
            borderRadius: "var(--radius-s)",
            background: "var(--surface-inverse)",
            color: "var(--text-inverse)",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            lineHeight: 1,
            boxShadow: "var(--shadow-m)",
            pointerEvents: "none",
            ...pos
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
