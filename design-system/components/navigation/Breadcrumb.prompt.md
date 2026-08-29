Breadcrumb states the path to the current page. The last item is plain text with `aria-current="page"`.

```jsx
<Breadcrumb items={[{label:"Anasayfa",href:"/"},{label:"Hizmetler",href:"/hizmetler"},{label:"Veri migrasyonu"}]} />
```

Required on service detail, project detail, blog detail and career detail pages — it also feeds the SEO breadcrumb schema.
