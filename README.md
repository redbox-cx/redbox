# RedBox Setup Guide

## 1. Infrastructure in /redbox/

```bash
docker-compose up -d
```

## 2. Backend in /redbox/apps/backend/

```bash
cd apps/backend
pnpm install
# Ensure .env exists based on .env.example
pnpm exec prisma migrate dev
pnpm run start:dev
```

## 3. Frontend in /redbox/apps/frontend/

```bash
cd apps/frontend
pnpm install
pnpm run dev
```

## Default Ports

- Backend: [http://localhost:3000](http://localhost:3000)
- Frontend: [http://localhost:5173](http://localhost:5173)
- Database (MariaDB): localhost:3306
