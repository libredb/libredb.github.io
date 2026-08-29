import React from "react";

export function FormField({ label, htmlFor, required = false, helper, error, success, counter, children }) {
  const describedBy = [];
  if (error) describedBy.push(htmlFor + "-error");
  else if (helper) describedBy.push(htmlFor + "-helper");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-03)" }}>
      {label && (
        <label
          htmlFor={htmlFor}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "var(--label-size)",
            lineHeight: "var(--label-line)",
            fontWeight: "var(--weight-medium)",
            color: "var(--text-primary)"
          }}
        >
          {label}
          {required && <span style={{ color: "var(--error-text)" }}> *</span>}
        </label>
      )}

      {typeof children === "function"
        ? children({ id: htmlFor, "aria-describedby": describedBy.join(" ") || undefined, invalid: !!error })
        : children}

      {(error || helper || counter || success) && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-04)" }}>
          <span
            id={htmlFor + (error ? "-error" : "-helper")}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "var(--helper-size)",
              lineHeight: "var(--helper-line)",
              color: error ? "var(--error-text)" : success ? "var(--success-text)" : "var(--text-tertiary)"
            }}
          >
            {error || success || helper}
          </span>
          {counter && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)", flex: "none" }}>
              {counter}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
