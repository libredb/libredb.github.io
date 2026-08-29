Tabs switch between views of the same thing. They never navigate to a different page.

```jsx
<Tabs items={["Genel bakış", "Teknoloji", "Sonuçlar"]} value={tab} onChange={setTab} />
<Tabs variant="pills" items={["Tümü", "Veri", "Platform"]} value={f} onChange={setF} />
<Tabs variant="contained" items={[{value:"m",label:"Aylık"},{value:"y",label:"Yıllık"}]} value={cycle} onChange={setCycle} />
```

- `underline` is the default; `pills` for filters above a grid; `contained` for a 2-way pricing toggle.
- Tab labels are sentence case and never wrap — shorten the label, don't shrink the type.
