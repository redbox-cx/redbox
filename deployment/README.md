# Redbox Deployment

This deployment is split across two Proxmox LXC containers:

- `deployment/backend/` for API, admin API, MariaDB, Redis, MinIO and backend tunnel
- `deployment/frontend/` for the React frontend and frontend tunnel

## LXC 1: Backend Stack

Files:

```text
deployment/backend/docker-compose.yaml
deployment/backend/.env.example
deployment/Dockerfile.backend
```

Services:

```text
backend       -> public API on 3000
admin-backend -> admin API on 3001
db            -> MariaDB
redis         -> Redis
minio         -> S3-compatible object storage
minio-init    -> bucket creation helper
cloudflared   -> tunnel for backend hostnames
```

Cloudflare tunnel public hostnames:

```text
api.redbox.cx       -> http://backend:3000
admin-api.redbox.cx -> http://admin-backend:3001
```

Setup on the backend LXC:

```bash
cp deployment/backend/.env.example deployment/backend/.env
nano deployment/backend/.env
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml build
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml up -d db redis minio minio-init
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml --profile tools run --rm migrate
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml up -d
```

Optional initial admin seed, only if you explicitly want it:

```bash
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml --profile tools run --rm seed-admin
```

## LXC 2: Frontend Stack

Files:

```text
deployment/frontend/docker-compose.yaml
deployment/frontend/.env.example
deployment/Dockerfile.frontend
deployment/nginx.frontend.conf
```

Services:

```text
frontend    -> nginx serving the built React app on 80
cloudflared -> tunnel for frontend hostnames
```

Cloudflare tunnel public hostnames:

```text
redbox.cx     -> http://frontend:80
www.redbox.cx -> http://frontend:80
```

Setup on the frontend LXC:

```bash
cp deployment/frontend/.env.example deployment/frontend/.env
nano deployment/frontend/.env
docker compose --env-file deployment/frontend/.env -f deployment/frontend/docker-compose.yaml build
docker compose --env-file deployment/frontend/.env -f deployment/frontend/docker-compose.yaml up -d
```

## Useful Checks

Backend LXC:

```bash
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml ps
docker compose --env-file deployment/backend/.env -f deployment/backend/docker-compose.yaml logs -f backend admin-backend cloudflared
```

Frontend LXC:

```bash
docker compose --env-file deployment/frontend/.env -f deployment/frontend/docker-compose.yaml ps
docker compose --env-file deployment/frontend/.env -f deployment/frontend/docker-compose.yaml logs -f frontend cloudflared
```

## Notes

- Do not commit real `.env` files.
- The frontend's `VITE_API_URL` is compiled into the static build. Rebuild the frontend image after changing it.
- Keep backend app ports internal. Cloudflared reaches them by Docker service name.
- For LXC, enable nesting before installing Docker.
