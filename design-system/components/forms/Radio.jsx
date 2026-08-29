import React from "react";

export function Radio({ checked = false, disabled = false, label, description, name, value, onChange, id, ...rest }) {
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
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, width: 20, height: 20, margin: 0 }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          flex: "none",
          marginTop: 2,
          borderRadius: "50%",
          border: checked ? "5.5px solid var(--action-primary)" : "1.5px solid " + (disabled ? "var(--border)" : "var(--border-strong)"),
          background: disabled ? "var(--background-subtle)" : "var(--background)",
          transition: "border var(--duration-fast) var(--ease-out)"
        }}
      />
      <span>
        {label}
        {description && (
          <span style={{ display: "block", marginTop: 2, fontSize: 13, color: "var(--text-tertiary)" }}>{description}</span>
        )}
      </span>
    </label>
  );
}
