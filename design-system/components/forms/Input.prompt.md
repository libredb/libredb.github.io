Input is the single-line text control. Placeholders show format only — never use one as a label.

```jsx
<FormField label="Alan adı" htmlFor="domain" helper="Sadece alan adını yazın.">
  <Input id="domain" prefix="https://" suffix=".com.tr" placeholder="alanadi" />
</FormField>
```

- `inputMode` / `type` must match the data so the right mobile keyboard opens.
- Focus draws a 1px brand border plus a 3px `--surface-brand` halo.
