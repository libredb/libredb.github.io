Pagination for blog listings, project grids and tables.

```jsx
<Pagination page={page} total={12} onChange={setPage} />
```

- Prev/next stay visible but disable at the ends — they never disappear.
- On mobile show prev/next plus "3 / 12" instead of the full number row.
