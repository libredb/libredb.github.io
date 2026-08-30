---
title: The Cassandra field no other connection asks for
status: published
author:
  name: LibreDB
  picture: ''
slug: cassandra-local-data-center-field
description: The driver refuses to build a load-balancing policy without a local data centre, which is why that field sits in the open rather than under Advanced.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-04-14T09:00:00.000Z
---

Fill in host, port, user and password for a fresh Cassandra node, press Connect, and nothing
opens. The sentence that comes back is not from the server:

```
'localDataCenter' is not defined in Client options and also was not specified in
constructor. At least one is required. Available DCs are: [datacenter1]
```

The answer is already inside it: `datacenter1`. That one required field explains two things
about the Cassandra connection form that look arbitrary until you know why - where the field
sits, and why there is no box to paste a URL into.

## The four fields, and the fifth one

Host, port, user and password are the four fields most connection forms open on. Cassandra
needs a fifth, and no other engine in [the supported list](/databases) requires it.

| Field | Required | What it is |
| --- | --- | --- |
| `host` | Yes | One contact point. The driver discovers the rest of the ring itself |
| `port` | No, 9042 | The native CQL protocol. Thrift on 9160 is gone from 4.0 onwards |
| `localDataCenter` | **Yes** | The data centre this client treats as local |
| `database` | No | The keyspace. The form labels it Keyspace |
| `user` / `password` | No | Sent only when a user is set |

A stock install runs `AllowAllAuthenticator` and ignores credentials entirely - measured:
supplying them to an open server connects fine. So on a first local node, the two fields a
user expects to be mandatory are not, and the one they have never seen before is.

The form puts `localDataCenter` in the open rather than behind the Advanced accordion that
holds Oracle's service name. That placement is not a style call. Advanced is where optional
things go, and a hidden mandatory field is a connection nobody can open: the reader would fill
in everything visible, press Connect, and be told about a field they were never shown. It is
also classified `public` in `connection-secrets.ts` rather than as a secret, because a data
centre name is not a credential, and `resolution` in `use-connection-payload.ts`, because it
decides which nodes a statement reaches.

## The driver will not build a policy without it

The requirement is the driver's, not the server's. LibreDB Studio speaks to Cassandra through
`cassandra-driver` 4.9.0 - Apache-2.0, pure JavaScript, no `binding.gyp`, no `.node` file and
no postinstall step, so there is nothing in it to fail in an air-gapped install. That client
builds a load-balancing policy at construction time, and the policy is what decides which node
a statement is sent to first. Without a local data centre there is no rule for that ordering, so
the client refuses to be constructed at all.

Get the name wrong instead of leaving it out and the driver is more helpful:

```
localDataCenter was configured as 'dc-does-not-exist', but only found hosts in data
centers: [datacenter1]
```

Both of those arrive as `ArgumentError`, which the provider classifies as a configuration
fault and surfaces as `DatabaseConfigError`. Almost every other Cassandra connection failure -
a refused credential, a refused socket, an unresolvable host name - arrives as
`NoHostAvailableError` with `code === undefined`, so a classifier keyed on the error code puts
all of them in one bucket called unknown. The per-host fault is in `err.innerErrors[host]`,
and the seam unwraps it before classifying. A
wrong data centre is one of the few faults that names itself on the way out, and it is
reported as the configuration error it is rather than as a network problem.

## What a stock single node reports

On a default single-node install the answer is `datacenter1`. That string is the form's
placeholder, so the common case is one field the reader can confirm rather than research.

If you are pointing at something someone else configured, the node will tell you:

```sql
SELECT data_center FROM system.local;
```

That is the same table the connection's identity read already uses for `release_version`,
`cluster_name` and `gossip_generation`, and it is readable even by a least-privilege role -
the driver's own control connection reads `system.local` for the cluster topology before this
provider sends anything.

To get a node to ask against, the studio repo's compose file pins `cassandra:5.0.9`,
publishes 9042 and carries a `nodetool status` healthcheck. Readiness takes about 206 seconds
from cold on that image, so wait on the healthcheck rather than on a fixed sleep - a
connection attempt during that window fails as unreachable, which reads like a wrong host and
is not. Then create something to look at:

```sql
CREATE KEYSPACE probe WITH replication = {'class':'SimpleStrategy','replication_factor':1};
```

Everything here was measured against Apache Cassandra 5.0.9, the official image, on
2026-08-20. ScyllaDB is served by this same provider as a wire-compatible relative and needs
`NetworkTopologyStrategy` for that keyspace, because the 2026.2 line refuses
`SimpleStrategy`.

## The keyspace is pinned at connect time

The fourth field deserves the same attention, because it fails at the same moment. The
connection's `database` field pins exactly one keyspace for the session, the way a PostgreSQL
connection pins a database.

A keyspace that does not exist fails the **connect**, not the first statement:

```
Keyspace 'nosuchks' does not exist
```

The provider surfaces that sentence as the server wrote it rather than wrapping it in a
generic failure to connect, because the one word the reader has to change is inside it.

Leave the field empty and the connection opens. What it cannot do then is show a schema tree,
and `getSchema()` says exactly that instead of rendering an empty one. Fully qualified
statements still run; unqualified ones answer `No keyspace has been specified. USE a
keyspace, or explicitly specify keyspace.tablename`. `USE <keyspace>` in the editor works and
really does change the session's keyspace - measured, and worth saying because in the
stateless HTTP providers in this repo a `USE` succeeds and then affects nothing.

## Why there is no connection string to paste

Several connection forms in the product offer a paste toggle: drop in a URI, get the fields
filled. Cassandra's does not. `supportsConnectionString` is `false`, the parser in
`connection-string-parser.ts` has no branch for a `cassandra://` scheme, and
`ENGINE_URI_SCHEMES` has no entry.

The reason is the field this whole post is about. No URI convention in use carries
`localDataCenter`. A `cassandra://host:9042/keyspace` form could be invented and parsed, and
what it would produce is a fully populated form that cannot open a connection - the reader
would then be looking for a missing value in a dialog that appeared to have accepted
everything. A paste field that reliably yields a broken connection is worse than no paste
field.

So the limit, stated plainly: **there is no connection string on this engine, because no URI
convention carries the required local data centre, and a keyspace that does not exist fails
the connection itself rather than the first statement.** There is nothing to paste, so the
fields are typed.

Neither of those two facts is a limitation this product could remove by writing more code.
One is a property of the driver's load-balancing policy and one is a property of how
Cassandra binds a session to a keyspace. What is a design decision is where the field sits
and whether the form pretends a URL could replace it.
