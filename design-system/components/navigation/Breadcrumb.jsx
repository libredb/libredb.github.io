import React from "react";

export function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--space-03)", margin: 0, padding: 0, listStyle: "none", fontFamily: "var(--font-ui)", fontSize: 13.5, lineHeight: 1 }}>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-03)" }}>
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} style={{ color: last ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                  {item.label}
                </span>
              ) : (
                <a href={item.href} style={{ color: "var(--text-tertiary)" }}>{item.label}</a>
              )}
              {!last && <span aria-hidden="true" style={{ color: "var(--text-disabled)" }}>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
