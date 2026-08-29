Spinner for unknown-length waits; ProgressBar when the percentage is real.

```jsx
<Spinner size="l" />
<ProgressBar value={68} label="Veri aktarılıyor" />
```

- Do not show either for waits under 400ms.
- Never fake a percentage — if it is unknown, use Spinner.
