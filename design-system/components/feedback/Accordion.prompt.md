Accordion is the FAQ pattern and the mobile fallback for long content.

```jsx
<Accordion items={[
  { question: "Verimiz Türkiye'de mi kalır?", answer: "Evet. Tüm yönetilen kümeler İstanbul bölgesinde çalışır." },
  { question: "Sözleşme süresi ne kadar?", answer: "Asgari 12 ay." }
]} />
```

- One panel open by default so the component never looks inert.
- Answers stay inside `--measure-standard`; longer content belongs on its own page.
