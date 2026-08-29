import React from "react";

export function Select({ options = [], value, placeholder = "Seçiniz", invalid = false, disabled = false, onChange, id, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: "flex", alignItems: "center" }}
    >
      <select
        id={id}
        value={value === undefined ? "" : value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          appearance: "none",
          width: "100%",
          height: 44,
          padding: "0 38px 0 14px",
          borderRadius: "var(--radius-m)",
          border: "1px solid " + (invalid ? "var(--error-text)" : focus ? "var(--focus-ring)" : hover ? "var(--border-strong)" : "var(--border)"),
          background: invalid ? "var(--error-bg)" : disabled ? "var(--background-subtle)" : "var(--background)",
          boxShadow: focus ? "0 0 0 3px var(--surface-brand)" : "none",
          color: value ? "var(--text-primary)" : "var(--text-tertiary)",
          fontFamily: "var(--font-body)",
          fontSize: 15,
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)"
        }}
        {...rest}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          );
        })}
      </select>
      <span
        aria-hidden="true"
        style={{ position: "absolute", right: 14, fontSize: 10, color: "var(--text-tertiary)", pointerEvents: "none" }}
      >
        ▾
      </span>
    </div>
  );
}
