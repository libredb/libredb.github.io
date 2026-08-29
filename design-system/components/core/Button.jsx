import React from "react";

const SIZES = {
  s: { height: 36, padding: "0 14px", font: "var(--button-s-size)" },
  m: { height: 44, padding: "0 18px", font: "var(--button-m-size)" },
  l: { height: 52, padding: "0 24px", font: "var(--button-l-size)" }
};

const VARIANTS = {
  primary: {
    rest: { background: "var(--action-primary)", color: "#fff", border: "1px solid transparent" },
    hover: { background: "var(--action-primary-hover)" },
    active: { background: "var(--action-primary-active)" }
  },
  secondary: {
    rest: { background: "var(--surface-brand)", color: "var(--text-brand)", border: "1px solid transparent" },
    hover: { background: "var(--surface-brand-hover)" },
    active: { background: "var(--surface-brand-hover)" }
  },
  outline: {
    rest: { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-strong)" },
    hover: { background: "var(--surface-hover)", border: "1px solid var(--text-primary)" },
    active: { background: "var(--surface-hover)" }
  },
  tertiary: {
    rest: { background: "var(--action-tertiary)", color: "var(--text-primary)", border: "1px solid transparent" },
    hover: { background: "var(--action-tertiary-hover)" },
    active: { background: "var(--action-tertiary-hover)" }
  },
  ghost: {
    rest: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent" },
    hover: { background: "var(--surface-hover)", color: "var(--text-primary)" },
    active: { background: "var(--surface-hover)" }
  },
  destructive: {
    rest: { background: "var(--action-destructive)", color: "#fff", border: "1px solid transparent" },
    hover: { background: "var(--action-destructive-hover)" },
    active: { background: "var(--action-destructive-hover)" }
  },
  inverse: {
    rest: { background: "var(--background)", color: "var(--text-primary)", border: "1px solid transparent" },
    hover: { opacity: 0.88 },
    active: { opacity: 0.8 }
  },
  link: {
    rest: {
      background: "none", color: "var(--link)", border: "none", padding: 0, height: "auto",
      textDecoration: "underline", textUnderlineOffset: "3px"
    },
    hover: { color: "var(--link-hover)" },
    active: { color: "var(--link-hover)" }
  }
};

export function Button({
  variant = "primary",
  size = "m",
  iconLeft,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  type = "button",
  onClick,
  children,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.m;
  const off = disabled || loading;

  const style = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-03)",
    width: fullWidth ? "100%" : undefined,
    height: s.height,
    padding: s.padding,
    borderRadius: "var(--radius-m)",
    fontFamily: "var(--font-ui)",
    fontSize: s.font,
    fontWeight: "var(--weight-medium)",
    lineHeight: 1,
    cursor: loading ? "wait" : disabled ? "not-allowed" : "pointer",
    transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)",
    transform: press && !off ? "scale(var(--press-scale))" : "none",
    opacity: disabled ? "var(--disabled-opacity)" : 1,
    ...v.rest,
    ...(hover && !off ? v.hover : null),
    ...(press && !off ? v.active : null)
  };

  return (
    <button
      type={type}
      style={style}
      disabled={off}
      aria-busy={loading || undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          style={{
            width: 15, height: 15, flex: "none", borderRadius: "50%",
            border: "2px solid rgba(255,255,255,.35)",
            borderTopColor: "currentColor",
            animation: "ldb-spin .7s linear infinite"
          }}
        />
      ) : iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
