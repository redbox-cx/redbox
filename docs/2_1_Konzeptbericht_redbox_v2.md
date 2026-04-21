# redbox
## Konzeptbericht
<br>

| | |
| --: | :-- |
| **Status** | In Arbeit |
| **Projektname** | redbox |
| **Projektleiter** | Noel Kohn |
| **Auftraggeber** | gibb |
| **Autoren** | Noel Kohn, Henry R. Schellenberg, Maksym Shepetko |
| **Verteiler** | Noel Kohn, Henry R. Schellenberg, Maksym Shepetko |

#### Änderungskontrolle, Prüfung, Genehmigung
| Version | Datum      | Beschreibung, Bemerkung       | Name oder Rolle              |
| :------ | :--------- | :---------------------------- | :--------------------------- |
| 1.0     | 20.04.2026 | Ersterstellung Konzeptbericht | Henry R. Schellenberg        |

#### Definitionen und Abkürzungen
| Begriff / Abkürzung | Bedeutung |
| :------------------ | :-------- |
| E2E                 | Ende-zu-Ende (Ende-zu-Ende-Verschlüsselung) |
| JWT                 | JSON Web Token — Authentifizierungstoken |
| SPA                 | Single-Page Application |
| AES-GCM             | Advanced Encryption Standard |
| Invite Code         | Einmaliger Einladungscode für die Registrierung auf redbox |
| Cloudflare Email Routing | Dienst von Cloudflare zum Empfang und Weiterleiten eingehender E-Mails |
| REST                | Representational State Transfer (API-Architekturstil) |
| MinIO               | S3-kompatibler Objektspeicher, selbst gehostet, für Dateien und Mail-Inhalte |
| Prisma              | ORM für den Datenbankzugriff auf MariaDB |

#### Referenzen
| Referenz | Titel, Quelle |
| :------- | :------------ |
| [1]      | Projektinitialisierungsantrag «redbox» — `docs/projekt_redbox.md` |
| [2]      | Studie redbox v1.0 — `docs/studie1_1.md` |
| [3]      | NestJS Dokumentation — https://docs.nestjs.com |

---

### Inhaltsverzeichnis
- [1 Zusammenfassung](#1-zusammenfassung)
- [2 Systemanforderungen](#2-systemanforderungen)
  - [2.1 Anforderungen an die Funktionalität](#21-anforderungen-an-die-funktionalität)
  - [2.2 Anforderungen an die Informationssicherheit und den Datenschutz](#22-anforderungen-an-die-informationssicherheit-und-den-datenschutz)
- [3 Systemarchitektur](#3-systemarchitektur)
  - [3.1 Gliederung der Lösung in Module](#31-gliederung-der-lösung-in-module)
  - [3.2 Schnittstellen](#32-schnittstellen)
- [4 Testkonzept](#4-testkonzept)
- [5 Weiterführung der Projektplanung](#5-weiterführung-der-projektplanung)
  - [5.1 Abgleich von Planung und tatsächlichem Verlauf der Phase Konzept](#51-abgleich-von-planung-und-tatsächlichem-verlauf-der-phase-konzept)
  - [5.2 Aktualisierung der Risikosituation](#52-aktualisierung-der-risikosituation)
  - [5.3 Planung der nächsten Phase](#53-planung-der-nächsten-phase)

---

### 1 Zusammenfassung

In diesem Dokument wird das Konzept für die Webapplikation «redbox» beschrieben. Zweck des Dokuments ist es, die verfeinerten Systemanforderungen, die Systemarchitektur sowie das Testkonzept für die Realisierungsphase festzuhalten.

«redbox» ist eine datenschutzorientierte, selbst gehostete Plattform für Journalisten, Aktivisten und datenschutzbewusste Nutzerinnen und Nutzer. Sie bietet vier Kernfunktionen: einen Mail Inbox für das Empfangen von E-Mails, einen sicheren Datei-Upload mit Ende-zu-Ende-Verschlüsselung, einen Pastebin-Service («Bin») für das temporäre Speichern von Texten sowie einen URL-Shortener. Der Zugang zur Plattform ist ausschliesslich über einmalige Einladungscodes («Invite Codes») möglich, um Missbrauch zu verhindern.

Das Dokument beschreibt die wichtigsten Anforderungen an das System, den technischen Aufbau (NestJS-Backend, React/TypeScript-Frontend, MariaDB, MinIO, Docker), die Schnittstellen zwischen den Modulen sowie die Planung der Tests und der nächsten Schritte.

---

### 2 Systemanforderungen

#### 2.1 Anforderungen an die Funktionalität

Die in der Studie [2] aufgeführten Anforderungen werden hier verfeinert und konkretisiert. Jede Teilanforderung ist eindeutig bezeichnet, damit sie später als Grundlage für Testfälle und Arbeitspakete dienen kann.

| ID  | Anforderung                        | Beschreibung                                                                                                                                           | Aufgabe des Systems                                                                  |
| :-- | :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| A1  | Registrierung mit Invite-Code      | Neue Nutzerinnen und Nutzer können sich ausschliesslich mit einem gültigen, einmalig verwendbaren «Invite Code» registrieren.                             | Invite Code validieren, Konto erstellen, Code als verbraucht markieren                  |
| A2  | Benutzer-Login                     | Bestehende Nutzerinnen und Nutzer loggen sich mit Benutzername und Passwort ein und erhalten ein JWT für die Session.                                  | Credentials prüfen, JWT ausstellen und zurückgeben                                   |
| A3  | E-Mail empfangen                   | Der Mail-Client zeigt eingegangene E-Mails (Absender, Betreff, Datum, Body inkl. Anhänge) aus dem eigenen Postfach an.                                | E-Mails vom Backend abrufen und im Frontend darstellen                               |
| A4  | Datei-Upload (E2E-verschlüsselt)   | Dateien werden clientseitig mit AES-GCM (256-Bit) verschlüsselt und auf dem Server abgelegt. Der Schlüssel verbleibt im URL-Fragment.                 | Verschlüsselten Blob entgegennehmen, speichern, Share-Link zurückgeben               |
| A5  | Datei-Download                     | Hochgeladene Dateien sind über einen einzigartigen Share-Link abrufbar und werden clientseitig entschlüsselt. Optionaler Passwortschutz möglich.       | Blob bereitstellen, passwortschutz Prüfung serverseitig                              |
| A6  | Datei-Ablaufzeit                   | Hochgeladene Dateien werden nach der konfigurierten Ablaufzeit (1–30 Tage) automatisch gelöscht.                                                       | Ablaufzeit speichern, abgelaufene Dateien per Cron-Job löschen                       |
| A7  | Bin erstellen und teilen           | Nutzerinnen und Nutzer können Texte oder Code in einem «Bin» speichern, optional passwortgeschützt, mit konfigurierbarer Ablaufzeit.                   | Bin-Inhalt speichern, eindeutigen Link generieren, Passwortschutz umsetzen           |
| A8  | Bin abrufen                        | Bins sind über einen einzigartigen Link abrufbar. Passwortgeschützte Bins verlangen die Passworteingabe vor der Anzeige.                               | Bin-Daten abrufen, Passwort prüfen, Inhalt zurückgeben                               |
| A9  | URL-Shortener                      | Nutzerinnen und Nutzer können beliebige URLs verkürzen. Die Kurz-URL leitet Besucher ohne Account transparent weiter.                                  | Kurz-URL erzeugen, Redirect-Endpunkt bereitstellen                                   |
| A10 | Dashboard-Übersicht                | Das Dashboard zeigt eine Zusammenfassung der letzten E-Mails, Bins und des Speicherverbrauchs an.                                                      | Relevante Daten aggregieren und als Widget-Daten bereitstellen                       |
| A11 | Einstellungen (Passwort, Avatar)   | Nutzerinnen und Nutzer können ihr Passwort ändern und einen Avatar auswählen.                                                                          | Passwort-Hash aktualisieren, Avatar-Auswahl speichern                                |
| A12 | Invite-Code-Verwaltung             | Nutzerinnen und Nutzer können in den Einstellungen eigene Invite Codes generieren und einsehen.                                                        | Invite Codes erzeugen, dem Nutzer zuordnen und anzeigen                              |
| A13 | Konto löschen                      | Nutzerinnen und Nutzer können ihr Konto löschen.                                                             | Konto, Dateien, Bins und URLs vollständig aus der Datenbank entfernen               |

---

#### 2.2 Anforderungen an die Informationssicherheit und den Datenschutz

Neben den funktionalen Anforderungen muss «redbox» strenge Anforderungen an den Datenschutz und die Informationssicherheit erfüllen, da Datenschutz ein zentrales Anliegen der Zielgruppe ist.

**Verschlüsselung:** Dateien werden clientseitig mit AES-GCM (256-Bit) verschlüsselt. Der Entschlüsselungsschlüssel verbleibt im URL-Fragment und wird nicht über das Netzwerk an den Server übertragen. Während einer aktiven Session wird der Schlüssel jedoch temporär im serverseitigen Cache (Redis) gehalten, womit er für das Administrationsteam grundsätzlich einsehbar ist. Zusätzlich hat das Administrationsteam im Rahmen der Melde-Funktion die Möglichkeit, gemeldete Inhalte einzusehen. Die Verschlüsselung schützt somit primär vor unbefugtem Zugriff durch Dritte, nicht jedoch vollständig vor dem Administrationsteam selbst. Passwörter werden mit bcrypt gehasht gespeichert und kein Klartext-Passwort verlässt den Client ohne TLS-Schutz.

**Zugriffsschutz:** Alle API-Endpunkte ausser Login, Registrierung und öffentliche Share-Links sind durch JWT Bearer Tokens geschützt. Anfragen ohne gültigen Token erhalten HTTP 401. Der Zugang zur Plattform ist über das Invite-Code-System («Invite Codes») auf vertrauenswürdige Personen beschränkt, um Spam und Missbrauch vollständig auszuschliessen.

**Datensparsamkeit:** Es werden keine Tracker, Analytics-Dienste oder externe Werbenetzwerke eingebunden. Server-Logs protokollieren ausschliesslich System-Events und Fehler — keine IP-Adressen oder Benutzernamen. Nicht mehr benötigte Daten (abgelaufene Dateien und Bins) werden automatisch gelöscht.

**Transportverschlüsselung:** Die gesamte Kommunikation zwischen Client und Server erfolgt über TLS (via Cloudflare Proxy). Unverschlüsselte HTTP-Verbindungen werden automatisch auf HTTPS umgeleitet.

---

### 3 Systemarchitektur

#### 3.1 Gliederung der Lösung in Module

| Modul-Nr. | Modul                                | Beschreibung                                                                                                               |
| :-------- | :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| M1        | Frontend (React + TypeScript)        | Single-Page Application im Browser. Enthält alle Seiten (Dashboard, Mail, Upload, Bin, URL-Shortener, Settings) und die clientseitige AES-GCM-Verschlüsselungslogik. |
| M2        | Backend (NestJS)                     | REST-API-Server mit allen API endpoints (Auth, Mail, File, Bin, URL, Invite-Codes).
| M3        | Datenbank (MariaDB + Prisma)          | Datenbank für Nutzerkonten, Datei-Metadaten, Bins, Kurz-URLs und Invite-Codes. Wird über Prisma ORM angesprochen.         |
| M4        | Auth-Modul (JWT + bcrypt)            | Verwaltet Registrierung (Invite-Code-Prüfung), Login, Token- und Refresh-Token-Ausgabe sowie Passwort-Verwaltung.          |
| M5        | Mail-Modul (Cloudflare + MinIO)      | Empfängt eingehende E-Mails via Cloudflare Webhook, verschlüsselt sie mit RSA+AES-256 und speichert sie in MinIO (S3). Nutzer haben ausschliesslich Lesezugriff auf ihren Posteingang. |
| M6        | File-Modul (Multer + MinIO)          | Entgegennahme clientseitig verschlüsselter Datei-Blobs, Speicherung in MinIO (S3), Cron-Job für automatische Löschung.     |
| M7        | Bin-Modul                            | Speicherung und Abruf von (verschlüsselbaren) Pastebin-Einträgen mit Passwortschutz und Ablaufzeit.                        |
| M8        | URL-Shortener-Modul                  | Verwaltung von Kurz-URLs, öffentlicher Redirect-Endpunkt ohne Authentifizierung.                                           |

**Anforderungszuordnung**

| Anforderung         | M1 Frontend | M2 Backend | M3 Datenbank | M4 Auth | M5 Mail | M6 File | M7 Bin | M8 URL |
| :------------------ | :---------: | :--------: | :----------: | :-----: | :-----: | :-----: | :----: | :----: |
| A1 – Registrierung  | erfüllt     | erfüllt    | erfüllt      | erfüllt |         |         |        |        |
| A2 – Login          | erfüllt     | erfüllt    | erfüllt      | erfüllt |         |         |        |        |
| A3 – Mail empfangen | erfüllt     | erfüllt    | erfüllt      |         | erfüllt |         |        |        |
| A4 – Datei-Upload   | erfüllt     | erfüllt    | erfüllt      |         |         | erfüllt |        |        |
| A5 – Datei-Download | erfüllt     | erfüllt    | erfüllt      |         |         | erfüllt |        |        |
| A6 – Ablaufzeit     |             | erfüllt    | erfüllt      |         |         | erfüllt |        |        |
| A7 – Bin erstellen  | erfüllt     | erfüllt    | erfüllt      |         |         |         | erfüllt|        |
| A8 – Bin abrufen    | erfüllt     | erfüllt    | erfüllt      |         |         |         | erfüllt|        |
| A9 – URL-Shortener  | erfüllt     | erfüllt    | erfüllt      |         |         |         |        | erfüllt|
| A10 – Dashboard     | erfüllt     | erfüllt    | erfüllt      |         | erfüllt | erfüllt | erfüllt|        |
| A11 – Einstellungen | erfüllt     | erfüllt    | erfüllt      | erfüllt |         |         |        |        |
| A12 – Invite-Codes  | erfüllt     | erfüllt    | erfüllt      | erfüllt |         |         |        |        |
| A13 – Konto löschen | erfüllt     | erfüllt    | erfüllt      | erfüllt |         | erfüllt | erfüllt| erfüllt|

---

#### 3.2 Schnittstellen

| Nr. | Schnittstelle              | Daten                       | Beschreibung                                                                                                        |
| :-- | :------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| S1  | Browser zu Frontend       | HTML, CSS, JavaScript       | Externe Schnittstelle. Der Nutzer interagiert über den Browser mit der React-SPA.                                   |
| S2  | Frontend zu Backend       | HTTP/JSON (REST-API)        | Interne Schnittstelle. Das Frontend sendet Anfragen (Login, Upload, Mail, Bin) an das Backend. Authentifizierung via `Authorization: Bearer <JWT>`. |
| S3  | Backend zu Datenbank      | SQL (Prisma / MariaDB)      | Interne Schnittstelle. Das Backend liest und schreibt Daten in die MariaDB-Datenbank über Prisma ORM.               |
| S4  | Cloudflare zu Backend     | HTTP Webhook / E-Mail-Daten | Externe Schnittstelle. Eingehende E-Mails werden von Cloudflare Email Routing via Webhook an den Backend-Endpunkt weitergeleitet, serverseitig mit RSA+AES-256 verschlüsselt und in MinIO gespeichert. |
| S5  | Backend zu MinIO (S3)     | S3 API / Binärdaten         | Interne Schnittstelle. Verschlüsselte Datei-Blobs und Mail-Inhalte werden in MinIO (S3-kompatibel) abgelegt und abgerufen. |

Der Datenfluss funktioniert wie folgt: Der Nutzer interagiert über den Browser mit der React-SPA (S1). Das Frontend sendet HTTP-Anfragen mit JSON-Daten an das Backend (S2). Das Backend prüft den JWT-Token, verarbeitet die Anfragen und liest oder schreibt Metadaten in MariaDB (S3) sowie Datei- und Mail-Inhalte in MinIO (S5). Eingehende E-Mails werden von Cloudflare Email Routing via Webhook angeliefert (S4), serverseitig verschlüsselt und in MinIO abgelegt. Beim Datei-Upload erhält das Backend ausschliesslich den clientseitig verschlüsselten Blob — der AES-GCM-Schlüssel verbleibt im URL-Fragment beim Client.

---

### 4 Testkonzept

Die Tests werden anhand der in Kapitel 2.1 definierten Anforderungen (A1–A14) durchgeführt und finden am Ende der Realisierungsphase statt. Die Teststrategie kombiniert manuelle Funktionstests (Happy Path + Fehlerfälle im Browser) mit gezielten Sicherheitstests der kritischen Schutzmechanismen.

| ID  | Testfall                        | Beschreibung / Vorgehen                                                                                          | Erwartetes Ergebnis                                          | Anforderung |
| :-- | :------------------------------ | :--------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- | :---------- |
| T1  | Registrierung (ungültiger Code) | Registrierung mit einem nicht existierenden oder bereits verwendeten Invite Code versuchen.                         | HTTP 401, Fehlermeldung wird angezeigt                       | A1          |
| T2  | Registrierung (gültiger Code)   | Neues Konto mit einem gültigen Invite Code erstellen, dann einloggen.                                               | Konto wird erstellt, Code als verbraucht markiert, Login erfolgreich | A1, A2 |
| T3  | Zugriffsschutz ohne JWT         | Ohne Login direkt auf geschützte API-Endpunkte zugreifen (z.B. `/api/files`).                                    | HTTP 401 wird zurückgegeben                                  | A2          |
| T4  | E-Mail empfangen                | Test-E-Mail an die redbox-Adresse senden und im Mail-Client prüfen.                                              | E-Mail erscheint korrekt mit Absender, Betreff und Body      | A3          |
| T5  | Datei-Upload und Download (E2E) | Datei hochladen, Share-Link kopieren, in neuem Tab ohne Login öffnen und herunterladen.                          | Datei wird korrekt entschlüsselt und heruntergeladen         | A4, A5      |
| T6  | Download ohne Schlüssel         | Share-Link ohne den Schlüssel im URL-Fragment (`#`) aufrufen.                                                    | Datei kann nicht entschlüsselt werden, Fehlermeldung wird angezeigt | A4     |
| T7  | Datei-Ablaufzeit                | Datei mit kurzer Ablaufzeit hochladen, nach Ablauf erneut aufrufen.                                              | Datei ist nicht mehr abrufbar                                | A6          |
| T8  | Bin erstellen und abrufen       | Bin mit Text und Passwort erstellen, über den Link ohne Passwort aufrufen, dann mit Passwort.                    | Ohne Passwort: Formular erscheint. Mit Passwort: Inhalt sichtbar | A7, A8  |
| T9  | URL-Shortener Redirect          | Kurz-URL ohne Login im Browser aufrufen.                                                                         | Besucher wird transparent auf die Ziel-URL weitergeleitet    | A9          |
| T10 | Dashboard-Übersicht             | Einloggen und Dashboard laden, Widgets prüfen.                                                                   | Letzte E-Mails, Bins und Speicherverbrauch werden angezeigt  | A10         |
| T11 | Konto löschen                   | Konto in den Einstellungen löschen, anschliessend Login versuchen.                                               | Alle Daten entfernt, Login nicht mehr möglich                | A13         |

---

### 5 Weiterführung der Projektplanung

#### 5.1 Abgleich von Planung und tatsächlichem Verlauf der Phase Konzept

| Phase              | Geplant                                            | Tatsächlich                                                                     | Bemerkung               |
| :----------------- | :------------------------------------------------- | :------------------------------------------------------------------------------ | :---------------------- |
| **Initialisierung**| PIA, Studie und Konzept erarbeiten                 | Studie mit 3 Varianten erstellt, Variante 1 (Self-Hosted) gewählt               | Planmässig abgeschlossen |
| **Konzept**        | Systemarchitektur und Anforderungen definieren     | NestJS-Backend, React-Frontend, MariaDB, MinIO und Module definiert              | Zeitplan eingehalten    |
| **Realisierung**   | 20.04. – 25.04.2026                                | Backend & Frontend Optimierung                              | Laufend, der Grossteil wurde bereits in der Freizeit erledigt                 |

Die Phase Konzept verlief planmässig. Die grösste Herausforderung war die Konzeption der clientseitigen Ende-zu-Ende-Verschlüsselung (AES-GCM im Browser), bei der sichergestellt werden musste, dass der Schlüssel den Server nie erreicht. Dies wurde durch die Verwendung des URL-Fragments (`#`) als Schlüsselträger gelöst, da Fragment-Anteile nicht an den Server übertragen werden. Der Zeitplan wurde eingehalten und der Grossteil der Realisierung wurde bereits in der Freizeit umgesetzt weshalb wir uns nun auf die Optimierung fokussieren können.

---

#### 5.2 Aktualisierung der Risikosituation

| Risiko                              | Massnahme                                                                                           | Einschätzung                                      |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| Cloudflare Email Routing komplex    | Webhook & Cloudflare worker frühzeitig testen                    | Mittel — externe Abhängigkeit                     |
| Homeserver-Ausfall (Strom / Netz)   | Cloudflare-Proxy puffert kurze Ausfälle, regelmässige Backups der MariaDB-Datenbank                            | Gering — private Nutzerbasis   |
| Datenbankprobleme bei hoher Last     | MariaDB-Verbindungspool konfigurieren, bei Problemen Indexierung optimieren                         | Gering — Invite-Only-Nutzerbasis ist klein        |

---

#### 5.3 Planung der nächsten Phase

| Datum  | Aufgabe                                                                                    | Verantwortlich  | Status   |
| :----- | :----------------------------------------------------------------------------------------- | :-------------- | :------- |
| 20.04  | Kick-Off, Aufgaben verteilen, Docker-Setup finalisieren, Auth-API fertigstellen            | Noel Kohn       | Erledigt |
| 21.04  | File-Upload (E2E), Bin-API, URL-Shortener-API, Frontend-Routing und Auth-Seiten            | Ganzes Team     | Erledigt |
| 22.04  | Mail-Client (Empfang), Dashboard-Widgets, Settings-Seite                                   | Ganzes Team     | Erledigt |
| 23.04  | Integration Front-/Backend, Security-Checks, erste Deployments auf dem Homeserver          | Ganzes Team     | Offen    |
| 24.04  | Tests durchführen (T1–T11), Bugfixing, Dokumentation abschliessen                          | Ganzes Team     | Offen    |
| 25.04  | Abschlusspräsentation vorbereiten, finales Deployment                                      | Noel Kohn       | Offen    |

Die Realisierungsphase dauert vier Tage (20.–22. + 24. April 2026). Ziel ist es, eine vollständig funktionsfähige Plattform bereitzustellen, auf der sich Nutzerinnen und Nutzer registrieren, E-Mails empfangen, Dateien Ende-zu-Ende-verschlüsselt hochladen und Texte im Bin speichern können.
