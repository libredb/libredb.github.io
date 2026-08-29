import React from "react";

export function Card({
  as,
  interactive = false,
  selected = false,
  media,
  padding = "comfortable",
  tone = "surface",
  children,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const Wrapper = as || (onClick ? "a" : "div");
  const lift = (interactive || !!onClick) && hover;

  const backgrounds = {
    surface: "var(--surface)",
    subtle: "var(--background-subtle)",
    brand: "var(--gradient-brand)",
    inverse: "var(--surface-inverse)"
  };

  return (
    <Wrapper
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        background: backgrounds[tone] || backgrounds.surface,
        color: tone === "brand" ? "#fff" : tone === "inverse" ? "var(--text-inverse)" : "inherit",
        border: "1px solid " + (selected ? "var(--action-primary)" : "var(--border)"),
        borderRadius: "var(--radius-l)",
        overflow: "hidden",
        textDecoration: "none",
        cursor: onClick ? "pointer" : undefined,
        boxShadow: lift ? "var(--shadow-l)" : selected ? "var(--shadow-m)" : "none",
        transform: lift ? "translateY(var(--hover-lift))" : "none",
        transition: "transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out), border-color var(--duration-fast) var(--ease-out)"
      }}
      {...rest}
    >
      {media}
      <div style={{ padding: padding === "compact" ? "var(--card-padding-compact)" : "var(--card-padding)" }}>
        {children}
      </div>
    </Wrapper>
  );
}

export function CardMedia({ ratio = "16 / 9", src, caption = "image", children }) {
  return (
    <div
      style={{
        aspectRatio: ratio,
        display: "grid",
        placeItems: "center",
        background: src
          ? undefined
          : "repeating-linear-gradient(135deg, var(--neutral-200) 0 10px, var(--neutral-100) 10px 20px)",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--text-tertiary)",
        overflow: "hidden"
      }}
    >
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : children || caption}
    </div>
  );
}
