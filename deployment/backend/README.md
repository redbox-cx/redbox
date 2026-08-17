# Backend LXC

This stack runs the public API, admin API and all backend data services.

## Cloudflare Tunnel

Configure these public hostnames for the backend tunnel:

```text
api.redbox.cx       -> http://backend:3000
admin-api.redbox.cx -> http://admin-backend:3001
```

## Setup

Run from the repository root:

```bash
cp deployment/backend/.env.example deployment/backend/.env
nano deployment/backend/.env
```

Replace every `CHANGE_ME` value. Make sure these pairs match:

```text
MYSQL_PASSWORD      must match the password inside DATABASE_URL
REDIS_PASSWORD      must match the password inside REDIS_URL
MINIO_ROOT_USER     should match S3_ACCESS_KEY unless you create a separate MinIO key
MINIO_ROOT_PASSWORD should match S3_SECRET_KEY unless you create a separate MinIO key
```

Build:

```bash
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml build
```

Start data services:

```bash
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml up -d db redis minio minio-init
```

Run migrations:

```bash
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml --profile tools run --rm migrate
```

Start backend services and tunnel:

```bash
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml up -d
```

Optional one-time admin seed:

```bash
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml --profile tools run --rm seed-admin
```

`seed-admin` is never started automatically.

## Incomplete file uploads

Redbox allows only one active multipart file upload per user. Reloading or
closing the upload page requests an immediate authenticated abort. The backend
also scans every ten minutes and aborts multipart uploads that have had no
activity for one hour, even when their Redis metadata has already disappeared.

MinIO is configured with an independent seven-day stale-upload fallback. This
last safety net still works while the backend or Redis is unavailable and does
not delete completed objects. Apply MinIO environment changes by recreating the
service:

```bash
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml up -d --force-recreate minio
```
