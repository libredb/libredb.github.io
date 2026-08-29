Tag is the pill: technology keywords, filter chips and removable selections.

```jsx
<Tag>PostgreSQL</Tag>
<Tag interactive selected onClick={toggle}>Finans</Tag>
<Tag onRemove={() => remove(id)}>Veri mimarisi</Tag>
```

- Static tags are read-only metadata. Filter chips use `interactive` + `selected`.
- Never mix a removable tag and a clickable tag in the same row.
