Toast confirms that something happened. It auto-dismisses in 5s — except errors, which stay until dismissed.

```jsx
<Toast tone="success" onDismiss={close}>Değişiklikler kaydedildi</Toast>
<Toast tone="error" action={<Button variant="link" size="s">Tekrar dene</Button>}>Kaydedilemedi — bağlantı koptu</Toast>
<Toast loading>Rapor hazırlanıyor…</Toast>
```

Never put critical information only in a toast; it disappears.
