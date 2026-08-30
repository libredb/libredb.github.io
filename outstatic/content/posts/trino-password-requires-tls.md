---
title: Trino refuses a password over plain HTTP
status: published
author:
  name: LibreDB
  picture: ''
slug: trino-password-requires-tls
description: Measured against a coordinator with authentication switched off, a basic auth header over plain HTTP still answers 401, so the connection is refused early.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-07-29T09:00:00.000Z
---

A Trino password is not allowed for insecure authentication, and the coordinator
says so in those words before it looks at anything else you sent. Not the
catalog, not the statement, not whether the cluster has authentication
configured at all. The rule belongs to the server, and every client meets it in
the same place.

Everything below was measured against Apache Trino 476, the official
`trinodb/trino:476` image, on 2026-08-20.

## What the coordinator does with a password over plain HTTP

Trino has no driver. A statement is the body of an HTTP request to
`POST /v1/statement`, and the answer is read by following a chain of `nextUri`
links. Default port `8080`, which the client protocol shares with the web UI.
There is no connection pooling and no session object: each statement is one
stateless exchange.

So a password is not a handshake parameter. It is an `Authorization: Basic`
header on an ordinary HTTP request, and the coordinator decides what to do with
it before the request is a statement:

```console
$ curl -s -i -H "Authorization: Basic $(printf 'user:password' | base64)" \
       -H 'X-Trino-User: libredb' --data-binary 'SELECT 1' \
       http://localhost:8080/v1/statement
HTTP/1.1 401 Unauthorized
Content-Type: text/plain;charset=utf-8
WWW-Authenticate: Basic realm="Trino"

Password not allowed for insecure authentication
```

The statement was valid. `SELECT 1` needs no catalog and no schema. The
credential is what was refused, and it was refused for the transport it arrived
over.

## Why authentication being disabled does not help

The measurement above was taken against a coordinator with authentication
switched off entirely - the stock image, no password authenticator configured,
no file realm, nothing to check a password against. It still answers 401.

That surprises people in a specific way. The reasoning goes: authentication is
off, so credentials are ignored, so sending a spare username and password is
harmless. It is not harmless. **Sending a password over `http://` breaks a
connection that would otherwise have worked.** Remove the password from the same
connection and it connects, lists a catalog and runs statements.

The rule is not "the password is wrong". It is that a password on a cleartext
channel is a credential the coordinator will not accept into the process at all,
and refusing it is the only handling that does not put it on the wire in front
of whatever is between you and the cluster. Whether anyone would have verified
it is beside the point.

This is worth separating from a second 401 the same endpoint produces, because
they look alike and mean different things. A request that carries no identity at
all gets:

```console
$ curl -s -i --data-binary 'SELECT 1' http://localhost:8080/v1/statement
HTTP/1.1 401 Unauthorized
Content-Type: text/plain;charset=utf-8

Basic authentication or X-Trino-Original-User or X-Trino-User must be sent
```

Both are plain text, not JSON, which matters more than it sounds like it does.
Anything the coordinator refuses before it becomes a statement answers in text;
parse it as JSON and you raise a second, misleading error on top of the first
one. Everything after that point is the opposite: a failed statement arrives as
HTTP **200** with the failure inside the document. `SELEKT 1`, a missing table
and an unsupported DDL all answer 200. The status line is consulted for exactly
one thing on this engine, and this is it.

## Refused in the client, before the round trip

LibreDB Studio does not send that request. The Trino transport constructor
refuses the configuration up front, when the connection is created, with a
message that names both ways out:

> Trino refuses a password over plain HTTP. Enable TLS on the connection, or
> remove the password to connect as an unauthenticated user.

The reasoning is the same one that governs which controls appear per engine on
[the engines page](/databases): a round trip that can only end one way is not
worth taking, and an error that arrives from the server carries less than a
sentence written where the decision is made. A 401 in a connection dialog reads
as a rejected credential. It sends people to look for the account, the realm,
the group membership - none of which exist here. The configuration, not the
credential, is what is wrong, and the remedy is two fields away.

When a 401 does come back from the coordinator - a real password authenticator
rejecting a real password - it is categorised as `auth` and surfaces as an
authentication error with the coordinator's own wording kept verbatim.
`PERMISSION_DENIED` reaches the same category by the other route: it is a
statement failure, so it arrives inside a 200 with a Java stack attached, and
that stack is dropped at the seam. Measured on the simplest possible typo, the
part that is dropped is 19 frames and 3.3 KB, none of it about your query.

## Connecting as an unauthenticated user instead

Against a cluster with authentication disabled, the working configuration is the
short one. The coordinator's host is the only field that has to be filled in:

| Field | Value |
| --- | --- |
| Host | the coordinator |
| Port | `8080` if left blank |
| Database | the **catalog** to pin, for example `tpch` |
| Username | optional, sent as `X-Trino-User` |
| Password | leave empty on `http://` |
| SSL | off |

The Database field is a catalog, not a database. Trino's hierarchy is catalog to
schema to table, so the pinned catalog occupies the slot a PostgreSQL database
would, and the tree below it is two levels deep with every table displayed
`schema.table`. A connection that pins no catalog still connects and still runs
fully qualified statements; what it cannot do is show a tree, and it says so
rather than showing an empty one.

Here is the limit, stated plainly, because it is two limits and only one of them
is obvious. **A password is a TLS-only credential here: a connection carrying one
over plain HTTP is refused before it is attempted, and a connection naming no
user runs under a default identity rather than none.** The user header is never
omitted, because omitting it produces the second 401 above. A connection that
names no user runs as `libredb`, and that is the name the coordinator's own UI
and `system.runtime.queries` will show against every statement it runs. If you
are reading a query history to find out who ran something, an unauthenticated
Trino connection has told you nothing. That is a property of the deployment, not
of the client, and it is one of the reasons the [security
model](/security) treats the network the container sits on as part of the
control set rather than an implementation detail.

## Turning on TLS, and what that changes about the port

Enabling SSL on the connection selects `https://`, and the password becomes
sendable in the same act. What it does not do is change the port.

`8080` remains the default under TLS, and that is deliberate rather than an
oversight. A secured Trino cluster listens wherever its operator put it - the
coordinator's own configuration decides - and inventing a well-known HTTPS port
would send credentials to a number where nothing is listening. So the port is
yours to type: whichever one your coordinator serves TLS on is the one the field
wants. There is no connection string to
paste this into either: `jdbc:trino://host:port/catalog/schema` is a real and
widely used form, but the shared parser does not accept it, and offering a field
that rejects everything pasted into it is worse than not offering the field.

The order of operations that follows from all of this is short. Confirm the
coordinator serves TLS and on which port. Turn SSL on. Then add the password.
Doing it the other way round produces a 401 that describes the transport and
looks like it describes the account.
