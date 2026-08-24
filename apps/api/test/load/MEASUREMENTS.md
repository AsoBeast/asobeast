# Load benchmark measurements

Every number here came from `pnpm --filter api run bench:<scale>` against
`docker-compose.bench.yml`, which inherits the memory ceilings and the Redis
`maxmemory` the production stack ships. Re-run it and replace the table when the
hardware, the limits or the fixture change.

## How to reproduce

```bash
pnpm run bench:stack
pnpm --filter api run db:deploy
pnpm --filter api run bench:small
pnpm --filter api run bench:target
pnpm --filter api run bench:stress
pnpm run bench:stack:down
```

`DATABASE_URL` must name a database ending in `_bench`. Sample the containers
while a run is in flight to capture peak memory.

```bash
while true; do docker stats --no-stream --format '{{.Name}} {{.MemUsage}}'; sleep 2; done
```

## Host under test

| Property   | Value                                                         |
| ---------- | ------------------------------------------------------------- |
| Date       | 2026-08-20                                                    |
| Machine    | Apple M3 Pro, 18 GB, macOS 26.6.2                             |
| Docker     | Engine 29.7.2                                                 |
| PostgreSQL | `postgres:18-alpine`, limit 384M                              |
| Redis      | `redis:8-alpine`, limit 320M, `maxmemory 192mb`, `noeviction` |

This is a development machine, not the deployment target. The orchestration
timings scale with the machine; the request projections and the shed decisions
do not, because they are arithmetic over the tracked workload and the store rate
limits. **A target scale run on the deployment host is still owed** and belongs
in this table beside the numbers below.

## Results

| Measure                                 | small     | target      | stress        |
| --------------------------------------- | --------- | ----------- | ------------- |
| Apps                                    | 3         | 20          | 50            |
| Tracked keyword markets                 | 75        | 8,000       | 75,000        |
| Ranking rows in the fixture             | 525       | 720,000     | 6,750,000     |
| Database size after the fixture         | 10 MB     | 227 MB      | 2,060 MB      |
| Budget query                            | 24 ms     | 110 ms      | 847 ms        |
| Fan out                                 | 19 ms     | 443 ms      | 3,918 ms      |
| Jobs enqueued                           | 81        | 8,020       | 75,000        |
| Daily requests the budget prices        | 81        | 36,040      | 337,600       |
| Utilization of one day of capacity      | 0.4%      | 222%        | 2,084%        |
| Stages shed by the degradation guard    | none      | reviews     | reviews, apps |
| Peak PostgreSQL memory of its 384 MB    | 25 MB, 6% | 306 MB, 80% | 362 MB, 94%   |
| Peak Redis memory of its 192 MB ceiling | 12 MB, 6% | 60 MB, 31%  | 190 MB, 99%   |
| OOM kills                               | none      | none        | none          |

## What the numbers say

**Nothing was killed at any scale, and stress is the ceiling.** At target scale
PostgreSQL peaked at 306 MB of its 384 MB limit and Redis at 60 MB of the 192 MB
at which it starts refusing writes. At stress scale PostgreSQL reached 94% of its
limit and Redis 99% of its ceiling, which is the point where `noeviction` turns a
memory ceiling into a hard write failure and nothing is enqueued at all. The
shipped ceilings hold comfortably for the target workload and have almost no
headroom left at stress.

That is exactly what `storage.headroom.low` and `queue.memory.high` are for. Both
alert at 80% and page at 90%, so both would have fired on the way to the stress
run rather than after it.

**Orchestration is not the bottleneck.** The budget query and the fan out
together cost under 600 ms at target scale, against a daily window measured in
hours. Even at stress scale, nine times larger, they cost under five seconds.

**The store rate limits are the bottleneck, and they bind well before the target
workload.** At target scale the day prices at 36,040 requests against a capacity
of roughly 16,200, which is 222% of a day:

| Store       | Requests | Rate   | Wall clock | Inside a 24 hour window |
| ----------- | -------- | ------ | ---------- | ----------------------- |
| App Store   | 4,020    | 15 rpm | 4.5 hours  | Yes                     |
| Google Play | 32,020   | 10 rpm | 53.4 hours | No                      |

Google Play dominates because one Play keyword search at depth 200 costs eight
requests where the App Store costs one, and because `SCRAPE_GPLAY_RPM` is 10
rather than 15. Eight thousand keyword markets split evenly across the two stores
is therefore a Play problem, not a database problem.

The degradation guard behaves exactly as designed: at 222% pressure it sheds
reviews, and at 2,084% it sheds reviews and app refreshes as well, keeping the
keyword captures that are the product.

## The named limit

**One host on a single egress address supports roughly 3,600 keyword markets a
day at an even store split, not the 8,000 the target fixture tracks**, and the
limit is `SCRAPE_GPLAY_RPM` rather than memory, storage or orchestration. The
arithmetic is capacity divided by cost per keyword market:

- Google Play: 10 rpm is 14,400 requests a day, at 8 requests a search, so 1,800
  Play keyword markets.
- App Store: 15 rpm is 21,600 requests a day, at 1 request a search, so more
  than 20,000 Apple keyword markets, minus the app, review and category work.

An even split therefore stops at 1,800 markets per store, or 3,600 in total,
because the Play half exhausts its budget while the Apple half has used a tenth
of its own.

A workload that is mostly Apple therefore goes much further on one host than a
workload that is evenly split. Raising the ceiling is not a matter of a bigger
machine: it needs more egress addresses, which is what the proxy pool is for.
See `docs/operations/capacity.mdx`.
