Switch is for settings that take effect immediately — cookie categories, alerting, auto-scaling.

```jsx
<Switch id="autoscale" checked={on} onChange={e => setOn(e.target.checked)}
  label="Otomatik büyütme" description="Disk %80'e ulaştığında kapasite iki katına çıkar." />
```

- If the change needs a Save button, use a Checkbox instead.
- Label the setting, not the state: "Otomatik büyütme", not "Otomatik büyütmeyi aç".
