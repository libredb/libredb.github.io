Alert is the inline, persistent message. For something transient use Toast; for something blocking use Dialog.

```jsx
<Alert tone="warning" title="Disk %82 dolu" action={<Button size="s" variant="outline">Kapasiteyi artır</Button>}>
  Otomatik büyütme kapalı. Kapasiteyi artırın veya arşivleme kuralı ekleyin.
</Alert>
```

- `error` renders `role="alert"`; the others are `role="status"`.
- Never dismissible for errors that still block the user.
