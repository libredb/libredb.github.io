import React from "react";

export function Tag({ interactive = false, selected = false, onRemove, onClick, children, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const clickable = interactive || !!onClick;

  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-02)",
    padding: onRemove ? "7px 10px 7px 12px" : "7px 12px",
    borderRadius: "var(--radius-pill)",
    fontFamily: "var(--font-ui)",
    fontSize: 13,
    fontWeight: "var(--weight-regular)",
    lineHeight: 1,
    cursor: clickable ? "pointer" : "default",
    transition: "background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
    background: selected ? "var(--surface-brand)" : hover && clickable ? "var(--surface-hover)" : "var(--background-subtle)",
    color: selected ? "var(--text-brand)" : "var(--text-secondary)",
    border: "1px solid " + (selected ? "transparent" : hover && clickable ? "var(--border-strong)" : "var(--border)")
  };

  const Wrapper = clickable ? "button" : "span";

  return (
    <Wrapper
      type={clickable ? "button" : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={style}
      {...rest}
    >
      {children}
      {onRemove && (
        <span
          role="button"
          aria-label="Kaldır"
          onClick={(e) => { e.stopPropagation(); onRemove(e); }}
          style={{ opacity: 0.6, fontSize: 14, lineHeight: 1, cursor: "pointer" }}
        >
          ×
        </span>
      )}
    </Wrapper>
  );
}
