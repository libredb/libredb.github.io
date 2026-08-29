import React from "react";

export function Textarea({ rows = 3, invalid = false, disabled = false, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);

  return (
    <textarea
      rows={rows}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "12px 14px",
        borderRadius: "var(--radius-m)",
        border: "1px solid " + (invalid ? "var(--error-text)" : focus ? "var(--focus-ring)" : hover ? "var(--border-strong)" : "var(--border)"),
        background: invalid ? "var(--error-bg)" : disabled ? "var(--background-subtle)" : "var(--background)",
        boxShadow: focus ? "0 0 0 3px var(--surface-brand)" : "none",
        color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
        fontFamily: "var(--font-body)",
        fontSize: 15,
        lineHeight: 1.6,
        outline: "none",
        resize: "vertical",
        transition: "border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)",
        ...style
      }}
      {...rest}
    />
  );
}
