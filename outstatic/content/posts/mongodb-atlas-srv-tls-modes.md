---
title: Connecting to MongoDB Atlas and what the URI decides for you
status: published
author:
  name: LibreDB
  picture: ''
slug: mongodb-atlas-srv-tls-modes
description: An SRV URI implies TLS in the driver and maps the form to a verifying mode, but two of the five SSL choices build the same options object.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-02-14T09:00:00.000Z
---

A connection dialog that reads `disable` on a connection that is in fact
encrypted is not a cosmetic problem. It is the panel someone screenshots for an
audit. That is what happened when you connected to MongoDB Atlas here: you pasted an
SRV string, the driver negotiated TLS because the scheme makes it, and the SSL
panel said the connection was in the clear. The URI was right and the form was
wrong about it.

That has been fixed, and fixing it meant writing down which of the five SSL modes
does what. Two of them build the same driver options.

## What an SRV URI decides before you touch the form

MongoDB is a genuine connection-string engine in LibreDB Studio.
`buildConnectionString()` returns `config.connectionString` verbatim when one is
present, and only assembles a URI from discrete host/port/database fields when
there is none. A pasted string is not parsed, normalised and re-emitted. It is
handed to the driver as typed.

That matters because the `mongodb+srv://` scheme carries a decision of its own:
the driver turns TLS on for every SRV connection itself, and with chain
verification. An SRV URI carrying no `tls=` parameter is still a TLS connection,
so the form has something to describe before you touch it.

So the paste box reads the URI and maps its TLS spelling onto the SSL mode the
form displays, by the rule in `readBooleanTLS`:

| In the pasted URI | SSL mode set on the form |
| --- | --- |
| `tls=true` / `ssl=true` | `verify-system` - TLS with chain verification |
| `tls=false` / `ssl=false` | `disable` |
| `mongodb+srv://` with no TLS parameter | `verify-system` - SRV implies TLS in the driver |
| `tlsInsecure=true` or `tlsAllowInvalidCertificates=true` alongside TLS | `require` |
| a non-boolean value such as `tls=maybe` | nothing; the paste banner quotes the parameter |

The mapping is applied even in connection-string mode. The URI is returned
verbatim, so nothing can be appended to it, but the options object handed to
`MongoClient` is a second channel the driver reads, and it wins. That is why
`tls=true` used to be ignored on purpose: before `verify-system` existed, the
only non-`disable` mode that needed no pasted PEM was `require`, which sets
`rejectUnauthorized: false`, and writing that into the options object would have
stopped an Atlas certificate from being verified. The
form stayed quiet rather than silently weakening the connection. `verify-system`
removes the trade, so the form can now say what the URI says.

## Which mode encrypts and which mode verifies

`buildTLSOptions()` maps `connection.ssl` onto the driver's own TLS options.
`tls`, `ca`, `cert`, `key` and `rejectUnauthorized` are all on the driver's
allow-list - `LEGAL_TLS_SOCKET_OPTIONS` in `mongodb/lib/cmap/connect.js` - and
reach `tls.connect` under Node's names, so the material maps the same way it does
for PostgreSQL, MySQL and Couchbase.

| `ssl.mode` | Options added |
| --- | --- |
| absent / `disable` | none |
| `require` | `tls: true`, `rejectUnauthorized: false` |
| `verify-system` | `tls: true`, `rejectUnauthorized: true`, and no `ca` |
| `verify-ca` / `verify-full` | `tls: true`, `rejectUnauthorized: true` |

`require` encrypts and checks nothing. That is not an oversight: a self-hosted
replica set presents a self-signed certificate by default, and a mode that
refused it would be a mode nobody could use on their own cluster.
`verify-system` is the same handshake with verification on and nothing to paste,
which is what an Atlas cluster needs - its certificate is signed by a public
root the runtime already trusts.

Two smaller rules sit underneath that table. `caCert`, `clientCert` and
`clientKey` become `ca`, `cert` and `key` independently of each other, so a
cluster can demand mutual TLS while presenting a self-signed certificate itself.
And an explicit `ssl.rejectUnauthorized` always wins over the mode, which is the
escape hatch for the deployment none of the five mode names fits.

The behaviour was measured against a TLS-only server on 2026-08-23
(`mongo:latest --tlsMode requireTLS`): `disable` is refused, with the server
logging *"The server is configured to only allow SSL connections"*, and `require`
connects in 20ms with *"Ingress TLS handshake complete"* on the server side. Both
arms mattered, because before the mode reached the driver at all, `require`
failed in exactly the way `disable` does.

## The two modes that build the same options

One row of that table needs saying outside it: **`verify-ca` and `verify-full`
build the same driver options object.** They differ in name only. The Node
driver exposes no separate host-name check that Studio could switch on for
`verify-full` and leave off for `verify-ca`, so there is nothing for the second
name to add.

Both names stay in the dropdown because `SSLMode` is one shared type across every
provider - `disable`, `require`, `verify-system`, `verify-ca`, `verify-full` -
rather than a per-engine list. What they must not do is imply a control you have
exercised: choosing `verify-full` over `verify-ca` on MongoDB changes nothing
about the connection. If host-name verification is part
of your threat model, this is the wrong layer to satisfy it, and the [security
page](/security) lists this class of boundary next to the controls rather than
underneath them.

One consequence: `tlsAllowInvalidHostnames=true` in a pasted URI is deliberately
not in the relaxing set that maps to `require`. This provider never sends
`checkServerIdentity`, so that URI parameter survives untouched next to a
verifying mode, and the form does not claim to have overridden something it did
not touch.

## Where the credentials database fits into a pasted URI

`authSource` is the database the credentials live in, and it is not always the
one being opened. MongoDB creates users inside a database, and the driver checks
them against whichever database the URI names when nothing says otherwise. The
ordinary deployment - users in `admin`, data in an application database - could
not be reached through the discrete host/port/database fields at all before there
was a field for it. It failed as a credentials error, which is what it looks like
and is not what it is.

In connection-string mode there is no `authSource` input, and that is not an
omission. The pasted URI carries its own `?authSource=`, and since the string is
used verbatim a form field would be a second copy of a value that already exists.
When the URI names no `authSource` and the user was created somewhere other than
the database being opened, the failure arrives as a credentials error, so that is
the parameter to check first when a password you are sure about is rejected.

Note the asymmetry with TLS: the SSL mode *is* applied alongside a pasted
connection string, because the options object is a channel the driver reads, and
the dialog shows the SSL panel in connection-string mode. `authSource` is not,
because it can only travel inside the URI.

## Managed services this has and has not been probed against

MongoDB Atlas is the cloud vendor this provider is documented against, and the
SRV path above is the reason it needs no configuration beyond the paste.

FerretDB connects through this same provider and was probed at `full`: FerretDB
2.7.0 speaking MongoDB 7.0.77 wire protocol, signed in with the backing
PostgreSQL credentials. `authMechanism=PLAIN` is rejected on that path.

**Amazon DocumentDB and Azure Cosmos DB have not been tested, because no instance
was reachable.** They are not listed as supported and they are not listed as
broken. Either might work; nobody here has run a probe, so there is no row and no
opinion, which is a different state from a failure.

What you get once connected is MongoDB's own query language - a JSON command
envelope, not SQL and not mongosh syntax - because no translation layer is
faked here. A statement that starts with `db.` cannot be run in the editor at
all. That is a separate constraint from the transport, and it is the one to
settle before you paste a query you already had.
