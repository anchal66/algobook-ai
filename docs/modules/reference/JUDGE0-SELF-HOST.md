# Judge0 CE — self-hosting reference (D-05)

Module 01 talks to Judge0 through `src/lib/judge/judge0.ts`, which reads three
environment variables. Switching from RapidAPI to a self-hosted instance is a
configuration change only.

| Variable | RapidAPI (default) | Self-hosted |
|---|---|---|
| `JUDGE0_BASE_URL` | `https://judge0-ce.p.rapidapi.com` | `https://judge.yourdomain.com` |
| `JUDGE0_HOST_HEADER` | `judge0-ce.p.rapidapi.com` | *(empty)* |
| `RAPIDAPI_KEY` | your RapidAPI key | *(unused)* |
| `JUDGE0_AUTH_TOKEN` | *(unused)* | the `AUTHN_TOKEN` you set in `judge0.conf` |

When `JUDGE0_HOST_HEADER` is empty the client sends `X-Auth-Token` instead of the
RapidAPI headers. Everything else (batch submit, polling, base64 payloads,
language ids 62/71/54/63) is identical because self-hosted Judge0 CE is the
same software RapidAPI fronts.

## docker-compose (Judge0 CE 1.13.x)

```yaml
# docker-compose.yml — small VPS (2 vCPU / 4 GB is plenty for a few hundred users)
services:
  server:
    image: judge0/judge0:1.13.1
    volumes: ["./judge0.conf:/judge0.conf:ro"]
    ports: ["2358:2358"]
    privileged: true
    restart: always
  workers:
    image: judge0/judge0:1.13.1
    command: ["./scripts/workers"]
    volumes: ["./judge0.conf:/judge0.conf:ro"]
    privileged: true
    restart: always
  db:
    image: postgres:16
    env_file: judge0.conf
    volumes: ["postgres-data:/var/lib/postgresql/data/"]
    restart: always
  redis:
    image: redis:7
    command: ["bash", "-c", 'docker-entrypoint.sh --appendonly no --requirepass "$$REDIS_PASSWORD"']
    env_file: judge0.conf
    restart: always
volumes:
  postgres-data:
```

Minimal `judge0.conf` (download the full template from the Judge0 release and change these):

```ini
REDIS_PASSWORD=change-me
POSTGRES_PASSWORD=change-me
AUTHN_HEADER=X-Auth-Token
AUTHN_TOKEN=a-long-random-token            # → JUDGE0_AUTH_TOKEN in .env.local
ENABLE_BATCHED_SUBMISSIONS=true
MAX_SUBMISSION_BATCH_SIZE=20
ENABLE_WAIT_RESULT=false
MAX_CPU_TIME_LIMIT=15
MAX_WALL_TIME_LIMIT=20
MAX_MEMORY_LIMIT=512000
ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT=false   # required for Java
```

Put nginx/Caddy with TLS in front of port 2358, then:

```bash
JUDGE0_BASE_URL=https://judge.yourdomain.com
JUDGE0_HOST_HEADER=
JUDGE0_AUTH_TOKEN=a-long-random-token
```

Start the app; `verifyLanguages()` checks `GET /languages` on the first judge
call and fails loudly if any of the four language ids is missing (the cgroup v1
requirement of Judge0 1.13 applies: on Ubuntu 22.04+ add
`systemd.unified_cgroup_hierarchy=0` to the kernel command line).
