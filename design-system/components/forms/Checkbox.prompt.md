Checkbox for independent yes/no choices and consent.

```jsx
<Checkbox id="kvkk" checked={ok} invalid={!ok && submitted} onChange={e => setOk(e.target.checked)}
  label={<>Kişisel verilerimin <a href="/kvkk">KVKK Aydınlatma Metni</a> kapsamında işlenmesine onay veriyorum.</>} />
```

- Consent boxes are never pre-checked.
- Use `indeterminate` on a parent when only some children are selected.
