Avatar shows a person or account; AvatarGroup overlaps several with a +N overflow chip.

```jsx
<Avatar name="Ayşe Yılmaz" size="l" status="online" />
<AvatarGroup total={12}>
  <Avatar name="Ayşe Yılmaz" /><Avatar name="Mert Kaya" tone="data" /><Avatar name="Selin Bulut" />
</AvatarGroup>
```

- Initials are uppercased with Turkish locale rules, so "ilke" becomes "İ" not "I".
- Status dots are decorative; the state must also be available as text nearby.
