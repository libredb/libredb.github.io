---
title: The tool goes to the data
status: published
author:
  name: LibreDB
  picture: ''
slug: the-tool-goes-to-the-data
description: Why a database IDE belongs in the network beside the database, and what that constraint forces the architecture to look like.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
publishedAt: 2026-07-14T09:00:00.000Z
---

A managed Postgres is ready in forty seconds. Reaching it takes the rest of the
afternoon. That gap is not a tooling inconvenience — it is the whole design brief
for LibreDB Studio.

## The three bad options

Once a database lives inside a cluster, a PaaS project or a customer's VPC, a
laptop cannot see it. There are three usual ways around that, and all three cost
something real.

**Expose the port.** Open 5432 to the internet and every scanner on the network
finds it before you do. It closes at the first security review, and it should.

**Dig a tunnel.** A bastion host, a key per engineer, a tunnel re-dug every
morning and dropped mid-query. It works, in the sense that a rope bridge works.

**Install a desktop client.** Licensed per seat, tied to one machine, and useless
the moment the person holding that machine is on a train.

Each option moves the *data* toward the *tool*. Dumps, replicas, tunnels — four
terabytes travelling so that one person can read four hundred rows.

## Invert it

Move the tool to the data instead and the whole shape changes. One container next
to the database, on the same private network, speaking to it over a link that
never leaves that network. What travels to the engineer is a URL.

Take that seriously and it stops being a preference and becomes a specification:

- **It has to run in a browser.** A native client cannot be deployed next to a
  database; a container serving HTTP can.
- **It has to reach a phone.** The query that matters most is often the one you
  run at 03:00, away from a laptop.
- **It has to deploy like infrastructure.** A Docker image, a Helm chart, an
  operator bundle, a one-click template — the same channels the database itself
  arrived through.
- **It has to be unrestricted.** A tool that must go everywhere cannot carry a
  licence that asks where it is going. MIT is not generosity here; it is a
  requirement of the architecture.

## What that costs

Running in a browser means no local filesystem, so exports stream. Running beside
the database means the deployment surface is yours to secure, so the first boot
generates its own secrets and prints them once. Reaching sixteen engines means
the honest answer to "does it do X on engine Y" is sometimes no — and a control
that cannot work is hidden rather than offered and then failed.

Those are the trades. We think they are the right ones, and we would rather write
them down than discover them together in an incident channel.
