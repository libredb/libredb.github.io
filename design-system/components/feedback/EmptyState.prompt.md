EmptyState covers no-result, first-use, error and success screens. Three parts always: state, reason, next action.

```jsx
<EmptyState tone="brand" title="Henüz küme eklenmedi"
  description="İlk kümenizi bağladığınızda metrikler burada görünecek."
  action={<Button>Küme bağla</Button>} />

<EmptyState code="404" title="Bu sayfa taşınmış olabilir"
  description="Aradığınız adres artık geçerli değil."
  action={<Button>Anasayfa</Button>} secondaryAction={<Button variant="outline">Site içi ara</Button>} />
```

A bare "Sonuç bulunamadı" is not an acceptable empty state.
