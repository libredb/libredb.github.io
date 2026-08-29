import React from "react";

export function Checkbox({ checked = false, indeterminate = false, disabled = false, invalid = false, label, onChange, id, ...rest }) {
  const on = checked || indeterminate;

  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-04)",
        fontFamily: "var(--font-body)",
        fontSize: 14.5,
        lineHeight: 1.6,
        color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer"
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, width: 20, height: 20, margin: 0 }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: 20,
          height: 20,
          flex: "none",
          marginTop: 2,
          borderRadius: "var(--radius-xs)",
          border: "1.5px solid " + (disabled ? "var(--border)" : invalid ? "var(--error-text)" : on ? "var(--action-primary)" : "var(--border-strong)"),
          background: disabled ? "var(--background-subtle)" : invalid && !on ? "var(--error-bg)" : on ? "var(--action-primary)" : "var(--background)",
          color: "#fff",
          fontFamily: "var(--font-ui)",
          fontSize: 12,
          fontWeight: "var(--weight-semibold)",
          transition: "background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)"
        }}
      >
        {indeterminate ? <span style={{ width: 10, height: 2, background: "#fff", borderRadius: 1 }} /> : checked ? "✓" : null}
      </span>
      {label}
    </label>
  );
}
