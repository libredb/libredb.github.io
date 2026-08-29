import React from "react";

export function Switch({ checked = false, disabled = false, label, description, onChange, id, ...rest }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-05)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer"
      }}
    >
      <span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 14.5, lineHeight: 1.5, color: "var(--text-primary)" }}>{label}</span>
        {description && (
          <span style={{ display: "block", marginTop: 3, fontSize: 13, lineHeight: 1.5, color: "var(--text-tertiary)" }}>{description}</span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, width: 44, height: 26, margin: 0 }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: 44,
          height: 26,
          flex: "none",
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--action-primary)" : "var(--neutral-300)",
          transition: "background var(--duration-fast) var(--ease-out)"
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "var(--shadow-s)",
            transition: "left var(--duration-fast) var(--ease-out)"
          }}
        />
      </span>
    </label>
  );
}
