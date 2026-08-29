IconButton is a square or circular control with no visible label — always pass `label` for the accessible name.

```jsx
<IconButton label="Kapat" icon={<XIcon />} />
<IconButton label="Yeni küme" icon="+" variant="filled" shape="circle" size="l" />
```

- Use `ghost` in headers and toolbars, `outline` next to inputs, `filled` for a floating action.
- The visual glyph stays 20px; the button pads out to 44px so the touch target is legal.
