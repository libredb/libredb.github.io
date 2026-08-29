import React from "react";

const SIZES = { s: 36, m: 44, l: 52 };

export function IconButton({
  label,
  icon,
  variant = "ghost",
  shape = "square",
  size = "m",
  disabled = false,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const box = SIZES[size] || SIZES.m;

  const base = {
    filled: { background: "var(--action-primary)", color: "#fff", border: "1px solid transparent" },
    outline: { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent" }
  }[variant] || {};

  const hoverStyle = variant === "filled"
    ? { background: "var(--action-primary-hover)" }
    : { background: "var(--surface-hover)", color: "var(--text-primary)" };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: box,
        height: box,
        flex: "none",
        borderRadius: shape === "circle" ? "var(--radius-circle)" : "var(--radius-m)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? "var(--disabled-opacity)" : 1,
        transform: press && !disabled ? "scale(var(--press-scale))" : "none",
        transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)",
        ...base,
        ...(hover && !disabled ? hoverStyle : null)
      }}
      {...rest}
    >
      {icon}
    </button>
  );
}
