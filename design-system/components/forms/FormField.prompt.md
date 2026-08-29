FormField wraps every control so the label, required marker, helper and error always render the same way.

```jsx
<FormField label="Telefon" htmlFor="tel" required error="Telefon numarası 10 haneli olmalı: 5XX XXX XX XX">
  <Input id="tel" invalid value={tel} onChange={setTel} />
</FormField>
```

- Error text has two parts: what happened and how to fix it.
- Validate on blur, not on submit; the summary at the top of a form links back to each field.
