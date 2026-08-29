import React from "react";

const SIZES = { xs: 24, s: 32, m: 40, l: 56, xl: 72 };
const FONT = { xs: 10, s: 12, m: 14, l: 18, xl: 22 };

const STATUS = {
  online: "var(--accent-500)",
  offline: "var(--neutral-400)",
  busy: "var(--warning-text)",
  away: "var(--neutral-300)"
};

export function Avatar({ name, src, icon, size = "m", status, tone = "brand", ...rest }) {
  const box = SIZES[size] || SIZES.m;
  const initials = (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toLocaleUpperCase("tr-TR");

  return (
    <span style={{ position: "relative", display: "inline-block", flex: "none" }} {...rest}>
      <span
        aria-label={name}
        role="img"
        style={{
          display: "grid",
          placeItems: "center",
          width: box,
          height: box,
          borderRadius: "var(--radius-circle)",
          overflow: "hidden",
          background: src ? "var(--background-subtle)" : tone === "data" ? "var(--gradient-data)" : "var(--gradient-brand)",
          color: "#fff",
          fontFamily: "var(--font-ui)",
          fontSize: FONT[size] || 14,
          fontWeight: "var(--weight-semibold)",
          lineHeight: 1
        }}
      >
        {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : icon || initials}
      </span>
      {status && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: Math.max(8, Math.round(box * 0.28)),
            height: Math.max(8, Math.round(box * 0.28)),
            borderRadius: "50%",
            background: STATUS[status] || STATUS.offline,
            border: "2px solid var(--surface)"
          }}
        />
      )}
    </span>
  );
}

export function AvatarGroup({ children, max = 4, total }) {
  const items = React.Children.toArray(children);
  const shown = items.slice(0, max);
  const extra = (total || items.length) - shown.length;

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {shown.map((child, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -12, borderRadius: "50%", boxShadow: "0 0 0 2.5px var(--surface)" }}>
          {child}
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{
            marginLeft: -12,
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--background-subtle)",
            color: "var(--text-secondary)",
            boxShadow: "0 0 0 2.5px var(--surface)",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: "var(--weight-semibold)"
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
