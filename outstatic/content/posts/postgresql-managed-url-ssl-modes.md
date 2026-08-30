---
title: What a pasted managed PostgreSQL URL configures
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-managed-url-ssl-modes
description: Host-heuristic SSL turns encryption on without verifying the certificate, and two sslmode values are declined by name rather than guessed at.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-08-20T09:00:00.000Z
---

You copy a URL out of a Neon, Supabase or RDS console, paste it into a connection
form, and the connection opens. It looks finished. What actually happened is that
the URL's `sslmode` parameter was read out of the query string and either
mapped onto a form field, declined by name, or ignored - and if no mode was
named at all, TLS was switched on by a rule that matches the host name and does
not check the certificate.

That last state is the one worth reading about, because an encrypted connection
that verifies nothing looks identical to one that does.

## What the parser reads out of the URL

The paste box parses the URL and fills the form. Host, port, database, user and
password come off the URL structure. The query string is read too, so
`postgresql://host/db?sslmode=verify-full` arrives with SSL Mode already set on
the form rather than left at whatever the default was.

Four libpq values map one to one:

| In the URL | On the form |
| --- | --- |
| `sslmode=disable` | Disable |
| `sslmode=require` | Require |
| `sslmode=verify-ca` | Verify CA |
| `sslmode=verify-full` | Verify Full |

Two more spellings are handled because they are what JDBC and Heroku write.
`?ssl=false` maps to `disable`. `?ssl=true` maps to `verify-system`, which is the
form's own mode name - not a libpq one - for "verify the chain and the host name
against the runtime's trust store, with no PEM to paste". That mapping follows a
stated rule: a boolean TLS spelling maps onto the mode that matches what the
engine's own driver does with it, never onto a weaker one. Handed `ssl: true`,
`pg` connects with Node's default `rejectUnauthorized: true`, so `verify-system`
is the mode that describes it.

It used to map to `require`, which here means `rejectUnauthorized: false`:
encrypted, chain not verified. The form had no mode that both verified and asked
the user for nothing, and pointing `?ssl=true` at `verify-ca` or `verify-full`
turned a working paste into a connection nobody could complete without a
certificate they did not have. `verify-system` is that missing mode.

Because `verify-system` is the form's mode name rather than libpq's,
`?sslmode=verify-system` in a URL is reported as a parameter that cannot be
honoured rather than accepted. A spelling libpq does not define is not a spelling
the parser will act on, even when the form happens to use the same word.

## Encrypted is not authenticated

Now the case where the URL names no mode at all.

`shouldEnableSSL()` in the shared SQL base looks at the host. If it matches a
known managed pattern - `supabase`, `render`, `neon`, `planetscale`, `aws`,
`azure`, `gcp`, `cloud` - SSL is enabled. What it enables is
`{ rejectUnauthorized: false }`.

Read that literally. **The cloud SSL auto-detect does not verify the server
certificate. The connection is encrypted and not authenticated, which leaves it
open to a machine in the middle that terminates TLS and presents a certificate
nobody checked.** The bytes on the wire are unreadable to a passive observer. The
identity of the party at the other end is unestablished. Those are different
properties and only the first one is delivered by the heuristic.

The precedence in `buildSSLConfig()` is what makes this recoverable: an explicit
`connection.ssl` is resolved first, and the host heuristic only runs when the
connection carries no `ssl` object at all. Choosing a mode other than Disable is
not a workaround for the heuristic - it is the branch that takes priority over
it.

Disable is the exception, and worth knowing before you rely on it. The connection
form opens at SSL Mode `disable` and writes no `ssl` object while it is there:
`buildConnection()` in `use-connection-form.ts` builds one only when the mode is
something else, which is how turning TLS off clears a certificate the form was
holding. An absent `ssl` object is exactly the input the heuristic acts on, so on
a matching host the field reading Disable still opens an encrypted, unverified
connection.

| Mode | What `pg` gets |
| --- | --- |
| `disable` | no SSL |
| `require` | `rejectUnauthorized: false` - the one mode that encrypts without verifying |
| `verify-system` | `rejectUnauthorized: true`, no `ca` passed, so Node's trust store checks chain and host name |
| `verify-ca` / `verify-full` | `rejectUnauthorized: true`, with the `caCert` you paste set as `ca` |

`pg` exposes no separate host-name check, so `verify-ca` and `verify-full` build
the same object here. That is a property of the driver.

## The two sslmode values that are declined rather than mapped

`prefer` and `allow` are not mapped. Neither is any spelling the table above does
not know. Both mean "encrypt if the server offers it, otherwise do not", and no
mode on the form expresses that, because every mode on the form is a decision.

Guessing in either direction is wrong against a live server. Measured on
PostgreSQL 18 with no server certificate configured: `?sslmode=prefer` connects
and `pg_stat_ssl.ssl` reads `f`, while `?sslmode=require` is refused outright
with *server does not support SSL, but SSL was required*. Map `prefer` to
`require` and a URL that worked stops working. Map it to `disable` and a URL that
would have been encrypted against a TLS-capable server silently stops being
encrypted.

So the mode the form already holds is left alone, and the paste banner names the
parameter it declined to act on. You get told `sslmode=prefer` was not applied,
in the same moment you paste, rather than discovering months later that a
connection you believed was configured from the URL was configured from a
default. Set SSL Mode yourself in the SSL / TLS panel.

## Certificate paths belong to the machine that wrote the string

`sslrootcert`, `sslcert` and `sslkey` are ignored.

They are ignored because of where this software runs. Those three parameters
are filesystem paths, and they are paths on the machine that composed the
connection string - a laptop, a CI runner, someone's terminal. LibreDB Studio deploys as a container beside the database, so
the process that opens the connection is the server, and
`/Users/someone/.postgresql/root.crt` does not exist there. A path that resolves
on the writer's machine and not on the reader's is worse than absent: it fails at
connect time with a file error that reads like a permissions problem.

The SSL / TLS panel holds PEM **text**, not a path. Paste the certificate
contents - `caCert`, `clientCert` and `clientKey` map onto `pg`'s `ca`, `cert`
and `key`. [The security page](/security) states the same boundary alongside the
others this build publishes.

## Setting a verified TLS mode by hand

For a managed provider whose certificate is signed by a CA the runtime already
trusts - which is the ordinary case for the vendors the heuristic matches -
`verify-system` needs nothing pasted:

```ts
const connection = {
  id: 'pg-prod',
  name: 'Production',
  type: 'postgres',
  connectionString: 'postgresql://user:secret@ep-x.eu-central-1.aws.neon.tech/main',
  ssl: { mode: 'verify-system' },
  createdAt: new Date(),
};
```

That sets `rejectUnauthorized: true` with no `ca`, so Node verifies the chain and
the host name against its own trust store. Pick `verify-ca` or `verify-full`, and
supply `caCert`, only when the server's certificate is signed by a CA the runtime
does not already trust - a private CA, or a provider that publishes its own root.

Two caveats on the vendor list. The host patterns are string matches, not a
verified compatibility claim: no managed PostgreSQL service has been probed
through this provider, and Neon, Supabase, Cloud SQL, Aurora and AlloyDB are
recorded as *no instance was reachable*. A host
that matches gets encryption enabled; that is all the match means. And a host
that does not match any pattern gets nothing from the heuristic: SSL falls to the
driver default unless you set a mode. That includes every self-hosted server and
every managed provider on a custom domain.

The shortest correct habit: after pasting a URL, open the SSL / TLS panel and
read the mode. A mode you chose is the mode you get. A mode you did not choose -
including the Disable the form opens on - hands the decision to a host-name match
that encrypts without checking who answered. The [engine reference](/databases)
carries the rest of the PostgreSQL provider's transport detail.
