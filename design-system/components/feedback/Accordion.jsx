import React from "react";

export function Accordion({ items = [], defaultOpen = 0, allowMultiple = false }) {
  const [open, setOpen] = React.useState(allowMultiple ? (defaultOpen === null ? [] : [defaultOpen]) : defaultOpen);

  const isOpen = (i) => (allowMultiple ? open.indexOf(i) > -1 : open === i);
  const toggle = (i) => {
    if (allowMultiple) setOpen(isOpen(i) ? open.filter((x) => x !== i) : open.concat(i));
    else setOpen(open === i ? null : i);
  };

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-l)", overflow: "hidden", background: "var(--surface)" }}>
      {items.map((item, i) => {
        const on = isOpen(i);
        return (
          <div key={i} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)", background: on ? "var(--background-subtle)" : "transparent" }}>
            <button
              aria-expanded={on}
              onClick={() => toggle(i)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--space-04)",
                padding: "18px 22px",
                border: "none",
                background: "none",
                textAlign: "left",
                fontFamily: "var(--font-ui)",
                fontSize: 15.5,
                fontWeight: "var(--weight-medium)",
                lineHeight: 1.4,
                color: "var(--text-primary)",
                cursor: "pointer"
              }}
            >
              {item.question}
              <span aria-hidden="true" style={{ flex: "none", fontSize: 18, color: on ? "var(--action-primary)" : "var(--text-tertiary)" }}>
                {on ? "−" : "+"}
              </span>
            </button>
            {on && (
              <div style={{ padding: "0 22px 18px", maxWidth: "var(--measure-standard)", fontFamily: "var(--font-body)", fontSize: 14.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
