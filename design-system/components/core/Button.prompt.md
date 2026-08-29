Button is the action primitive — use it for every clickable action, and allow exactly one `primary` per screen.

```jsx
<Button variant="primary" size="l" onClick={submit}>Teklif al</Button>
<Button variant="outline" iconRight="→">Vakaları incele</Button>
<Button variant="destructive" loading>Kalıcı olarak sil</Button>
```

- `variant`: primary (one per screen) · secondary (equal-weight second action) · outline (neutral, most common) · tertiary (toolbar) · ghost (dismiss/cancel) · destructive (irreversible) · inverse (on dark or gradient) · link (inline in text).
- `size`: m is the default and the minimum touch target; l for hero CTAs; s for toolbars and table rows.
- Hover darkens one step, press adds `scale(0.98)`. Do not add hover shadows.
- Label copy is action + object in sentence case. Never "Tıkla", never a trailing exclamation mark.
