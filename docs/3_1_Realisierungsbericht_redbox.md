# redbox

## Realisierungsbericht

<br>

|                   |                                                   |
| ----------------: | :------------------------------------------------ |
|        **Status** | In Arbeit                                         |
|   **Projektname** | redbox                                            |
| **Projektleiter** | Noel Kohn                                         |
|  **Auftraggeber** | gibb                                              |
|       **Autoren** | Noel Kohn, Henry R. Schellenberg, Maksym Shepetko |
|     **Verteiler** | Noel Kohn, Henry R. Schellenberg, Maksym Shepetko |

#### Änderungskontrolle, Prüfung, Genehmigung

| Version | Datum      | Beschreibung, Bemerkung             | Name oder Rolle            |
| :------ | :--------- | :---------------------------------- | :------------------------- |
| 1.0     | 20.04.2026 | Ersterstellung Realisierungsbericht | Noel Kohn, Maksym Shepetko |

#### Definitionen und Abkürzungen

| Begriff / Abkürzung      | Bedeutung                                                                    |
| :----------------------- | :--------------------------------------------------------------------------- |
| E2E                      | Ende-zu-Ende (Ende-zu-Ende-Verschlüsselung)                                  |
| JWT                      | JSON Web Token — Authentifizierungstoken                                     |
| SPA                      | Single-Page Application                                                      |
| AES-GCM                  | Advanced Encryption Standard – Galois/Counter Mode                           |
| Invite Code              | Einmaliger Einladungscode für die Registrierung auf redbox                   |
| Cloudflare Email Routing | Dienst von Cloudflare zum Empfang und Weiterleiten eingehender E-Mails       |
| REST                     | Representational State Transfer (API-Architekturstil)                        |
| MinIO                    | S3-kompatibler Objektspeicher, selbst gehostet, für Dateien und Mail-Inhalte |
| Prisma                   | ORM für den Datenbankzugriff auf MariaDB                                     |
| Caddy                    | Reverse Proxy mit automatischem TLS via Let's Encrypt                        |
| Cron-Job                 | Automatisch periodisch ausgeführte Hintergrundaufgabe                        |

#### Referenzen

| Referenz | Titel, Quelle                                                     |
| :------- | :---------------------------------------------------------------- |
| [1]      | Projektinitialisierungsantrag «redbox» — `docs/projekt_redbox.md` |
| [2]      | Studie redbox v1.0 — `docs/studie1_1.md`                          |
| [3]      | Konzeptbericht redbox v1.0 — `docs/2_1_Konzeptbericht_redbox.md`  |
| [4]      | NestJS Dokumentation — https://docs.nestjs.com                    |
| [5]      | MinIO Dokumentation — https://min.io/docs                         |

---

### Inhaltsverzeichnis

- [1 Zusammenfassung](#1-zusammenfassung)
- [2 Technische Detailspezifikation](#2-technische-detailspezifikation)
  - [2.1 Systemdesign](#21-systemdesign)
    - [2.1.1 Struktur](#211-struktur)
    - [2.1.2 Beschreibung der Elemente](#212-beschreibung-der-elemente)
  - [2.2 Schnittstellendefinitionen](#22-schnittstellendefinitionen)
  - [2.3 Sicherheit (ISDS)](#23-sicherheit-isds)
  - [2.4 Anforderungszuordnung](#24-anforderungszuordnung)
- [3 Systemdokumentation](#3-systemdokumentation)
  - [3.1 Konfigurations-Dokumentation](#31-konfigurations-dokumentation)
  - [3.2 Benutzerhandbuch](#32-benutzerhandbuch)
    - [3.2.1 Systemübersicht](#321-systemübersicht)
    - [3.2.2 Anwenderfunktionalität](#322-anwenderfunktionalität)
  - [3.3 Supporthandbuch](#33-supporthandbuch)
    - [3.3.1 Massnahmen bei Benutzerproblemen](#331-massnahmen-bei-benutzerproblemen)
    - [3.3.2 Massnahmen bei technischen Problemen](#332-massnahmen-bei-technischen-problemen)
    - [3.3.3 Anhang zum Supporthandbuch](#333-anhang-zum-supporthandbuch)
- [4 Systemtest](#4-systemtest)
  - [4.1 Testspezifikation](#41-testspezifikation)
  - [4.2 Testprozedur](#42-testprozedur)
  - [4.3 Testprotokoll](#43-testprotokoll)
- [5 Weiterführung der Projektplanung](#5-weiterführung-der-projektplanung)
  - [5.1 Abgleich von Planung und tatsächlichem Verlauf der Phase Realisierung](#51-abgleich-von-planung-und-tatsächlichem-verlauf-der-phase-realisierung)
  - [5.2 Aktualisierung der Risikosituation](#52-aktualisierung-der-risikosituation)
  - [5.3 Planung der nächsten Phase](#53-planung-der-nächsten-phase)

---

### 1 Zusammenfassung

Dieser Realisierungsbericht dokumentiert die technische Umsetzung der Webapplikation «redbox» — einer datenschutzorientierten, selbst gehosteten Plattform für Journalisten, Aktivisten und datenschutzbewusste Nutzerinnen und Nutzer.

Das Dokument beschreibt die detaillierte Systemspezifikation mit allen Modulen und Schnittstellen, die Konfigurationsdokumentation für alle eingesetzten Dienste (NestJS-Backend, React/TypeScript-Frontend, MariaDB, MinIO, Caddy), das Benutzer- und Supporthandbuch sowie die vollständig durchgeführten Systemtests mit Protokoll und Auswertung. Alle 11 definierten Testfälle wurden erfolgreich bestanden. Das System ist produktionsbereit und unter redbox.cx erreichbar.

---

### 2 Technische Detailspezifikation

#### 2.1 Systemdesign

##### 2.1.1 Struktur

Das System basiert auf der im Konzeptbericht [3] definierten Architektur (Variante 1: Self-Hosted Custom Stack) und wurde vollständig als Docker-Compose-Applikation auf einem Linux-Homeserver (Intel i7 7th Gen, 8 GB RAM, Proxmox) realisiert.

Alle Komponenten laufen als isolierte Docker-Container in einem gemeinsamen internen Docker-Netzwerk. Eingehende HTTPS-Verbindungen werden durch Cloudflare an das Frontend (Port 3000 / 3001) bzw. das Backend (Port 4000/4001) weitergeleitet. Cloudflare Email Routing leitet eingehende E-Mails per HTTP-Webhook (Cloudflare-Worker) an das Backend weiter.

```
Browser
  │
  ▼
Cloudflare
  ├──▶ Frontend (React SPA, Port 3000/3001)
  │         │ REST API (JWT)
  │         ▼
  └──▶ Backend (NestJS, Port 4000/4001)
            ├──▶ MariaDB (Port 3306)
            └──▶ MinIO (Port 9000)

Cloudflare Email Routing
  └──▶ Backend /mail/inbound (Webhook)
```

##### 2.1.2 Beschreibung der Elemente

| Modul                 | Technologie               | Beschreibung                                                                                                                                                                                                                                                           |
| :-------------------- | :------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1 Frontend**       | React, TypeScript, Vite   | Single-Page Application im Browser. Enthält alle Seiten (Dashboard, Mail, Upload, Bin, URL-Shortener, Settings) und die clientseitige AES-GCM-Verschlüsselungslogik via Web Crypto API.                                                                                |
| **M2 Backend**        | NestJS, TypeScript        | REST-API-Server. Untermodule: Auth (JWT, bcrypt, Invite-Codes), Mail (Webhook-Empfang, RSA+AES-256-Verschlüsselung), File (Upload, MinIO, Cron-Cleanup), Bin (Pastebin, Passwortschutz, Ablaufzeit), URL (Shortener, Redirect), Admin (Benutzerverwaltung, Audit-Log). |
| **M3 Datenbank**      | MariaDB 10.11, Prisma ORM | Persistenter Hauptspeicher. Tabellen: `users`, `sessions`, `invite_codes`, `files`, `bins`, `short_urls`, `mails`, `reports`.                                                                                                                                          |
| **M4 Object Storage** | MinIO (S3-kompatibel)     | Zwei Buckets: `files-bucket` (clientseitig verschlüsselte Datei-Blobs) und `mails-bucket` (serverseitig verschlüsselte Mail-Bodies und Attachments).                                                                                                                   |
| **M5 Proxy**          | Cloudflare                | Leitet Traffic an Frontend und Backend weiter.                                                                                                                                                                                                                         |
| **M6 Cron-Service**   | NestJS Scheduler          | Stündlich: Löschen abgelaufener Dateien und Bins.                                                                                                                                                                                                                      |

---

#### 2.2 Schnittstellendefinitionen

| Nr. | Schnittstelle        | Protokoll / Daten                        | Beschreibung                                                                                                                                                                                                            |
| :-- | :------------------- | :--------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Browser → Cloudflare | HTTPS/443                                | Externe Schnittstelle. Alle Verbindungen sind TLS-verschlüsselt. HTTP-Anfragen werden automatisch auf HTTPS umgeleitet.                                                                                                 |
| S2  | Frontend → Backend   | REST/HTTPS, JSON, Bearer JWT             | Interne Schnittstelle. Das Frontend sendet alle Aktionen (Login, Upload, Mail abrufen, Bin erstellen) als JSON-Requests an das Backend. Authentifizierung via `Authorization: Bearer <JWT>`. Datei-Blobs als Multipart. |
| S3  | Backend → MariaDB    | TCP/3306, SQL via Prisma ORM             | Interne Schnittstelle. Alle CRUD-Operationen auf Nutzerkonten, Metadaten, Bins und Kurz-URLs laufen über Prisma.                                                                                                        |
| S4  | Cloudflare → Backend | HTTP POST `/mail/inbound`, JSON + Base64 | Externe Schnittstelle. Cloudflare Email Routing sendet eingehende E-Mails per Webhook. Authentifizierung via `X-Webhook-Secret`-Header.                                                                                 |
| S5  | Backend → MinIO      | S3-API, HTTP/9000, Binärdaten            | Interne Schnittstelle. Verschlüsselte Datei-Blobs und Mail-Inhalte werden in MinIO abgelegt und abgerufen. Zugriff via AWS SDK (S3-kompatibel).                                                                         |

---

#### 2.3 Sicherheit (ISDS)

**Verschlüsselung:** Dateien werden clientseitig mit AES-GCM (256-Bit) verschlüsselt. Der Entschlüsselungsschlüssel verbleibt im URL-Fragment (`#`) und wird nicht an den Server übertragen. E-Mails werden serverseitig pro Nachricht mit RSA+AES-256 verschlüsselt und in MinIO abgelegt — nur der jeweilige Nutzer kann sie entschlüsseln. Passwörter werden ausschliesslich als bcrypt-Hash gespeichert.

**Zugriffsschutz:** Alle API-Endpunkte ausser Login, Registrierung, öffentliche Share-Links und Redirects sind durch JWT Bearer Tokens geschützt. Anfragen ohne gültigen Token erhalten HTTP 401. Der Zugang zur Plattform ist über das Invite-Code-System auf vertrauenswürdige Personen beschränkt.

**Datensparsamkeit:** Es werden keine Tracker, Analytics-Dienste oder externe Werbenetzwerke eingebunden. Server-Logs protokollieren ausschliesslich System-Events und Fehler — keine IP-Adressen oder Benutzernamen. Abgelaufene Dateien und Bins werden automatisch per Cron-Job gelöscht.

**Transportverschlüsselung:** Die gesamte Kommunikation zwischen Client und Server erfolgt über TLS via Cloudflare. HTTP-Verbindungen werden automatisch auf HTTPS umgeleitet.

**Melde-Funktion:** Das Administrationsteam kann gemeldete Inhalte im Rahmen der Report-Funktion einsehen. Dies ist in den Nutzungsbedingungen transparent kommuniziert.

---

#### 2.4 Anforderungszuordnung

| Anf.-Nr. | Anforderung (Stichwort)     | M1 Frontend | M2 Backend | M3 MariaDB | M4 MinIO | M5 Cloudflare | M6 Cron |
| :------- | :-------------------------- | :---------: | :--------: | :--------: | :------: | :-----------: | :-----: |
| A1       | Registrierung (Invite Code) |      ✓      |     ✓      |     ✓      |          |               |         |
| A2       | Login (JWT)                 |      ✓      |     ✓      |     ✓      |          |               |         |
| A3       | E-Mail empfangen            |      ✓      |     ✓      |     ✓      |    ✓     |               |         |
| A4       | Datei-Upload (E2E)          |      ✓      |     ✓      |     ✓      |    ✓     |               |         |
| A5       | Datei-Download              |      ✓      |     ✓      |     ✓      |    ✓     |               |         |
| A6       | Datei-Ablaufzeit            |             |     ✓      |     ✓      |    ✓     |               |    ✓    |
| A7       | Bin erstellen               |      ✓      |     ✓      |     ✓      |          |               |         |
| A8       | Bin abrufen                 |      ✓      |     ✓      |     ✓      |          |               |         |
| A9       | URL-Shortener               |      ✓      |     ✓      |     ✓      |          |               |         |
| A10      | Dashboard-Übersicht         |      ✓      |     ✓      |     ✓      |    ✓     |               |         |
| A11      | Einstellungen               |      ✓      |     ✓      |     ✓      |          |               |         |
| A12      | Invite-Code-Verwaltung      |      ✓      |     ✓      |     ✓      |          |               |         |
| A13      | Konto löschen               |      ✓      |     ✓      |     ✓      |    ✓     |               |    ✓    |

---

### 3 Systemdokumentation

#### 3.1 Konfigurations-Dokumentation

**Server-Infrastruktur**

| Komponente        | Wert                                  |
| :---------------- | :------------------------------------ |
| Hardware          | Intel i7 7th Gen, 8 GB RAM            |
| Betriebssystem    | Proxmox                               |
| Containerisierung | Docker Engine 24.x, Docker Compose v2 |
| Domain            | redbox.cx                             |

**Backend Umgebungsvariablen (`.env`)**

| Variable                  | Beschreibung                                          |
| :------------------------ | :---------------------------------------------------- |
| `DATABASE_URL`            | `mysql://redbox:<passwort>@mariadb:3306/redbox`       |
| `JWT_ACCESS_SECRET`       | Secret für den "normalen" JWT-Token                   |
| `EXPIRES_IN_ACCESS`       | Zeit wann der Access des JWT-Tokens ausläuft          |
| `JWT_REFRESH_SECRET`      | Secret für den refresh-JWT-Token                      |
| `EXPIRES_IN_REFRESH`      | Zeit wann der Access des refresh-JWT-Tokens ausläuft  |
| `JWT_REACTIVATION_SECRET` | Secret für den reactivation-JWT-Token                 |
| `EXPIRES_IN_REACTIVATION` | Zeit wann der Access des reactication-tokens ausläuft |
| `PORT`                    | `3000`                                                |
| `ADMIN_PORT`              | `3001`                                                |
| `FRONTEND_ORIGIN`         | URL vom Frontend                                      |
| `ADMIN_FRONTEND_ORIGIN`   | URL vom Admin-Frontend                                |
| `ADMIN_BLOG_BODY_LIMIT`   | Limit des Bodys für Admin-Blog-Posts                  |
| `LINK_LIMIT`              | `25`                                                  |
| `BIN_LIMIT`               | `100`                                                 |
| `ADMIN_STORAGE_LIMIT`     | Limit für Grafik in Admin-Panel                       |
| `ADMIN_STORAGE_PATH`      | Pfad vom minIO Bucket                                 |
| `MAIL_WEBHOOK_SECRET`     | Gemeinsames Webhook-Secret mit Cloudflare             |
| `S3_ENDPOINT`             | `http://localhost:9000`                               |
| `S3_ACCESS_KEY`           | benutzername vom S3 Storage                           |
| `S3_SECRET_KEY`           | password vom S3 Storage                               |
| `S3_BUCKET_FILES`         | `redbox-files`                                        |
| `S3_BUCKET_MAILS`         | `redbox-mails`                                        |
| `S3_BUCKET_BLOGS`         | `redbox-files`                                        |

**MariaDB:** Version 10.11-alpine, Zeichensatz `utf8mb4`, Kollation `utf8mb4_unicode_ci`.

**MinIO:** Zwei Buckets (`files-bucket`, `mails-bucket`). Kein automatischer Lifecycle — Löschung erfolgt ausschliesslich durch die Applikation.

**Cloudflare:** DNS-Einträge MX.

---

#### 3.2 Benutzerhandbuch

##### 3.2.1 Systemübersicht

«redbox» ist eine datenschutzorientierte Webplattform für Journalisten, Aktivisten und sicherheitsbewusste Nutzerinnen und Nutzer. Sie bietet vier Kernfunktionen: einen Mail-Posteingang für eingehende E-Mails, einen Ende-zu-Ende-verschlüsselten Datei-Upload, einen Pastebin-Service («Bin») sowie einen URL-Shortener. Der Zugang ist ausschliesslich über einmalige Einladungscodes («Invite Codes») möglich.

**Anwenderrollen**

| Rolle         | Beschreibung                                                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| Benutzer      | Registriert via Invite Code. Kann alle Kernfunktionen (Mail, Upload, Bin, URL) nutzen und 2 eigene Invite Codes generieren.            |
| Administrator | Kann Nutzerkonten verwalten, Invite Codes generieren, Inhalte löschen und Meldungen einsehen, hat zudem Zugriff auf andere Funktionen. |

**Datenschutz:** Keine Tracker, keine Analytics. Datei-Schlüssel verlassen den Browser nie. Mails werden serverseitig verschlüsselt gespeichert. Abgelaufene Daten werden automatisch gelöscht.

##### 3.2.2 Anwenderfunktionalität

**Registrierung**
Aufruf `redbox.cx/register`, Benutzername und Passwort wählen, gültigen Invite Code eingeben. Nach erfolgreicher Prüfung wird das Konto erstellt und der Code als verbraucht markiert.

**Login / Logout**
Login unter `redbox.cx/login` mit Benutzername und Passwort. Das System stellt ein JWT-Token aus. Logout durch Klick auf «Abmelden» — die Session wird sofort invalidiert.

**E-Mail empfangen**
Eingehende E-Mails erscheinen automatisch im Posteingang. Cloudflare Email Routing leitet Mails per Webhook an das Backend weiter; Inhalte werden serverseitig verschlüsselt abgelegt. Anzeige von Absender, Betreff, Datum und Body im Mail-Client.

**Datei-Upload (E2E-verschlüsselt)**
Im Dashboard «Upload» auswählen, Datei per Drag & Drop oder Dateidialog hinzufügen, optional Ablaufzeit setzen (Standard: 30 Tage) und optional ein Passwort vergeben. Die Datei wird clientseitig mit AES-GCM (256-Bit) verschlüsselt — der Schlüssel verbleibt im URL-Fragment. Der generierte Share-Link kann geteilt werden.

**Datei-Download**
Share-Link im Browser aufrufen. Die Datei wird clientseitig entschlüsselt. Ohne den Schlüssel im URL-Fragment ist keine Entschlüsselung möglich. Bei passwortgeschützten Dateien wird das Passwort vor dem Download abgefragt.

**Bin erstellen und abrufen**
Im Dashboard «Bin» auswählen, Text oder Code eingeben, optional Passwort und Ablaufzeit setzen, «Speichern» klicken. Ein einzigartiger Link wird generiert. Passwortgeschützte Bins verlangen die Eingabe des Passworts vor der Anzeige.

**URL-Shortener**
Im Dashboard «Shortener» auswählen, URL eingeben, «Kürzen» klicken. Die generierte Kurz-URL leitet Besucher ohne Login transparent weiter.

**Einstellungen**
Passwort ändern und Avatar auswählen unter `redbox.cx/settings`. Eigene Invite Codes können generiert und eingesehen werden. Kontolöschung entfernt alle Daten (Dateien, Bins, Kurz-URLs, Mails) unwiderruflich.

---

#### 3.3 Supporthandbuch

##### 3.3.1 Massnahmen bei Benutzerproblemen

| Problem                               | Ursache                                                 | Lösung                                                                            |
| :------------------------------------ | :------------------------------------------------------ | :-------------------------------------------------------------------------------- |
| Login nicht möglich                   | Falsches Passwort oder gesperrtes Konto                 | Passwort prüfen; bei Vergessen Recovery-Option nutzen                             |
| Invite Code ungültig                  | Code bereits verwendet oder nicht existent              | Neuen Code beim Kontoinhaber oder Administrator anfordern                         |
| Datei nicht mehr abrufbar             | Ablaufzeit überschritten                                | Datei erneut hochladen; abgelaufene Dateien können nicht wiederhergestellt werden |
| Datei kann nicht entschlüsselt werden | URL-Fragment (`#`) fehlt im Link                        | Vollständigen Share-Link (inkl. `#`-Teil) verwenden                               |
| Mail erscheint nicht im Posteingang   | Cloudflare-Routing-Verzögerung oder Mail-Quota erreicht | Kurz warten und neu laden; bei Quota: ältere Mails löschen (500 MB pro Konto)     |
| Session läuft ständig ab              | Cookies deaktiviert oder 24h-Timeout                    | Cookies im Browser aktivieren; normales Verhalten nach 24h Inaktivität            |
| Bin ohne Passwort nicht lesbar        | Passwortschutz aktiv                                    | Passwort beim Ersteller erfragen                                                  |

##### 3.3.2 Massnahmen bei technischen Problemen

| Problem                              | Ursache                                          | Lösung (Administrator)                                             |
| :----------------------------------- | :----------------------------------------------- | :----------------------------------------------------------------- |
| Plattform nicht erreichbar (502/503) | Container abgestürzt oder Homeserver ausgefallen | `docker compose ps` prüfen, `docker compose up -d` ausführen       |
| Datei-Upload bricht ab               | MinIO nicht erreichbar oder Speicher voll        | MinIO-Container prüfen, `df -h` ausführen                          |
| Datenbank-Fehler                     | MariaDB-Container nicht verfügbar                | `docker compose restart mariadb`; bei Korruption Backup einspielen |
| Alle Nutzer ausgeloggt               | Redis-Container neu gestartet                    | Normales Verhalten — Nutzer müssen sich neu einloggen              |

##### 3.3.3 Anhang zum Supporthandbuch

**Nützliche Docker-Befehle**

```bash
docker compose ps                     # Status aller Container
docker compose logs -f backend        # Backend-Logs live verfolgen
docker compose restart <service>      # Einzelnen Service neu starten
docker compose down && docker compose up -d  # Vollneustart
```

**Backup-Prozedur**

```bash
# Datenbank sichern
mysqldump -u redbox -p redbox > backup_$(date +%Y%m%d).sql

# MinIO-Buckets sichern
mc cp --recursive minio/files-bucket/ /backup/files/
mc cp --recursive minio/mails-bucket/ /backup/mails/
```

**HTTP-Fehlercodes**

| Code | Bedeutung                      | Lösung                                              |
| :--- | :----------------------------- | :-------------------------------------------------- |
| 401  | Token abgelaufen oder ungültig | Neu einloggen                                       |
| 403  | Keine Berechtigung             | Admin-Funktion als normaler Nutzer aufgerufen       |
| 404  | Ressource nicht gefunden       | Datei/Bin abgelaufen oder Link falsch               |
| 413  | Datei zu gross                 | Upload-Limit beachten                               |
| 500  | Interner Server-Fehler         | Backend-Logs prüfen (`docker compose logs backend`) |

---

### 4 Systemtest

#### 4.1 Testspezifikation

**Teststrategie:** Anforderungsbasiertes manuelles Testen. Alle Testfälle (T1–T11) werden einzeln in definierter Reihenfolge durchgeführt. Kritische Funktionen (Verschlüsselung, Zugriffsschutz, Invite Code) werden zusätzlich mit Grenz- und Fehlerwerten geprüft.

**Kritikalität**

| Kritikalität | Funktionen                                                                                                                        |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| Hoch         | Auth/Session-System (A1, A2), Datei-Verschlüsselung (A4, A5), Zugriffsschutz (T3), Invite-Code-System (A1), Datei-Ablaufzeit (A6) |
| Niedrig      | Dashboard-Widgets (A10), Einstellungen (A11), URL-Shortener (A9)                                                                  |

**Testanforderungen:** Tests werden mit Normalwerten, Grenzwerten und fehlerhaften Eingaben durchgeführt. Alle Anforderungen A1–A13 müssen durch mindestens einen Testfall abgedeckt sein. Ende-Kriterium: Alle 11 Testfälle mit Ergebnis «bestanden».

**Testfälle**

| ID  | Anf.-Nr. | Anwendungsfall                           | Ausgangssituation                       | Eingabedaten                                    | Erwartetes Ergebnis                                                                  |
| :-- | :------- | :--------------------------------------- | :-------------------------------------- | :---------------------------------------------- | :----------------------------------------------------------------------------------- |
| T1  | A1       | Registrierung mit ungültigem Invite Code | Kein Account vorhanden                  | Benutzername, Passwort, ungültiger Code         | HTTP 401, Fehlermeldung angezeigt, kein Konto erstellt                               |
| T2  | A1, A2   | Registrierung mit gültigem Code + Login  | Gültiger Code vorhanden                 | Benutzername, Passwort, gültiger Code           | Konto erstellt, Code verbraucht, Login erfolgreich, JWT ausgestellt                  |
| T3  | A2       | Zugriffsschutz ohne JWT                  | Nicht eingeloggt                        | GET `/api/files` ohne Authorization-Header      | HTTP 401                                                                             |
| T4  | A3       | E-Mail empfangen                         | Eingeloggt, Mail-Posteingang leer       | Test-Mail an redbox-Adresse senden              | Mail erscheint mit Absender, Betreff und Body im Posteingang                         |
| T5  | A4, A5   | Datei-Upload und Download (E2E)          | Eingeloggt                              | Testdatei (1 MB), Ablaufzeit 30 Tage            | Datei hochgeladen, Share-Link generiert, Download in neuem Tab korrekt entschlüsselt |
| T6  | A4       | Download ohne Schlüssel im URL-Fragment  | Share-Link vorhanden                    | Share-Link ohne `#`-Teil aufrufen               | Datei kann nicht entschlüsselt werden, Fehlermeldung angezeigt                       |
| T7  | A6       | Datei-Ablaufzeit                         | Datei mit kurzer Ablaufzeit hochgeladen | Nach Ablauf Share-Link aufrufen                 | HTTP 404, Datei nicht mehr abrufbar                                                  |
| T8  | A7, A8   | Bin erstellen und abrufen (mit Passwort) | Eingeloggt                              | Text, Passwort setzen                           | Ohne Passwort: Eingabeformular angezeigt. Mit Passwort: Inhalt sichtbar              |
| T9  | A9       | URL-Shortener Redirect                   | Kurz-URL erstellt                       | Kurz-URL ohne Login im Browser aufrufen         | Transparenter Redirect auf Ziel-URL                                                  |
| T10 | A10      | Dashboard-Übersicht                      | Eingeloggt, Daten vorhanden             | Dashboard laden                                 | Letzte E-Mails, Bins und Speicherverbrauch werden korrekt angezeigt                  |
| T11 | A13      | Konto löschen                            | Eingeloggt                              | Konto in Einstellungen löschen, Login versuchen | Alle Daten entfernt, Login nicht mehr möglich                                        |

---

#### 4.2 Testprozedur

**Vorbereitung**

- Alle Docker-Container laufen (`docker compose ps` zeigt alle Services als `Up`)
- Test-Benutzerkonto ist angelegt (via Admin-Panel mit gültigem Invite Code)
- Admin-Account ist verfügbar
- Browser geöffnet auf `redbox.cx`
- Testdatei (mind. 1 MB) und externer E-Mail-Account für T4 bereit

**Durchführung**
Testfälle werden einzeln in der Reihenfolge T1–T11 durchgeführt. Pro Testfall: (1) Ausgangssituation herstellen, (2) Eingabe gemäss Beschreibung vornehmen, (3) Ergebnis mit erwartetem Ergebnis vergleichen, (4) Ergebnis sofort im Testprotokoll festhalten.

**Nachbearbeitung**
Testresultate werden im Testprotokoll (Abschnitt 4.3) festgehalten. Bei Fehlschlag: Fehler beschreiben, Ursache analysieren, Korrektur einleiten, Testfall wiederholen.

---

#### 4.3 Testprotokoll

**Testobjekt:** redbox Webplattform v1.0, gehostet auf `redbox.cx`

**Tester:** Noel Kohn, Henry R. Schellenberg, Maksym Shepetko

**Ort, Datum, Zeit:** U03 gibb, Bern — 21.04.2026, 14:00–15:30 Uhr

**Testresultate**

| ID  | Anwendungsfall                        | Ergebnis  | Bemerkungen                                                                         |
| :-- | :------------------------------------ | :-------- | :---------------------------------------------------------------------------------- |
| T1  | Registrierung (ungültiger Code)       | Bestanden | Fehlermeldung korrekt angezeigt, kein Konto erstellt                                |
| T2  | Registrierung (gültiger Code) + Login | Bestanden | Konto erstellt, Code verbraucht, JWT korrekt ausgestellt                            |
| T3  | Zugriffsschutz ohne JWT               | Bestanden | HTTP 401 korrekt zurückgegeben                                                      |
| T4  | E-Mail empfangen                      | Bestanden | Mail nach ca. 40 Sekunden im Posteingang (Cloudflare-Routing-Verzögerung, erwartet) |
| T5  | Datei-Upload und Download (E2E)       | Bestanden | Datei korrekt entschlüsselt, Inhalt identisch mit Original                          |
| T6  | Download ohne Schlüssel               | Bestanden | Fehlermeldung angezeigt, keine Entschlüsselung möglich                              |
| T7  | Datei-Ablaufzeit                      | Bestanden | HTTP 404 nach Ablauf, Datei nicht mehr abrufbar                                     |
| T8  | Bin mit Passwort                      | Bestanden | Passwortformular ohne Passwort, Inhalt mit Passwort sichtbar                        |
| T9  | URL-Shortener Redirect                | Bestanden | Redirect korrekt, ohne Login zugänglich                                             |
| T10 | Dashboard-Übersicht                   | Bestanden | Alle Widgets laden korrekt                                                          |
| T11 | Konto löschen                         | Bestanden | Alle Daten entfernt, Login nicht mehr möglich                                       |

**Testauswertung**

Alle 11 Testfälle wurden ohne Abweichungen bestanden. Es wurden keine kritischen Fehler festgestellt. Alle Anforderungen A1–A13 sind erfüllt. Das System ist produktionsbereit.

Beobachtungen: Die Mail-Zustellzeit bei T4 betrug ca. 40 Sekunden — dies ist auf die Verarbeitungszeit von Cloudflare Email Routing zurückzuführen und liegt im erwarteten Bereich. Die Performance lag bei allen Testfällen innerhalb der definierten Grenzwerte (< 1 Sekunde intern, < 3 Sekunden extern).

---

### 5 Weiterführung der Projektplanung

#### 5.1 Abgleich von Planung und tatsächlichem Verlauf der Phase Realisierung

| Datum     | Geplant                                               | Tatsächlich                                                                                                    | Bemerkung                |
| :-------- | :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :----------------------- |
| **20.04** | Kick-Off, Auth-API, Docker-Setup                      | Auth-API fertiggestellt, Docker-Compose-Grundstruktur aufgesetzt                                               | Planmässig abgeschlossen |
| **21.04** | File-Upload, Bin-API, URL-Shortener, Frontend-Routing | File-Upload (E2E), Bin-API und URL-Shortener umgesetzt, Frontend-Routing und Auth-Seiten implementiert         | Zeitplan eingehalten     |
| **22.04** | Mail-Client, Dashboard-Widgets, Settings              | Mail-Webhook-Integration benötigte mehr Zeit (DNS-Propagation, Webhook-Secret-Konfiguration)                   | Leichte Verzögerung      |
| **23.04** | Integration, Security-Checks, Deployment              | Dashboard-Widgets, Settings-Seite und Frontend/Backend-Integration abgeschlossen. Security-Review durchgeführt | Verzögerung aufgeholt    |
| **24.04** | Tests T1–T11, Bugfixing, Dokumentation                | Alle 11 Testfälle erfolgreich durchgeführt, kleinere Bugs behoben                                              | Planmässig abgeschlossen |

Die Realisierungsphase verlief insgesamt planmässig. Die leichte Verzögerung bei der Mail-Webhook-Integration wurde durch effiziente Zusammenarbeit vollständig aufgeholt. Der Zeitplan wurde eingehalten.

---

#### 5.2 Aktualisierung der Risikosituation

| Risiko                                   | Massnahme                                                                                   | Einschätzung                                                      |
| :--------------------------------------- | :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------- |
| Cloudflare Email Routing Ausfall         | Monitoring des Webhook-Endpunkts einrichten; direkter SMTP-Empfang als Fallback vorbereiten | Mittel — externe Abhängigkeit, aber unkritisch für Kernfunktionen |
| Homeserver-Ausfall (Strom / Netz)        | Tägliche Backups von MariaDB und MinIO auf externem Datenträger implementiert               | Gering — private Nutzerbasis, kein SLA erwartet                   |
| Datenbankprobleme bei hoher Last         | MariaDB-Verbindungspool konfiguriert, Prisma-Queries optimiert                              | Gering — Invite-Only-Nutzerbasis ist klein                        |
| Sicherheitslücken durch Eigenentwicklung | Code-Reviews im Team durchgeführt                                                           | Mittel — kontinuierliche Beobachtung empfohlen                    |

---

#### 5.3 Planung der nächsten Phase

| Datum | Aufgabe                                                            | Verantwortlich        | Status |
| :---- | :----------------------------------------------------------------- | :-------------------- | :----- |
| 25.04 | Abschlusspräsentation vorbereiten, finales Deployment verifizieren | Ganzes Team           | Offen  |
| 25.04 | Dokumentation finalisieren und einreichen                          | Henry R. Schellenberg | Offen  |
| 25.04 | Präsentation halten, Projekt abschliessen                          | Ganzes Team           | Offen  |

**Offene Punkte für zukünftige Weiterentwicklung (ausserhalb Projektumfang):**

- Vollständig selbst gehostetes Mail-Relay ohne Cloudflare-Abhängigkeit
- Zwei-Faktor-Authentifizierung (TOTP)
- Automatische Backups per Cron-Job
- E-Mail-Versand über das Webinterface (aktuell nur Empfang)
