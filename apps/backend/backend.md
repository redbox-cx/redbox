# redbox - Backend API Documentation

redbox is a high-security platform designed for journalists and activists. This API handles identity (Zero-Knowledge principle), secure file uploads to a 10TB infrastructure, and an exclusive invite system.

## Architecture Overview

- **Framework:** NestJS (Node.js)
- **Database:** MariaDB (via Prisma ORM)
- **Caching/Realtime:** Redis
- **Encryption:** AES-256-CBC (Files "At Rest" on HDD)
- **Token System:** Dual-JWT (Access & Refresh Tokens) with Rotation

---

## Security Concept (Crucial for Frontend!)

### 1. The Master-Key Principle

Files are never stored in plaintext.

- Upon **Registration**, the backend generates a random 256-bit **Master-Key**.
- This Master-Key is encrypted using the user's password (via scrypt) before being stored in the DB.
- **Note:** If a user loses their password, their files are irrecoverable because the backend cannot decrypt the Master-Key without the password.

### 2. Session Invalidation (sessionKey)

Every user has a `sessionKey` (UUID) in the database, which is part of the JWT payload.

- Upon **Logout** or **Password Change**, the `sessionKey` is regenerated in the DB.
- This immediately invalidates all existing tokens, even if they haven't expired yet.

---

## Authentication (Auth)

### POST `/auth/register`

Creates a new account. Requires a valid invite code.

- **Body:** `{ "username", "password", "passwordConfirm", "inviteCode" }`
- **Validation:** `password` and `passwordConfirm` must match.

### POST `/auth/login`

Returns two tokens on success.

- **Body:** `{ "username", "password" }`
- **Response:** `{ "access_token", "refresh_token" }`
- **Frontend-To-Do:** Keep `access_token` in memory (State). Store `refresh_token` securely.

### POST `/auth/refresh`

Exchanges a refresh token for a new pair of tokens.

- **Auth:** `Bearer <refresh_token>`
- **Frontend-To-Do:** Must be called automatically when an API call returns a `401 Unauthorized` error.

### POST `/auth/change-password`

Changes the password and invalidates all other active sessions.

- **Auth:** `Bearer <access_token>`
- **Body:** `{ "oldPassword", "newPassword", "newPasswordConfirm" }`

---

## File Management (Upload & Download)

Due to **Cloudflare's 100MB request limit**, redbox uses a 3-phase handshake for uploads.

### Phase 1: Initialization

**POST `/files/init`**

- **Body:** `{ "fileSize": number }` (size in bytes)
- **Server check:** Checks if the user has enough space (2GB individual limit).
- **Response:** `{ "uploadId": string }`

### Phase 2: Chunk Upload (Loop)

**PATCH `/files/upload-chunk/:uploadId`**

- **Body (Multipart/Form-Data):**
  - `file`: The file segment (Blob)
  - `chunkIndex`: number (0, 1, 2...)
- **Frontend Logic:** Use `file.slice()` to split the file into **50MB chunks** and send them sequentially.

### Phase 3: Finalization

**POST `/files/complete`**

- **Body:** `{ "uploadId", "fileName", "totalChunks", "mimetype" }`
- **Backend:** Merges chunks using a streaming pipeline and encrypts the final file with AES-256.

### Other Actions

- **GET `/files`**: Lists all user files and returns quota usage (used bytes / 2GB).
- **GET `/files/download/:id`**: Decrypts the file "on-the-fly" and streams it to the browser.
- **DELETE `/files/:id`**: Deletes the DB record and the physical file from the HDD.

---

## User & Invites

### GET `/user/profile`

Returns username, avatar, creation date, and role.

### POST `/user/avatar`

- **Body:** `{ "avatar": "EXAMPLE1" }` (Uses Enums from the schema).

### POST `/user/invites`

Generates a new code (RB-XXXX). Limited to 2 codes per user.
