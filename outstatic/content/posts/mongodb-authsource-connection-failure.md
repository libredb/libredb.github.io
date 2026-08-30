---
title: The MongoDB login failure that is not a wrong password
status: published
author:
  name: LibreDB
  picture: ''
slug: mongodb-authsource-connection-failure
description: authSource names the database the credentials live in, not the one you are opening, and getting it wrong fails exactly like a bad password.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-04-03T09:00:00.000Z
---

A user is created inside a database. That single sentence is the reason most
first-connection attempts against this engine end in an `AuthenticationError`
reading *Authentication failed*, and the reason `authSource` is the field to
check before you retype the password. The driver checks credentials against whichever database the
connection names, unless something tells it otherwise. In the ordinary
deployment - users administered in `admin`, application data in a database of
its own - nothing tells it otherwise, and the server answers with the same error
it would give a typo.

## The four things a MongoDB connection needs

LibreDB Studio speaks MongoDB through the official `mongodb` Node.js driver
(node-mongodb-native) on the default port 27017. `validate()` accepts a
connection in one of two shapes: a connection string, or discrete fields with at
least a host and a database. From the discrete fields the provider assembles the
URI itself:

```
mongodb://<user>:<password>@<host>:<port>/<database>[?authSource=<authSource>]
```

Four separable facts go into that line, and only three of them are the ones
people think about.

| Field | What it answers |
| --- | --- |
| host, port | Where the server is. Port defaults to 27017. |
| database | Which database you are opening. |
| user, password | Who you are. The pair is URL-encoded, and the whole `user:password@` segment is dropped when neither is set. |
| authSource | Which database holds the record of who you are. |

The fourth is the one that is not a restatement of the second. If it is empty,
no query string is appended, and the driver falls back to the database named in
the path. That fallback is correct for exactly one deployment shape: the user
was created in the database being opened.

## Why authSource is separate from the database you open

MongoDB creates users inside a database. A user created in `admin` and a user
of the same name created in `shop` are two different principals. Authentication
is therefore a
two-argument operation - credentials, plus the database to check them against -
and the connection URI only carries one database in an obvious place.

`authSource` is the second argument. It is not a permission setting, not a
default schema, and not a fallback for the database field. It says: look for
this user *here*, then open *that*.

```ts
// user created in the database being opened - no authSource needed
{ host: 'localhost', port: 27017, database: 'app', user: 'app', password: 'secret' }

// user created in admin, data in shop - the ordinary deployment
{ host: 'localhost', port: 27017, database: 'shop',
  user: 'app', password: 'secret', authSource: 'admin' }
```

The second form could not be expressed through the discrete fields at all before
the field existed, which is how we learned what the failure looks like from the
outside.

## Authentication failed, and why that message misleads

The provider maps driver errors through the shared `mapDatabaseError()`, with no
MongoDB-specific branches. A driver message containing *authentication* becomes
an `AuthenticationError`, reported as `Authentication failed:` followed by the
driver's own text. A failure to reach the server at all becomes a
`ConnectionError` that carries the host and port. Those are two different
classes, and the split is the useful part - but a wrong `authSource` lands in
the first one, because from the server's point of view nothing is wrong with the
network and no such user exists in the database it was asked to look in.

So the error is accurate and unhelpful at the same time. It tells you
authentication failed. It does not tell you that authentication was attempted
against `shop` when the user lives in `admin`. Two causes arrive wearing the
same sentence:

- the password is genuinely wrong;
- the user exists, in a different database, and `authSource` is empty or wrong.

Retyping the password addresses the first and rules out nothing else. Checking
where the user was created costs one command and eliminates the second.

A third failure gets blamed on the credentials without ever producing that
message. A server started with `--tlsMode requireTLS` refuses a connection whose
SSL mode is `disable`, and says so in its own words - *The server is configured
to only allow SSL connections*, logged in a measurement taken on 2026-08-23
against `mongo:latest`. Nothing in that string is matched as an authentication
failure, so it is not classified as one. Read the message before you decide
which failure you are holding.

## Pasted URIs carry their own auth source

A `connectionString` is used verbatim. `buildConnectionString()` returns it
untouched if present, and never appends to it - so a pasted URI carries its own
`?authSource=`, and the connection form offers no separate input while you are
in that mode. This is deliberate: two copies of the same parameter, one in
the string and one in a field beside it, is one value with two places to
disagree with itself.

The consequence for debugging is that the field you were told to check is not
missing, it is inside the string you pasted. If the URI came from a platform
console or a teammate's clipboard, read the query string before you read
anything else, because nothing the form does will edit it.

TLS is the exception to that rule, and it is worth knowing which way it cuts.
The SSL panel does apply alongside a pasted string, because the driver reads a
second options channel it prefers over the URI. A `tls=true` or `ssl=true` in
the URI sets the form to `verify-system`, and a `mongodb+srv://` scheme with no
TLS parameter does the same, because SRV implies TLS in the driver itself.
`authSource` does not work that way. The string wins, entirely.

## Confirming the connection before you blame the credentials

The cheapest way to tell those failures apart is to open a connection that has
none of them. Start a server with no authentication and no TLS, and connect to
it:

```sh
docker run --rm -p 27017:27017 mongo:7
```

Then open `mongodb://localhost:27017/test` in the connection dialog. After the
client is built, the provider issues a `{ ping: 1 }` command before reporting
success, so a connection that lands in the tree has actually spoken to the
server rather than merely resolved its address. If that works and your real
connection does not, the transport is fine and you are looking at credentials or
at where they live. The repo fixture, the `mongodb` service in
`database-compose.yml`, is that shape: a root user `admin` with password
`admin`, created in `admin`, which is therefore the auth source whichever
database you open.

Once you are in, there is a boundary to know about before you type anything into
the editor. **No SQL translation layer is faked here: the editor runs MongoDB
JSON command objects, and a statement written in shell syntax starting with
`db.` cannot be run at all.** Not translated, not approximated - the parser
requires a document with `collection` and `operation`, and anything else is a
query error that answers with the format it expected.

```json
{ "collection": "users", "operation": "find", "filter": { "active": true } }
```

That is the same envelope the agent's plan mode is given verbatim - the JSON
command shape, and the explicit note that a statement starting with `db.` cannot
be run here - because a plan run on 2026-08-22 drafted
`db.orders.aggregate([...])`, correct MongoDB that the editor cannot execute.
Plan mode is the only agent mode this connection has. It is toolless, it runs
nothing, and it drafts a statement for a person to run; the metered auto run ends
`engine-unsupported` here, because the read-only execution profile it needs is
database-native and exists only on PostgreSQL, SQLite and DuckDB.

A `find` with no explicit limit returns at most 100 documents, so a first query
that looks suspiciously round is not a truncation bug. The collection list is
read with `listCollections()` and capped at 200, but the field types under each
collection are inferred from a 100-document sample rather than read from a
catalog, which is worth remembering the first time a field you know exists is
missing from the tree.

The engine's published limits, transport and default port are listed on the
[databases page](/databases), and the connection dialog itself is the first
thing covered in [getting started](/get-started).
