---
title: Sürüm 0.9.66 — on altı motor, tek arayüz
status: draft
author:
  name: LibreDB
  picture: ''
slug: surum-0-9-66
description: On altı veritabanı motoru, aynı ağaç, aynı editör ve aynı ızgara. Bu sürümde neyin geldiğini ve her motorun neyi yapmadığını anlatıyoruz.
coverImage: ''
tags:
  - value: release
    label: Release
  - value: databases
    label: Databases
publishedAt: 2026-08-21T07:30:00.000Z
---

0.9.66 ile birlikte LibreDB Studio on altı motoru aynı arayüzden okuyor:
ilişkisel, doküman, anahtar-değer, analitik, arama ve federe sorgu. Sayı bir
iddia değil, kapsamın ölçüsü — asıl mesele hepsinin aynı ağacı, aynı editörü ve
aynı ızgarayı paylaşması.

## Bu sürümde ne var

- **PostgreSQL ve SQLite'ta ajan modu.** Bir hedef yazıyorsunuz; ajan salt okunur
  ve bütçeli SQL çalıştırıp her iddiasını bir sonuca dayandıran bir rapor
  yazıyor.
- **Görsel EXPLAIN.** PostgreSQL, MySQL, DuckDB, ClickHouse ve Trino için plan
  ağaçları; tarama tipleri, birleştirmeler ve maliyetler çizilmiş halde.
- **Canlı sağlık paneli.** Oturumlar, yavaş sorgular, önbellek isabet oranı ve
  depolama — her motorun kendi raporlama arayüzünden okunuyor.
- **Mobil gezinme.** Sonuçlar için kart görünümü, dar ekranda çalışan ağaç.

## Her motorun sınırı yazılı

Bir özellik listesi dördüncü motorda sessizce kırılır. Bu yüzden yetenek
bayrakları sağlayıcının kendisinden geliyor ve çalışamayacak bir kontrol
sunulup sonra hata vermek yerine gizleniyor.

Birkaç örnek:

- **Cassandra** — birleştirme ve EXPLAIN yok. Izgara, bölüm anahtarı kurallarını
  gizlemek yerine bunlara uyuyor.
- **Elasticsearch ve OpenSearch** — sorgula ve gez: satır düzenleme yok, ER
  diyagramı yok.
- **ClickHouse** — yabancı anahtar kavramı olmadığı için ER diyagramı yapıyı
  gösteriyor, keşfedilmiş ilişkileri değil.
- **Redis** — SQL yok ve varmış gibi de yapılmıyor; editör burada komut
  konuşuyor.
- **DuckDB** — tasarımı gereği tek yazarlı; listelenecek oturum olmadığı için
  sağlık paneli bağlantı değil depolama gösteriyor.

## Dağıtım

Yayımlanan her artefakt bir derleme kanıtı (build provenance attestation)
taşıyor ve yerel kanallar öntanımlı olarak 127.0.0.1'e bağlanıyor. 27
dağıtım kanalının 22'si şu anda yayında.

```
docker run -p 3000:3000 libredb/libredb-studio
```

Kurulum kırk saniye sürüyor; geri kalanı zaten sizin ağınızda.
