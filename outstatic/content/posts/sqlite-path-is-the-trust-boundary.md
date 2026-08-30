---
title: On a shared instance a SQLite path is an access decision
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlite-path-is-the-trust-boundary
description: Path validation rejects a null byte and nothing else, so any logged-in user can open any SQLite file the Studio process is able to read.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: security
    label: Security
publishedAt: 2026-05-03T09:00:00.000Z
---

Most engines in Studio take a host and a port, and the database server decides what you
may see. SQLite takes a file path, and there is no server in the loop at all. Access
control for the database file moves out of the engine and into the deployment, and today
it lands in one place: the filesystem permissions of the Studio process, and nothing
above them.

## What the path validator actually checks

`getDatabasePath()` in `src/lib/db/providers/sql/sqlite.ts` resolves a connection's
target in three steps: `connectionString` if present, with a `file:` prefix stripped;
otherwise `database`; otherwise `:memory:`. A non-`:memory:` value is then run through
`path.resolve()` to an absolute path, and one check is applied to the result - it is
rejected if it contains a NUL byte, with a `DatabaseConfigError` reading "Invalid
database path: NUL bytes are not allowed".

That is the entire validation. There is no prefix check, no base directory, no
allowlist, no symlink resolution. The resolved absolute path goes straight to the
driver, which opens it with
`{ create: true, readwrite: true }` and then sets `PRAGMA foreign_keys = ON`,
`journal_mode = WAL` and `synchronous = NORMAL`. Parent directories are created on
connect.

State the limit plainly. **There is no path sandboxing by design. The only validation
is that the path contains no NUL byte, so on a shared self-hosted instance any logged-in user can open any SQLite file the
Studio process can read.** That sentence is in the provider document under Known
limitations, and it is here for the same reason: a boundary a reader can only learn by
testing it is not published.

## Relative segments do not traverse anything, they just resolve

It is tempting to describe `../../../etc/app.db` as traversal, which implies a control
was evaded. Nothing was evaded. `path.resolve()` normalises the segments, and the
absolute path that comes out is the path that gets opened. The integration suite pins
both halves of this deliberately: NUL rejection, and `..` acceptance. The second is a
test of intended behaviour, not a known gap someone forgot to close.

The reason it is intended is the feature's trust model. A connection's path is set by
whoever configures the connection, and pointing Studio at an arbitrary server-side
SQLite file is the capability being offered, not attacker-controlled input arriving
from an untrusted client. On a laptop or a single-operator install that is exactly
right: you want to open the database at whatever path you happen to have put it.

What this does not grant is any access to an unauthenticated client. The path comes
from an authenticated user's connection configuration. The distinction that matters
for multi-user installs is one step further in, and it is the next section.

## What a shared instance changes

Authenticated does not imply trusted with the host filesystem.

On a single-operator install those two are the same person, and the trust model holds
exactly. On a shared instance they are not. Every logged-in user of that instance can
create a SQLite connection, and the reachable set of files is defined by the operating
system: whatever the Studio process user can open. Another team's application database,
a backup someone left in `/var/tmp`, a file mounted for somebody else's connection - if
the process can read it, a connection pointed at it will open and the schema explorer
will list its tables.

One change made this more visible without making it larger. When SQLite became
selectable in the connection modal, `isFileBased()` collapsed the form to a single
**Database File Path** input - no host, no port, no user, no password. Exposing the
type in the picker granted no new server-side reach; the connection travels in the
request body and `resolveConnection()` accepts `type: "sqlite"` regardless of what the
form offers, so the picker was never a security control. What changed is
discoverability. The effort needed to reach an arbitrary path dropped from a
hand-crafted API call to typing in a form.

The reachable set of files is identical either way. Operators of multi-user
deployments should treat "any logged-in user can open any SQLite file the Studio
process can read" as an explicit assumption to check against their threat model,
rather than as a corner case.

The same filesystem question turns up on four surfaces, and they are worth holding in
one mental model:

| Surface | What the path controls |
| --- | --- |
| Normal connection | The whole reachable set; opened readwrite, file created if absent |
| Agent AUTO mode | A second, physically separate read-only handle on that same file, with `PRAGMA query_only` set and re-verified before every statement |
| `VACUUM INTO '<path>'` under that profile | Refused by `query_only`, but SQLite creates the destination file before refusing, so a zero-byte file can appear at any path the process can write |
| `ATTACH` of an existing file | Succeeds on a read-only handle and its rows become readable; held off at the input stage by the statement guard, which is defense in depth and explicitly not a containment boundary |

The agent read-only profile is a control over what statements may do to a file. It is
not a control over which files exist within reach. Those are different problems, and
only the first one has an in-product answer today.

## The mitigations that exist today are all OS-level

There is no product setting that narrows the path. An optional base directory
allowlist restricting resolvable paths is proposed in issue #125 and is open work; it
was deliberately left out of the honesty fix that produced the documentation above,
because new security-configuration surface needs its own issue rather than riding
along with a wording change.

Until it lands, the controls available are the ones the host already provides:

- **The process user.** Run Studio as a user whose read scope is narrow. Every file
  it cannot open is a file no connection can reach, and this holds regardless of what
  any user types into the path field.
- **Container mounts.** Mount only the databases the instance is meant to serve. A
  path that resolves outside the mount namespace resolves to nothing.
- **Filesystem permissions on the neighbours.** Studio's own data directory sits on
  that filesystem too, alongside whatever else shares the host.

None of these is a workaround for a missing feature so much as the layer where the
answer currently lives. The engine has no permission system to lean on; SQLite has no
users, no roles and no server process to enforce anything, so the enforcement point is
the one the kernel offers.

## Deploy so the blast radius is a directory

The practical shape of this is a container that can see one directory and no more:

```yaml
services:
  libredb-studio:
    image: ghcr.io/libredb/libredb-studio:latest
    volumes:
      - ./databases:/data/sqlite:ro
      - libredb-data:/app/data

volumes:
  libredb-data:
```

The bind mount is doing the work there: it is the only place SQLite files exist inside
the container, so the reachable set is that directory. The second half of the boundary
is the process user, and the image already sets one - the entrypoint starts as root only
long enough to make the mounted data volume writable, then drops to the image's non-root
application user before running the server.

Read-only is a deliberate choice, not a default: a `ro` mount means Studio can browse
and query those files and cannot write to them, which also means no row editing and no
maintenance operations against them. If the instance is meant to edit, drop the `ro`
and accept that every user of the instance can edit every file in that directory. That
is the trade, stated in one place rather than discovered per user.

For a single-operator install none of this is necessary and the plain path field is the
feature working as designed. For anything shared, the mount is the access control, and
it should be written down next to the deployment rather than held in someone's head. The
[deployment guide](/deploy) lists the channels this image ships through.
