---
title: Connecting to Oracle without installing the Instant Client
status: published
author:
  name: LibreDB
  picture: ''
slug: oracle-thin-mode-service-name
description: 'Thin mode is the default and needs no native client, and the field people get wrong is the one Oracle actually connects to: a service, not a database name.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-14T09:00:00.000Z
---

Two things go wrong on the first Oracle connection, and they fail at different
moments. The first is the assumption that reaching Oracle from a container means
building an image around a hundred megabytes of native client library. It does
not; the driver here runs in thin mode and loads no client at all. The second is
the field labelled *database*, which on Oracle is not a database at all. Get
that one wrong against a container fixture and the listener refuses you by name.

## Thin mode, and the servers it covers

The Oracle provider is built on `oracledb`, and it runs the driver in thin mode
- pure JavaScript, with no native Oracle client installed anywhere in the
container. That is why the published image `ghcr.io/libredb/libredb-studio` has
no Oracle-specific build step and no hundred-megabyte layer: there is nothing to
install. You start the container, open the connection dialog and type a host.

The bound on that convenience is a server version, and it is worth saying before
you pick an image rather than after. The published image ships thin mode only,
and thin mode supports Oracle Database 12.1 and later. An older server - 11.2
and earlier - fails with the driver's `NJS-138`, which the provider maps to a
non-retryable `DatabaseConfigError` naming `ORACLE_CLIENT_LIB_DIR`. Reaching
such a server needs a derived image carrying an Instant Client and a
process-level environment variable pointing at it, because the thin-or-thick
choice is made once per process rather than once per connection.

Every other `connect()` failure here becomes a retryable `ConnectionError`.
`NJS-138` does not, because retrying a version mismatch is only a slower way to
fail.

## What thick mode would take, and why the choice is process-wide

Thick mode exists and is a single environment variable:

```bash
# Absolute path to an already-installed Instant Client lib directory.
ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient_19_28
```

When it is set, the constructor calls `oracledb.initOracleClient({ libDir })`
and the driver runs thick instead of thin. If nothing is at that path, the
constructor fails fast with a `DatabaseConfigError` naming the variable rather
than a driver error you have to decode.

The reason it is an environment variable and not a per-connection checkbox is
node-oracledb's own design. The thin/thick choice is a process-wide singleton:
`initOracleClient()` throws if it is called twice, or after any pool or
connection already exists. Every Oracle connection in the process shares one
driver mode. The constructor guards its call with a module-level flag so it runs
at most once however many connections you open. A per-connection setting would
be a lie in the dialog - the second connection could not honour it.

The version of the client matters too, and it is the reverse of what people
expect. Thick mode delegates to Oracle's native client, and the newest client is
not the most capable one against an old server: Instant Client 19c is the newest
that still reaches 11.2, and 21c and 23ai cannot connect to 11.2 at all. So the
derived image layers 19c on top of the published image, installs the runtime
base's `libaio1t64`, and sets the variable. Mounting a client directory from the
host into the stock image and pointing the variable at the mount works the same
way.

## Oracle connects to a service

Now the field. `getConnectString()` returns a pasted connection string unchanged;
otherwise it builds `host:port/service`, where the service comes from
`serviceName ?? database ?? 'ORCL'`. With no connection string given,
`validate()` requires `host` only - it does not require `database`, because
Oracle has nothing there to require.

The dialog reflects that fallback rather than swapping one field for another.
Oracle gets an extra Service Name box in the advanced section, and when that box
is empty the Database Name field is used as the service name. So a value typed
into the database box is not ignored on Oracle - it becomes the service, which
is why the mistake in the next section produces a refusal from the listener
rather than a missing-field error in the form.

The consequence is that an EZConnect string is the whole configuration:

```text
localhost:1521/XEPDB1
```

That string is handed straight to the driver's `connectString`. A full TNS
descriptor works in the same slot. Port 1521 is the declared default, and
`supportsConnectionString` is true, so you can paste the string instead of
filling three fields.

TLS lives in the same string rather than beside it. There is no options object:
`ssl.mode` composes `tcps://host:port/service`, sets `sslServerDNMatch`, and
concatenates the CA, client certificate and client key into one `walletContent`
PEM. Thin mode calls `tls.connect` with `rejectUnauthorized: true`
unconditionally, so there is no encrypt-without-verifying mode to select and a
self-signed server is reachable only by supplying its CA. A pasted connect
string is passed through verbatim, so the protocol *it* names is the one used -
selecting `require` alongside a `tcp` string does not upgrade the transport.

## The fixture, and the only service name it answers

The repository's compose fixture is where the service-name rule bites hardest,
because the file appears to tell you the answer and does not.

```yaml
oracle:
  image: gvenzl/oracle-xe
  container_name: libredb-oracle
  environment:
    ORACLE_PDB: ORCLPDB1
    ORACLE_PASSWORD: 'Password123!'
  ports:
    - '1521:1521'
```

`ORACLE_PDB: ORCLPDB1` is not read by the `gvenzl/oracle-xe` image. `XEPDB1` is
the only pluggable database that container creates, and the listener refuses
every other service name. So the settings that work are `localhost`, port
`1521`, user `system`, the password the compose file sets, and service name
`XEPDB1` - not the value written two lines above it in the same file. The
standalone fixture in the provider doc is a different image and therefore a
different name again: `gvenzl/oracle-free:slim` answers on `FREEPDB1`.

If Studio itself is running in a container, use the compose network and the host
`oracle` rather than `localhost` - `localhost` inside the app container is the
app container.

A failure here does not look like a wrong password. The provider maps
`ORA-12541`, `ORA-12154` and anything carrying `TNS:` to a `ConnectionError`,
while `ORA-01017` becomes an `AuthenticationError`. Reading which of the two you
got tells you whether to change the service name or the credentials.

## Why a URL is taken apart before the driver sees it

One more shape catches people who have connected to other engines from the same
dialog. An `oracle://user:pass@host:1521/service` URL is **not** a valid driver
connect string. Nothing in the Oracle driver parses it.

It still works in the product, and the reason is worth knowing because it
explains what to do when it does not. The paste-parser decomposes the URL into
discrete fields - host, port, user, password and database - before the provider
is ever constructed, and the path segment lands in Database Name, not in the
Service Name box. The provider then builds an EZConnect string from those fields
the ordinary way, so the service is whatever `serviceName ?? database` resolves
to. The URL is therefore a convenience of the form, not a supported wire format:
the driver never sees the string you pasted, only the fields the parser
produced. A service name left in the advanced box from an earlier attempt still
wins over the one in the URL. Check the fields, not the string.

## Where this sits in what the engine can do

Thin mode is the connection story, not the capability story. On Oracle the
editor, row editing and ER diagrams are all present, the audit trail and the
maintenance toolkit are admin-only, schema introspection is five bulk queries
over the `ALL_*` data-dictionary views filtered by `OWNER`, and monitoring reads
the `V$` views with each sub-query independently privilege-guarded, so a
low-privilege user gets a dashboard with gaps rather than a failure. There is no
Explain action: `supportsExplain` is false until an Oracle dialect wrapper
exists, and the UI hides the action rather than running the query unchanged.
Agent AUTO mode does not run here either - it needs a database-native read-only
profile, which exists for PostgreSQL, SQLite and DuckDB only, so an auto run on
Oracle ends engine-unsupported. Plan mode does open on the connection, toolless,
and drafts a statement for a human to run. The per-engine boundaries are listed
on the [databases page](/databases).
