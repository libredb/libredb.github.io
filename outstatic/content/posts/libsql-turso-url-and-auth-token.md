---
title: Connecting to a hosted libSQL database with a token
status: published
author:
  name: LibreDB
  picture: ''
slug: libsql-turso-url-and-auth-token
description: The credential is an auth token rather than a password and the database is the host, so the dialog renders no user name and no database input at all.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-06T09:00:00.000Z
---

You create the database, copy what the CLI prints, open the connection dialog and
find two of the boxes you were expecting absent: there is no Username and no
Database. A form that still drew a Username field here would be drawing a box with
nowhere to write to. This dialog used to draw both regardless, and the save
discarded whatever was typed into them. It now gates its inputs on the field list
the provider publishes, so a box appears exactly where a value is written.

## The five configuration fields, and the two that are not among them

The libSQL provider publishes this configuration list, and the dialog is built from
it:

| Field | Required | Meaning |
| --- | --- | --- |
| `host` | yes, or a URL | `libredb-probe.turso.io`, or the machine running `sqld` |
| `port` | no | Defaults to `8080` plaintext, `443` under TLS |
| `password` | when the server requires one | The auth token, sent as `Authorization: Bearer` |
| `ssl` | no | Any mode other than `disable` selects HTTPS |
| `connectionString` | no | A `libsql://` URL, resolved into the fields above |

There is no `user` and there is no `database`. libSQL has no user names, and on
this engine the database is the host: a hostname on Turso Cloud, a namespace on a
self-hosted server. The `password` field exists but is labelled **Auth Token**,
because the value pasted into it is a JWT rather than a password.

So the filled-in form for a hosted database is a host, a token, and TLS on. That is
the whole connection.

## Why there is no user name here

Nothing in libSQL authenticates a person. The server takes a bearer token and
decides from the token alone what the request may do, which means there is no
identity to type next to it. The token comes from the CLI:

```bash
turso db tokens create <database>              # full access
turso db tokens create <database> --read-only  # read-only
```

A self-hosted `sqld` started without authentication takes no token at all - and
sending an empty one is a 400 rather than an anonymous connection, so a connection
with no token sends no header instead of an empty one.

The failure modes are worth knowing before you meet them, because libSQL uses two
different error envelopes. A rejected statement answers **HTTP 200** with the error
inside `results[]`, so `response.ok` says the pipeline was accepted and never that
the statement ran. An authentication failure answers outside that envelope: no
token to a private database is a `401`, and a malformed token is a `400`. The
provider therefore treats 400 as an authentication status alongside 401 and 403.
Keying only on 401 would have reported a typo in a pasted token as a connection
failure, and you would have gone looking at the network.

The read-only token above is also the answer to a limit further down this page.
There is no read-only profile to switch on in the tool for this engine; the
restriction is minted into the credential you paste.

## Pasting the URL the CLI prints

The connection dialog accepts a connection string, in the form the Turso CLI and
the dashboard already print:

```
libsql://<database>-<org>.turso.io?authToken=<jwt>
```

That is the output of:

```bash
turso db show --url <database>
```

Paste it and it resolves into the fields above: host, TLS, and the token moved into
the Auth Token box. Nothing is invented on the way through - the URL carries
exactly the three values the form would have asked for, which is why pasting it and
typing it produce the same connection.

## What the scheme implies about transport and port

`libsql://` is not a hint. It implies TLS, and it implies 443, which is how Turso
Cloud serves every database. There is no plaintext form of the scheme, and that is
a deliberate refusal rather than a gap: `http://` already resolves to ClickHouse in
this codebase's connection-string parser, and two engines cannot own one scheme. A
self-hosted server on plain HTTP is reached through the host and port fields with
TLS off, on `sqld`'s own default port `8080`.

Underneath, there is no driver. A statement is JSON in the body of a
`POST /v2/pipeline` - the Hrana protocol - and the answer comes back through the
runtime's own `fetch`. The whole transport is about 330 lines including the
comments that record the wire.

That has a visible consequence in the health panels: each statement is one
stateless HTTP request, so there is no pool to size and no session to list. Active
connections are absent, max connections reads `0` for "no limit published", and
uptime reads `N/A`. Nothing publishes them.

## One connection type, two deployments

One type-id, `libsql`, reaches both a self-hosted libSQL server and Turso Cloud.
They are not two integrations. They speak the same protocol and embed the same
SQLite - 3.47.0 measured on both, on 2026-08-27 - and every statement, every
catalog read and every refusal measured the same on each.

Where they differ, they differ in what they publish about themselves rather than in
what they can do:

| Reading | Self-hosted `sqld` | Turso Cloud |
| --- | --- | --- |
| Version panel | `sqld 0.24.33 (f8fb14f3 2026-08-11) (SQLite 3.47.0)` | `SQLite 3.47.0` - there is no `GET /version` route |
| Transport | Host and port, TLS off by default | TLS on 443 |
| Token | None, if the server started without authentication | Required |
| `dbstat` | Answers | Answers |

That last row is why table and index bytes are real numbers here rather than blanks:
`dbstat` answers on both deployments, so the sizes on the Storage tab are measured -
4096 bytes of table and 4096 of index for a three-row table in the probe fixture.
Where `dbstat` is absent on some other engine the byte fields are omitted rather
than zeroed, because 0 B reads as an empty table, which is a claim.

Now the boundaries, stated in full. **There is no user name field and no database
field in this dialog, because libSQL has no user names and the database is the
host.** Nothing you can enable will bring them back; a tool that showed them would
be showing you inputs it intends to discard. **And Turso Database, the Rust rewrite,
is deliberately not supported**: it is a different engine rather than a deployment
of this one, and it publishes no server image - it ships in-process as an npm
package, so there is nothing for a container beside your database to connect to.
That row appears in the coverage map only after someone has connected to it.

Two more limits belong on the same page. Maintenance here offers `reindex` and
`check` only, because the server's statement allowlist refuses `VACUUM`, `ANALYZE`,
`PRAGMA optimize` and `PRAGMA wal_checkpoint` on both deployments; the toolkit is
admin-only in any case. And agent AUTO mode ends `engine-unsupported` on libSQL,
because `PRAGMA query_only = true` is refused by the server, so there is no
database-native read-only profile to acquire. Agent PLAN mode opens on this
connection like any other: it is toolless, executes nothing, and drafts a statement
for a human to run.

The rest is a normal SQLite session over the network. The published capability line
for this engine sits with the others on the [engine pages](/databases), and the
container that holds the connection is set up in
[getting started](/get-started).
