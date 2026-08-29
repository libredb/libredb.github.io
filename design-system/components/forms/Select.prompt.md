Select for one choice from a known list.

```jsx
<FormField label="Hizmet" htmlFor="svc" required>
  <Select id="svc" options={["Veri mimarisi", "Migrasyon", "Yönetilen DB"]} value={svc} onChange={e => setSvc(e.target.value)} />
</FormField>
```

- 2–3 short mutually exclusive options are better as Radio or a segmented Tabs row.
- Beyond ~15 options, add search.
