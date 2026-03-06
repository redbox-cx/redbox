# redbox -- Backend API Documentation

redbox is a high-security, zero-knowledge file-sharing platform.
It allows users to upload large files (up to 2GB) to a 10TB infrastructure,
share them via secure links, and
ensures data is automatically wiped after 30 days.

## Architecture Overview

- Framework: NestJS (Node.js)
- Database: MariaDB (via Prisma ORM)
- Caching/State: Redis (Upload state tracking & session management)
- File Integrity: 30-day automatic deletion (Cron Job)
- Token System: Dual-JWT (Access & Refresh Tokens) with Rotation and
  Session Keys

## Security Concept (Zero-Knowledge Sharing)

### 1. Client-Side Encryption

The backend acts as a "blind" storage provider.

**Decryption Key:**\
The key used to encrypt/decrypt file content is generated in the browser
and stored in the URL fragment (#). This part of the URL never touches
the server.

**Encrypted Chunks:**\
The server only receives and stores encrypted binary data.

### 2. Password Gatekeeper (Optional)

While the server cannot read the file, it can control who downloads the
encrypted stream.

- If a user sets a password during upload, the backend stores a bcrypt
  hash.
- The download stream is only released if the correct password is
  provided in the query string.

### 3. Session Security (sessionKey)

Every user profile contains a sessionKey (UUID).

- All active JWTs (Access & Refresh) contain this key.
- Instant Revocation: Changing the sessionKey in the DB (via logout or
  password change) instantly invalidates all issued tokens globally.

## Authentication (Auth)

### POST /auth/register

Creates a new account. Anonymous-friendly: No email or name required.

**Body**

```json
{
  "username": "...",
  "password": "...",
  "passwordConfirm": "...",
  "inviteCode": "..."
}
```

Logic: Validates inviteCode against the database, hashes the password
(bcrypt), and generates an initial sessionKey.

### POST /auth/login

**Body**

```json
{
  "username": "...",
  "password": "..."
}
```

**Response**

```json
{
  "access_token": "...",
  "refresh_token": "..."
}
```

Note: Sets a masterkey in Redis to manage active encrypted
sessions.

### POST /auth/refresh

Rotates tokens to keep the user logged in without re-entering
credentials.

Auth: Bearer `<refresh_token>`{=html}

Logic: Rotates the sessionKey in the database, making the old RT and AT
useless.

### POST /auth/password

Auth: Bearer `<access_token>`{=html}

**Body**

```json
{
  "oldPassword": "...",
  "newPassword": "...",
  "newPasswordConfirm": "..."
}
```

Action: Changes password and regenerates sessionKey (forced global
logout).

## File Sharing (Upload & Download)

The system uses a 3-phase handshake to bypass Cloudflare's 100MB limit
and track upload state.

### Phase 1: Initialization

POST /files/init

Auth: Bearer `<access_token>`{=html}

**Body**

```json
{
  "fileSize": 123456,
  "totalChunks": 20,
  "password": "optional"
}
```

**Response**

```json
{
  "uploadId": "..."
}
```

Logic: Checks 2GB quota. If a password is provided, it is hashed and
stored in Redis temp metadata.

### Phase 2: Sequential Chunk Upload

PATCH /files/upload-chunk/:uploadId

Auth: Bearer `<access_token>`{=html}

Body (Multipart):

- file (max 100MB)
- chunkIndex (0,1,2...)

Validation: Redis tracks the nextExpectedChunk. If a chunk is sent out
of order or the uploadId is invalid, the request is rejected.

### Phase 3: Finalization

POST /files/complete

Auth: Bearer `<access_token>`{=html}

**Body**

```json
{
  "uploadId": "...",
  "fileName": "...",
  "totalChunks": 20,
  "mimetype": "..."
}
```

**Response**

```json
{
  "fileId": "...",
  "shareToken": "..."
}
```

Action: Merges chunks using a non-blocking stream pipeline. Moves
passwordHash from Redis to MariaDB. Sets expiresAt to now + 30 days.

## Public Download

GET /files/download/:id

Auth: None (Public endpoint)

Query Params:

    ?token=SHARE_TOKEN
    &password=OPTIONAL_PASSWORD

Logic:

1.  Checks if shareToken matches the DB.
2.  Checks if file has expired.
3.  Validates optional password.

Response: Binary Stream (StreamableFile).

## User Dashboard & Maintenance

### GET /files

Auth: Bearer `<access_token>`{=html}

Response: List of own files including shareToken, size, createdAt, and
expiresAt. Includes quota object (used/total bytes).

### DELETE /files/:id

Auth: Bearer `<access_token>`{=html}

Action: Physically removes the file from the Server and deletes the DB
record.

## Automated Cleanup

Trigger: Cron Job (Every hour).

Action:

- Scans the DB for expiresAt \< now.
- Deletes the binary files from the HDD.
- Removes entries from the database to free up space.

## Global Response Format

Successful responses:

```json
{
  "status": "Ok",
  "message": "Custom success message",
  "result": {}
}
```

Error responses:

```json
{
  "status": "Error",
  "message": "Error description",
  "result": null
}
```
