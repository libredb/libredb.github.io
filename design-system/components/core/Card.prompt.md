Card is the shell every content card in the system is built from — blog, project, service, team, pricing, stat, CTA.

```jsx
<Card onClick={open} media={<CardMedia ratio="16 / 9" caption="cover 16:9" />}>
  <Badge tone="primary">Mühendislik</Badge>
  <h3>Sıfır kesinti ile 4 TB'lık şema migrasyonu</h3>
</Card>
<Card tone="brand"><h3>Veri altyapınızı birlikte planlayalım</h3></Card>
```

- A clickable card is one link surface; never put a second link inside it.
- Pick exactly one hover movement — the lift is built in, so do not also zoom the media and slide an arrow.
- Use `padding="compact"` in data-dense product screens.
