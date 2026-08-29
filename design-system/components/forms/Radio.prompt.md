Radio for 2–5 mutually exclusive options where all options should stay visible.

```jsx
<Radio id="y" name="cycle" checked={c === "y"} onChange={() => setC("y")} label="Yıllık" description="%20 indirim" />
```

- More than ~5 options: use Select. Exactly 2 short options in a toolbar: use a segmented Tabs row.
