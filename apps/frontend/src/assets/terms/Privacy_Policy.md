# redbox
## Privacy Policy
Effective Date: April 20, 2026 · Platform: redbox.cx

redbox is a non-profit, privacy-first platform. We collect as little data as possible, encrypt everything we can, and do not sell or share your data with third parties. This policy explains in detail what data we process, how it is stored, and what your rights are.

### 1. Data Controller
The redbox platform ("Service") is operated by the redbox project team, a non-profit initiative:
Website: redbox.cx | Contact: contact@redbox.cx

For the purposes of the Swiss Federal Act on Data Protection (revDSG / nDSG) and, where applicable, the EU General Data Protection Regulation (GDPR), the redbox project team acts as the data controller.

### 2. Scope of This Policy
This Privacy Policy applies to all data processed in connection with your use of the redbox platform, including the webmail client, file upload service, and pastebin (collectively, the "Service"). It does not apply to third-party services whose infrastructure the platform may interact with (e.g. Cloudflare Email Routing), which are governed by their own privacy policies.

### 3. Data We Collect and Why

#### 3.1 Account and Identity Data
When you register, we store the following in our database:
- Username (chosen by you — we recommend not using your real name).
- Password hash (bcrypt — your password is never stored in plaintext).
- Session key — a rotating token that invalidates all active sessions on logout, password change, or admin action.
- Encrypted Master Key — a randomly generated per-user key, encrypted with a key derived from your password via scrypt and AES-256-CBC. We cannot decrypt this without your password.
- Encrypted Recovery Phrase data — your recovery phrase is hashed (SHA-256 then bcrypt) and never stored in plaintext.
- RSA key pair — a per-user key pair. The public key is stored unencrypted; the private key is encrypted with your Master Key via AES-256-CBC.

We do not collect your real name, phone number, date of birth, or any other identifying information. Registration requires only a valid invitation code.

#### 3.2 Session Data
Upon login, your decrypted Master Key is temporarily stored in Redis (an in-memory store) for up to 24 hours. This allows dashboard features to access your encrypted content without repeatedly asking for your password. This entry is immediately deleted upon:
- Logout
- Password change
- Session token rotation
- Administrative action (forced logout, lock, ban)

Access tokens and refresh tokens are JWTs containing a session key. Once the session key is rotated, all previously issued tokens are immediately invalidated.

#### 3.3 File Upload Data
When you upload a file:
- Your file is encrypted client-side before transmission. Only the encrypted blob reaches our servers.
- The encrypted blob is stored in MinIO object storage (Files bucket).
- File metadata (filename, size, expiry date, MIME type) is stored in MariaDB.
- A file encryption key is generated per file, then encrypted with your Master Key, and stored in MariaDB. We cannot access your file contents without your Master Key.
- Temporary upload metadata is stored in Redis for up to 24 hours during multi-part uploads and deleted upon completion.

**Default retention:** Files expire automatically 30 days after upload. Expired files are deleted hourly by an automated job, and immediately upon access after expiry.

#### 3.4 Pastebin Data
Text pastes are stored as encrypted blobs in MariaDB. A per-paste encryption key is generated, encrypted with your Master Key, and stored alongside the paste. We cannot read your paste contents.

**Default retention:** Pastes expire after 30 days by default, though shorter or indefinite durations may be selected. Expired pastes are deleted hourly and on-demand upon access.

#### 3.5 Email Data
Incoming emails are processed as follows:
- Mail is routed via Cloudflare Email Routing before reaching our server. This means email metadata (sender, recipient, timestamps) passes through Cloudflare's infrastructure. Please refer to Cloudflare's Privacy Policy for details on their data handling.
- Upon receipt, a random symmetric Mail Key is generated per email. The mail body and attachments are encrypted with this key via AES-256-CBC and stored in MinIO (Mails bucket).
- The Mail Key is then encrypted with your RSA public key and stored in MariaDB. Only you — holding your private key, which is encrypted with your Master Key — can decrypt your emails.
- Mail metadata (sender, subject, timestamps, read status) is stored in MariaDB.
- A storage quota of 500 MB applies per user.

**Retention:** Emails have no automatic expiry date in the current implementation. They persist until you delete them or your account is deleted.

#### 3.6 Short Links
Short links created via the Service are stored in MariaDB. They are not subject to automatic deletion and persist until your account is deleted or an administrator removes them.

#### 3.7 Reports
When content is reported via the platform:
- The report record (reported URL, report timestamp, status) is stored in MariaDB.
- Report passwords are encrypted with AES-256-GCM under an application-level secret. They are not hashed, meaning they can be decrypted by the system for report verification purposes.
- Reports are not automatically deleted. They remain in an open or archived state.

Upon receiving a report, we may access the content of the reported file or paste to the extent necessary to investigate the alleged violation — and only for that purpose. See Section 6 (Content Access) for details.

### 4. Data Storage and Security

#### 4.1 Infrastructure
All data is stored on privately owned hardware (a home server operated by the redbox team). We do not use commercial cloud providers for primary data storage. The server runs Linux with Docker containerization. The following storage systems are used:

| Component | Description |
| :--- | :--- |
| **MariaDB** | Primary relational database — stores all structured data (accounts, metadata, mail keys, reports, audit logs). |
| **Redis** | In-memory, volatile store — used only for short-lived session state (decrypted Master Key, upload state). Not used for long-term storage. |
| **MinIO / S3** | Object storage — stores encrypted file blobs and encrypted mail bodies/attachments. |

#### 4.2 Encryption Architecture
redbox is designed around end-to-end encryption principles for user content:
- Each user has a randomly generated Master Key, encrypted with a scrypt-derived key from their password (AES-256-CBC). We cannot access your Master Key without your password.
- Files are encrypted client-side before upload. File keys are encrypted with your Master Key server-side.
- Pastes are stored as encrypted blobs; paste keys are encrypted with your Master Key.
- Emails are encrypted server-side per-message using a random Mail Key, which is then encrypted with your RSA public key. Only you can decrypt it using your private key, which is protected by your Master Key.
- Your RSA private key is encrypted with your Master Key (AES-256-CBC) and never stored or transmitted in plaintext.

In practice, this means that even the redbox team cannot read your files, pastes, or emails under normal operating conditions.

### 5. Data Sharing and Third Parties
We do not sell, rent, or share your personal data with third parties for commercial purposes. The following limited interactions with third-party infrastructure exist:
- Cloudflare Email Routing: Incoming emails pass through Cloudflare's routing infrastructure before reaching our server. Cloudflare may process email metadata (sender, recipient, timestamps). We recommend reviewing Cloudflare's Privacy Policy at cloudflare.com/privacypolicy.

No advertising networks, analytics services, tracking pixels, or other third-party scripts are embedded in the platform.

### 6. Content Access Upon Reports
User-generated content — including uploaded files and pastebin entries — shall remain inaccessible to the redbox project team except where such content has been reported as being in violation of the Terms of Service or where access is required to comply with applicable law.

Specifically, the redbox team reserves the right to access the content of uploaded files and pastebin entries where such content has been the subject of a report alleging a violation of the Terms of Service, or where access is otherwise required by applicable law or a binding court order. Such access shall be limited to the minimum extent necessary to investigate the report or comply with the legal obligation.

Given the encryption architecture described in Section 4.2, access to encrypted content by the redbox team may require technical measures beyond normal operation and may not always be technically feasible.

### 7. Data Retention
The following retention periods apply:

| Data Type | Retention Policy |
| :--- | :--- |
| **Files** | Deleted 30 days after upload (hourly cron + on-demand). Customizable at upload time. |
| **Pastes (Bins)** | Deleted 30 days after creation by default (hourly cron + on-demand). Duration customizable. |
| **Emails** | No automatic expiry. Persist until user deletion or manual removal. |
| **Short Links** | No automatic expiry. Persist until account deletion or manual removal. |
| **Session (Redis)** | Master Key cached for 24 hours. Deleted immediately on logout/lock/ban. |
| **Reports** | No automatic expiry. Retained until resolved or archived. |
| **Audit Logs** | No automatic expiry in current implementation. |
| **Account Record** | On deletion: content is removed; account record is set to DELETED status but not fully purged (see Section 8). |

### 8. Account Deletion

#### 8.1 User-Initiated Deletion
When you request deletion of your account:
- Your account is immediately set to PENDING status and all active sessions are invalidated.
- A 7-day grace period begins, during which you may cancel the deletion request.
- After 7 days, the deletion is finalized automatically by a scheduled process.

#### 8.2 What Is Deleted
Upon final deletion, the following content is removed:
- All files and mail objects from MinIO object storage.
- All database records for: files, pastes, links, emails, blocked senders.

#### 8.3 What Is Retained
**Important limitation:** The account record itself is not physically removed from the database. It is set to DELETED status. The following fields are retained in the database record: username, password hash, encrypted Master Key data, recovery hash, and RSA key material.

This is a technical limitation of the current implementation. We acknowledge that this falls short of full cryptographic erasure. We intend to address this in future versions of the platform.

Additionally, your username may appear in Admin Audit Logs referencing historical administrative actions. These logs are not automatically deleted.

### 9. Account Restrictions (Lock and Ban)
If your account is locked or banned, the following occurs:
- All active sessions are terminated immediately.
- Your decrypted Master Key is removed from Redis.
- All invite codes associated with your account are deactivated.
- A restriction record (reason, date, optional expiry) is stored in MariaDB.

A lock or ban does not delete your content. Files, pastes, links, and emails remain stored until the restriction is lifted or your account is deleted.

Temporary bans are automatically lifted upon expiry (checked hourly). Locks have no automatic expiry and must be manually lifted by an administrator.

### 10. Your Rights
Depending on your jurisdiction, you may have the following rights with respect to your personal data:
- Right of access — You may request a copy of the personal data we hold about you.
- Right to rectification — You may request correction of inaccurate data.
- Right to erasure — You may request deletion of your account and associated data (subject to the limitations described in Section 8.3).
- Right to restriction of processing — You may request that we limit how we use your data.
- Right to data portability — You may request your data in a machine-readable format where technically feasible.
- Right to object — You may object to processing based on legitimate interests.

To exercise any of these rights, please contact us at contact@redbox.cx. We will respond within 30 days. Note that some rights may be limited by technical constraints inherent in our encryption architecture (e.g., we cannot decrypt your content to provide it in plaintext).

If you are based in the European Economic Area, you also have the right to lodge a complaint with your local data protection supervisory authority. Users in Switzerland may contact the Federal Data Protection and Information Commissioner (FDPIC) at edoeb.admin.ch.

### 11. Cookies and Tracking
redbox does not use advertising cookies, tracking pixels, or third-party analytics. The platform may use technically necessary session cookies to maintain your login state. No data is shared with advertising networks.

### 12. Children's Privacy
The Service is not directed at children under the age of 13. Users between 13 and 18 years of age require parental or legal guardian consent. We do not knowingly collect personal data from children under 13. If we become aware that a user under 13 has registered without consent, we will delete the account and associated data.

### 13. Changes to This Policy
We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal obligations. When we do, the effective date at the top of this document will be updated and, where possible, active users will be notified. Continued use of the Service after any update constitutes your acceptance of the revised policy.

### 14. Contact and Data Protection Inquiries
For all privacy-related inquiries, requests, or concerns, please contact:
- Email: contact@redbox.cx
- Website: redbox.cx

We are committed to resolving any concerns promptly and transparently.

*redbox — privacy by design, not by policy.*