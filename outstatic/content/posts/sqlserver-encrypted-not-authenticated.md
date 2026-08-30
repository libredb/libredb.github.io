---
title: SQL Server connects encrypted but unauthenticated by default
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlserver-encrypted-not-authenticated
description: Encryption is on out of the box while certificate validation is off for any host that is not the recognised managed one, and two named modes do not pin a CA.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-01-26T09:00:00.000Z
---

A SQL Server connection built here has already answered two TLS questions before you
open the form. `Encrypt` is on, and `TrustServerCertificate` is decided by your
hostname. Neither is a field you filled in, and the second one is the interesting
half, because it is the difference between a tunnel nobody can read and a tunnel
whose far end nobody checked.

## What the connection sets before you choose anything

The provider is `mssql` (node-mssql over Tedious, TDS, port 1433), and the options
handed to the driver come from `buildConfig()` in
`src/lib/db/providers/sql/mssql.ts`. With no explicit `connection.ssl` on the saved
connection, it sets two things:

```ts
encrypt: true,
trustServerCertificate: !isAzure,
```

`isAzure` is a hostname test: the host ends `.database.windows.net`. That is the only
managed offering the code recognises by name. No managed SQL Server service has been
reached on a live instance here - Azure SQL Database, Azure SQL Managed Instance,
Microsoft Fabric and Azure Synapse are all on the provider README's list of services
no instance was reachable for - so what follows describes the code path rather than a
session measured against a managed host.

So the default splits in two. A host ending `.database.windows.net` gets
`trustServerCertificate: false` and validates the certificate chain and the name
against the machine's own trust store. Every other host - your on-prem cluster, a
container on the same private network, `localhost` - gets `trustServerCertificate:
true`.

The first half of that pairing is not a compromise. SQL Server 2022 and later and the
`mssql` v12 driver require encryption, and that is the stated reason `encrypt: true` is
the default. The second half is a deliberate convenience: it is why a freshly started
dev container accepts a connection with nothing configured.

## Encrypted and unauthenticated is a real state

Those two flags together produce a state people tend to collapse into one word. The
session is encrypted. `sys.dm_exec_connections.encrypt_option` reads `TRUE`. Nothing
on the wire is legible to anyone watching the segment.

And nobody checked who is on the other end. `trustServerCertificate: true` means the
driver accepts whatever certificate the server presents - self-signed, expired,
issued for a different name, or issued five minutes ago by whoever is sitting between
you and port 1433. Encryption without authentication is confidentiality against a
passive observer only. An active one just terminates the TLS session itself.

That is measurable rather than theoretical. Against
`mcr.microsoft.com/mssql/server:2022-latest` with its generated self-signed
certificate, measured 2026-08-25:

- `{ encrypt: true, trustServerCertificate: true }` connected, and
  `encrypt_option` came back `TRUE`.
- `{ encrypt: true, trustServerCertificate: false }` was refused:
  `Failed to connect to 127.0.0.1:1433 - self signed certificate`.

The first result is the default you get on any non-Azure host. It is a real
connection, genuinely encrypted, and it authenticates nothing. **On a non-managed
host with no explicit SSL setting, the connection is encrypted but not
authenticated.** Saying only that it is encrypted is true and incomplete; the rest of
the sentence is that nothing checked who answered on port 1433.

## Which host switches validation on

One suffix. `.database.windows.net`.

That is a narrow test doing a broad job, and it is worth knowing where its edges are.
It does not switch on for a hostname you own that happens to front an Azure server,
and it does not switch on for a properly certificated on-prem server either - the code
is matching a name, not probing for a trustworthy chain.

If you want validation anywhere else, you set it. The mode lives on the connection's
`ssl` block and resolves like this:

| `connection.ssl.mode` | `encrypt` | `trustServerCertificate` |
| --- | --- | --- |
| unset | `true` | `false` for Azure, `true` otherwise |
| `disable` | `false` | not applicable |
| `require` | `true` | `true` - encrypted, chain unchecked |
| `verify-system` / `verify-ca` / `verify-full` | `true` | `false` - validate the certificate |

`require` is the explicit spelling of the non-Azure default. If you have decided the
network segment is trusted and the server has no certificate worth checking, write it
down as `require` rather than leaving it implicit; the next person to read the
connection then knows it was a decision.

## Why the verify modes do not pin what their names suggest

Read the last row of that table again. Three mode names, one column of values.

`verify-system`, `verify-ca` and `verify-full` build the same single Tedious call.
There is no second channel behind them, because Tedious exposes exactly one trust
switch - `trustServerCertificate` - and turning it off already means "validate the
chain and the name against the host's own trust store". `connection.ssl.caCert` is
not read by this provider at all. Nothing loads a CA file; nothing compares a
presented chain against one you supplied.

**So `verify-ca` and `verify-full` do not deliver the CA pinning their names promise.**
They deliver system-trust-store validation, which is what `verify-system` says on the
tin and what all three actually do. If your threat model needs a private CA pinned -
an internal issuer that the container's trust store does not carry - this provider is
not the place that happens yet. Put the certificate in the container's trust store, or
accept that the check is against the system store.

The one-knob mapping is pinned by an integration test named for it - "the TLS options
handed to tedious" - which replaces the driver with a mock rather than talking to a
server, so it fixes the options handed over and not what a server does with them. A
mode added later cannot quietly fall through to the trusting branch. That is a
compensating control rather than a fix; the names still overpromise. The
[security page](/security) carries the same boundary.

## What a pasted string now maps to, and what can break

A connection can also arrive as a paste rather than as a filled form. The paste box accepts
`mssql://` and `sqlserver://` URLs and ADO.NET keyword strings, and it reads the TLS
keywords out of them, case-insensitively because ADO.NET writes `True`:

| `Encrypt` | `TrustServerCertificate` | Resulting SSL Mode |
| --- | --- | --- |
| `False` / `No` | any | `disable` |
| `True` / `Yes` | `True` / `Yes` | `require` |
| `True` / `Yes` | `False` / `No` / absent | `verify-full` |
| `Strict` | ignored | `verify-full` |
| absent | any | left unset |

The third row is the one that changes an outcome. `Encrypt=True` with
`TrustServerCertificate` absent maps to `verify-full`, which is faithful to
`Microsoft.Data.SqlClient` 4.0 and later, where the documented default validates the
chain and the name. It is also the row that can break a string that used to work:
before the paste box read TLS keywords at all, such a string left the form on
`disable`, the explicit-`ssl` branch never ran, and the non-Azure default trusted the
certificate. Against a self-signed on-prem server, the same paste now fails with the
`self signed certificate` refusal measured above.

The fix is to say what you meant. Paste `TrustServerCertificate=True` alongside
`Encrypt=True`, or set SSL Mode to `require` on the form after pasting. Both spell the
old behaviour explicitly.

Two adjacent facts are worth carrying away from the same box. When `Encrypt` is absent
entirely, the mode is left unset rather than guessed - `System.Data.SqlClient` defaults
it to false and `Microsoft.Data.SqlClient` 4.0+ to true, so the string does not carry
the answer and neither does the parser. And whatever you paste, the URL itself never
reaches the provider: the parser decomposes it into discrete host, port, user, password
and database fields, and `buildConfig()` never reads `config.connectionString`. A
connection carrying only a raw URL and no fields would be built against `localhost`.

Authentication into the server is SQL authentication only - `user` and `password`.
Windows Integrated and Azure AD are not wired. That, the TLS default, and the rest of
this engine's boundaries sit on its entry in [the engine list](/databases).
