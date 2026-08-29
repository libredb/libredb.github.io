Dialog interrupts the user. Use it only when the decision cannot wait or cannot be undone.

```jsx
<Dialog tone="destructive" title="Kümeyi kalıcı olarak sil" onClose={close}
  description="staging-orders kümesi ve tüm yedekleri silinecek. Bu işlem geri alınamaz."
  footer={<><Button variant="outline" onClick={close}>Vazgeç</Button><Button variant="destructive">Kalıcı olarak sil</Button></>}>
  <FormField label="Onaylamak için küme adını yazın" htmlFor="c"><Input id="c" placeholder="staging-orders" /></FormField>
</Dialog>
```

- Destructive dialogs require typing the object's name — a lone "Emin misiniz?" is not enough.
- The parent needs `position: relative` since the overlay is absolutely positioned.
- On mobile a dialog becomes a bottom sheet.
