import React from "react";

const SIZES = { m: 44, l: 52 };

export function Input({
  size = "m",
  invalid = false,
  valid = false,
  disabled = false,
  readOnly = false,
  iconLeft,
  prefix,
  suffix,
  action,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);

  const borderColor = invalid
    ? "var(--error-text)"
    : valid
    ? "var(--success-text)"
    : focus
    ? "var(--focus-ring)"
    : disabled
    ? "var(--border-subtle)"
    : hover
    ? "var(--border-strong)"
    : "var(--border)";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "stretch",
        height: SIZES[size] || SIZES.m,
        border: "1px solid " + borderColor,
        borderRadius: "var(--radius-m)",
        background: invalid ? "var(--error-bg)" : disabled || readOnly ? "var(--background-subtle)" : "var(--background)",
        boxShadow: focus ? "0 0 0 3px var(--surface-brand)" : "none",
        overflow: "hidden",
        transition: "border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)",
        ...style
      }}
    >
      {prefix && (
        <span style={{ display: "grid", placeItems: "center", padding: "0 13px", background: "var(--background-subtle)", borderRight: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-tertiary)" }}>
          {prefix}
        </span>
      )}
      {iconLeft && <span style={{ display: "grid", placeItems: "center", paddingLeft: 14, color: "var(--text-tertiary)" }}>{iconLeft}</span>}
      <input
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          padding: "0 14px",
          border: "none",
          background: "none",
          outline: "none",
          fontFamily: "var(--font-body)",
          fontSize: 15,
          color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
          cursor: disabled ? "not-allowed" : readOnly ? "default" : "text"
        }}
        {...rest}
      />
      {suffix && (
        <span style={{ display: "grid", placeItems: "center", padding: "0 13px", background: "var(--background-subtle)", borderLeft: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-tertiary)" }}>
          {suffix}
        </span>
      )}
      {action && <span style={{ display: "grid", placeItems: "center", paddingRight: 6 }}>{action}</span>}
    </div>
  );
}
