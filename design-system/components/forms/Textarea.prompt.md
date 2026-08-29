Textarea for free-form input. Pair with FormField and, when there is a limit, a `counter`.

```jsx
<FormField label="Proje özeti" htmlFor="brief" helper="Teknik detay gerekmez." counter="0 / 500">
  <Textarea id="brief" rows={4} maxLength={500} placeholder="Kısaca ihtiyacınızı yazın" />
</FormField>
```
