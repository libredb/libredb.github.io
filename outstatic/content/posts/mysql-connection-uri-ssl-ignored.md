---
title: A MySQL connection URI skips your SSL and timezone settings
status: published
author:
  name: LibreDB
  picture: ''
slug: mysql-connection-uri-ssl-ignored
description: Supplying a connection string takes a different branch entirely, so the SSL panel, the timezone and cloud detection stop applying and must live in the URI.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-04-25T09:00:00.000Z
---

You set SSL Mode to `verify-ca`, pasted a CA certificate, saved, and the
connection opened. Then someone asked whether the traffic was actually verified
and you could not answer from the screen. When that happens the cause is often
neither the certificate nor the server: the connection was stored as a URI, and
the URI takes a different code path than the SSL panel writes into.

That precedence rule in LibreDB Studio's MySQL provider is the kind of rule that
fails quietly. Nothing errors. The pool
builds, the schema tree loads, queries return rows. The setting you chose simply
never reached the driver.

## Two ways to describe the same MySQL connection

The provider is `MySQLProvider`, built on `mysql2/promise` on top of the shared
`SQLBaseProvider`, default port 3306. A connection can be described two ways,
and `validate()` accepts either:

```ts
// Discrete fields - host and database are required when there is no URI
const a = { id: 'my-1', name: 'App DB', type: 'mysql',
  host: 'db.internal', port: 3306, database: 'app',
  user: 'root', password: 'secret' };

// Connection string
const b = { id: 'my-1', name: 'App DB', type: 'mysql',
  connectionString: 'mysql://root:secret@db.internal:3306/app' };
```

`validate()` does not reject supplying both. If both are present, the connection
string is the one that is used - it is handed to the `mysql2` pool as its `uri`
option. That is the precedence rule, and everything below follows from it.

## What the URI branch skips

`buildPoolConfig()` has two branches. With a connection string it returns
`{ ...baseConfig, uri }` and does not enter the discrete-fields branch at all.
`baseConfig` is the small fixed set the pool always gets:

| mysql2 option | Value | Source |
| --- | --- | --- |
| `connectionLimit` | pool `max`, default 10 | `ProviderOptions.pool.max` |
| `waitForConnections` | `true` | fixed |
| `queueLimit` | `0` | fixed |
| `enableKeepAlive` | `true` | fixed |
| `keepAliveInitialDelay` | `10000` ms | fixed |

Note what is not in that table. `timezone`, which the discrete branch sets from
`ProviderOptions.timezone ?? 'Z'`, is applied in the discrete form only. So is
`buildSSLConfig()`, which is where `connection.ssl` and any pasted CA
certificate turn into a TLS object. So is cloud SSL auto-detection.

State it flatly, because it is the whole post: **with a connection string, the
SSL settings, the timezone and the cloud SSL auto-detect are ignored entirely,
and must be encoded in the URI itself.** The form still shows what you chose. The
pool never sees it.

There is a way to avoid the branch altogether, and it is the one to reach for
first. Pasting a `mysql://` URL into the connection dialog's paste box does not
store a connection string at all: the parser returns host, port, user, password
and database as discrete fields, and reads `ssl-mode` out of the query string
into the form's SSL Mode. A pasted URL lands in the branch where the SSL panel
and the timezone still apply. It is a connection saved with a `connectionString`
that bypasses them.

The timezone half of the rule matters more than it sounds. `DATE`, `DATETIME`
and `TIMESTAMP` values arrive from the driver as JavaScript `Date` objects, and
the pool's `timezone` option is what decides how those objects are constructed. Drop the
option and the pool never receives the `'Z'` the discrete branch would have
supplied, so how those objects are built is left to the driver's own default.

## Encrypted, verified, and the difference

In the discrete form the provider has a third path beside "you chose a mode" and
"you chose nothing": `shouldEnableSSL()` returns true when `options.ssl === true`
or when the host looks like a known managed endpoint, and that path enables
`{ rejectUnauthorized: false }`. That is TLS with the certificate chain
unchecked. The bytes on the wire are encrypted. Nothing has established that the
server on the other end is the server you meant.

So cloud auto-detect is a convenience, not a control, and this is the second
sentence to take away: **the auto-detect path uses `rejectUnauthorized: false`,
which is encrypted but not authenticated.** It exists so that a managed endpoint
does not fail to connect at all; it is not the setting you want to leave in place
once the connection works. A connection that is encrypted and unverified looks
exactly like a connection that is encrypted and verified, from the results grid.

`require` is the same object, chosen deliberately rather than detected. Both of
these are worth saying out loud on the same page as the rest of the
[security posture](/security), because "SSL is on" is the claim that most often
turns out to mean less than the person making it believed.

## Which verifying mode to choose, and what it needs

`buildSSLConfig()` maps modes onto a `mysql2` TLS object like this:

| Mode | What the driver gets | What you must supply |
| --- | --- | --- |
| `disable` | `undefined` - mysql2's off, not `false` | nothing |
| `require` | `rejectUnauthorized: false` | nothing |
| `verify-system` | `rejectUnauthorized: true`, no `ca` | nothing |
| `verify-ca` | `rejectUnauthorized: true` plus `ca` | a CA certificate |
| `verify-full` | same object as `verify-ca` | a CA certificate |

Two of those rows deserve a sentence.

`verify-system` passes no `ca`, so `mysql2` hands `tls.connect` Node's own trust
store. That mode exists precisely for a managed endpoint whose certificate chains
to a public root: verification with no PEM to find, paste and rotate. If your
provider's certificate is publicly rooted, this is the mode to pick, and the
answer to "where do I get the CA file" is that you do not need one.

`verify-ca` and `verify-full` build the identical object, because `mysql2`
exposes no separate host-name check to switch on. If you pick `verify-full`
expecting a stricter check than `verify-ca` gives you here, you are picking the
same object under a stronger name. `caCert`, `clientCert` and `clientKey` map to
`ca`, `cert` and `key`.

All of this lives in the discrete branch, which is also where a paste lands. The
paste box maps `ssl-mode` onto those same form modes: `DISABLED`, `REQUIRED`,
`VERIFY_CA` and `VERIFY_IDENTITY`, matched case-insensitively, with `sslmode`
accepted as an alias for `ssl-mode`.

The boolean spellings are read too, and mapped at both ends: `?ssl=true`,
`?ssl=1` and `?useSSL=true` become `verify-system`, while `?ssl=false`, `?ssl=0`
and `?useSSL=false` become `disable`. The rule is that a boolean maps onto the
mode matching what this driver does with it, never onto a weaker one - `mysql2`
defaults `rejectUnauthorized` to `true` for any `ssl` object it is handed, and
`verify-system` is that behaviour exactly. One spelling therefore comes out
stronger than the ecosystem it came from meant it. That direction is deliberate:
a connection refused for an unverifiable certificate says so on screen, and a
silent downgrade to unverified TLS says nothing at all.

An explicit `ssl-mode` wins when a string carries both forms.

## The parameter the parser refuses to guess

`PREFERRED` is not mapped, and neither is any spelling the map does not know.

It means "encrypt if the server offers it", and both available guesses are wrong.
Mapping it onto `disable` would downgrade a connection that was in fact
encrypted: measured over TCP against MySQL with its default self-signed
certificate, `--ssl-mode=PREFERRED` negotiated `TLS_AES_128_GCM_SHA256`, while
`--ssl-mode=DISABLED` left `Ssl_cipher` empty. Mapping it onto `require` is the
mirror-image guess, asserting a floor the parameter never promised. `mysql2`'s
object form, `?ssl={"rejectUnauthorized":true}`, is not a boolean either and gets
the same treatment.

So the parser leaves the SSL mode the form already holds alone, and the paste
banner names the parameter it declined to act on. You then choose the mode
yourself in the SSL / TLS panel. A banner naming an unhandled parameter is a
worse first impression than a silently-filled field and a better one than a
connection whose security level nobody chose.

The through-line is the same in all three cases: a setting that exists on a form
is not a setting that reached the driver, and the branch a connection takes
decides which of the two it is. If the connection is a URI, the URI is the
configuration. The engine's transport, port and published limits are on the
[MySQL engine page](/databases) alongside every other engine's.
