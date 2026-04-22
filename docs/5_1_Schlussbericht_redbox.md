# redbox

## Schlussbericht

<br>

|                   |                                                   |
| ----------------: | :------------------------------------------------ |
|        **Status** | Entwurf                                           |
|   **Projektname** | redbox                                            |
| **Projektleiter** | Noel Kohn                                         |
|  **Auftraggeber** | gibb                                              |
|       **Autoren** | Noel Kohn, Henry R. Schellenberg, Maksym Shepetko |
|     **Verteiler** | Noel Kohn, Henry R. Schellenberg, Maksym Shepetko |
|         **Stand** | 22.04.2026                                        |

#### Änderungskontrolle, Prüfung, Genehmigung

| Version | Datum      | Beschreibung, Bemerkung       | Name oder Rolle |
| :------ | :--------- | :---------------------------- | :-------------- |
| 1.0     | 22.04.2026 | Ersterstellung Schlussbericht | Noel Kohn       |

#### Referenzen

| Referenz | Titel, Quelle                                                     |
| :------- | :---------------------------------------------------------------- |
| [1]      | Projektinitialisierungsantrag «redbox» — `docs/projekt_redbox.md` |
| [2]      | Studie redbox v1.0 — `docs/studie1_1.md`                          |
| [3]      | Konzeptbericht redbox — `docs/2_1_Konzeptbericht_redbox_v2.md`    |
| [4]      | Realisierungsbericht redbox — `docs/3_1_Realisierungsbericht_redbox.md` |
| [5]      | NestJS Dokumentation — https://docs.nestjs.com                    |
| [6]      | React Dokumentation — https://react.dev                           |
| [7]      | Prisma Dokumentation — https://www.prisma.io/docs                 |
| [8]      | MinIO Dokumentation — https://min.io/docs                         |
| [9]      | Cloudflare Email Routing — https://developers.cloudflare.com/email-routing/ |

---

## Inhaltsverzeichnis

- [Teil 1](#teil-1)
  - [1 Management Abstract](#1-management-abstract)
  - [2 Aufgabenstellung](#2-aufgabenstellung)
  - [3 Deklaration der Vorkenntnisse](#3-deklaration-der-vorkenntnisse)
  - [4 Deklaration der Vorarbeiten](#4-deklaration-der-vorarbeiten)
  - [5 Deklaration der verwendeten Standards](#5-deklaration-der-verwendeten-standards)
  - [6 Zeitplan](#6-zeitplan)
  - [7 Arbeitsprotokoll](#7-arbeitsprotokoll)
- [Teil 2](#teil-2)
  - [8 Situationsanalyse](#8-situationsanalyse)
  - [9 Systemziele](#9-systemziele)
  - [10 Lösungsvorschläge](#10-lösungsvorschläge)
  - [11 Systemarchitektur](#11-systemarchitektur)
  - [12 Testkonzept und Testspezifikationen](#12-testkonzept-und-testspezifikationen)
  - [13 Testprotokoll](#13-testprotokoll)
  - [14 Benutzerdokumentation](#14-benutzerdokumentation)
  - [15 Projekterfahrung](#15-projekterfahrung)
- [Teil 3](#teil-3)
  - [16 Selbst erstellte Listings und Skripte](#16-selbst-erstellte-listings-und-skripte)
  - [17 Literaturverzeichnis](#17-literaturverzeichnis)
  - [18 Glossar](#18-glossar)
  - [19 Anhang](#19-anhang)

---

# Teil 1

## 1 Management Abstract

Das Projekt «redbox» entstand aus dem Bedürfnis nach einer schlanken, selbst kontrollierten Plattform für datenschutzbewusste Kommunikation und Dateiablage. Viele gängige Dienste sind zwar bequem, speichern aber Daten und Metadaten bei Drittanbietern. Für Journalisten, Aktivisten und sicherheitsbewusste Nutzerinnen und Nutzer kann dies problematisch sein, weil vertrauliche Informationen nicht nur technisch geschützt, sondern auch organisatorisch nachvollziehbar verarbeitet werden müssen.

Ziel des Projekts war deshalb eine selbst gehostete Webapplikation auf der Domain `redbox.cx`. Die Plattform sollte nur für eingeladene Personen zugänglich sein, keine Tracker oder Werbenetzwerke verwenden und zentrale Funktionen für den Alltag bereitstellen: E-Mail-Empfang, sichere Dateiübertragung, temporäre Textablage als Bin sowie einen URL-Shortener. Zusätzlich sollte das System durch ein Administrationsteam verwaltet werden können, ohne unnötige personenbezogene Daten zu protokollieren.

Die gewählte Lösung ist ein Self-Hosted Custom Stack. Das Frontend wurde mit React und TypeScript umgesetzt, das Backend mit NestJS und TypeScript. MariaDB speichert Nutzerkonten und Metadaten, MinIO speichert verschlüsselte Datei- und Mail-Inhalte. Prisma wird als Datenbankzugriffsschicht verwendet. Cloudflare übernimmt DNS, Proxy-Funktion und Email Routing für eingehende E-Mails. Der Zugriff auf die Plattform erfolgt über Invite Codes, Passwörter werden gehasht gespeichert und Dateien sowie Bins werden verschlüsselt abgelegt.

Im Projektverlauf wurden die grundlegenden Tools sowie das React-Frontend des Adminpanels bereits in der Freizeit und Vorbereitungsphase erstellt. Die drei Projekttage vom 20. bis 22.04.2026 wurden deshalb nicht für eine vollständige Neuentwicklung genutzt, sondern für Verbesserungen an der Website, das Schliessen von Sicherheitslücken, zusätzliche Admin-Funktionen, Rate Limiting, das Deployment im Homelab und ausführliche Tests. Am 22.04.2026 wurde redbox online gestellt und anschliessend geprüft. Der E-Mail-Empfang über Cloudflare wurde realisiert; der vollständige externe E-Mail-Versand über das Webinterface bleibt als Ausbaupunkt bestehen.

Das Projekt zeigt, dass eine datenschutzorientierte Plattform mit begrenzter Hardware und einem kleinen Team realistisch umgesetzt werden kann, wenn der Funktionsumfang bewusst schlank bleibt. Gleichzeitig wurde sichtbar, dass Mail-Infrastruktur, Schlüsselverwaltung und Betriebssicherheit besondere Aufmerksamkeit benötigen und in zukünftigen Versionen frühzeitig eingeplant werden sollten.

---

## 2 Aufgabenstellung

### 2.1 Ausgangslage

Persönliche Daten werden im digitalen Alltag häufig bei grossen Anbietern gespeichert. Diese Anbieter stellen leistungsfähige Dienste bereit, behalten aber oft Kontrolle über Infrastruktur, Nutzungsdaten und teilweise auch Metadaten. Für Personen, die vertrauliche Informationen austauschen, ist dies ein Risiko.

Das Projektteam verfügte bereits über eine Domain (`redbox.cx`), einen eigenen Homeserver und praktische Web-Entwicklungserfahrung. Daraus entstand die Aufgabe, eine eigene Plattform zu entwickeln, die möglichst wenige externe Abhängigkeiten besitzt und die Kontrolle über Daten und Infrastruktur beim Team belässt.

Die Plattform sollte folgende Grundidee erfüllen:

- Zugriff nur mit Invite Code
- selbst gehostetes Backend und Frontend
- keine Tracker, keine Werbung, keine unnötige Datenweitergabe
- Datei-Upload mit Verschlüsselung
- temporäre Textablage als Bin
- E-Mail-Empfang über eine eigene Weboberfläche
- einfache Administration und nachvollziehbarer Betrieb

### 2.2 Zielgruppe

Die Zielgruppe wurde in der Studie anhand von Personas beschrieben. Dazu gehören insbesondere:

| Persona     | Rolle                          | Bedürfnis |
| :---------- | :----------------------------- | :-------- |
| Berndt      | Selbstständiger Journalist     | vertrauliche Informationen geschützt speichern und empfangen |
| Bartholomeo | Journalist und Aktivist        | sichere Kommunikations- und Austauschplattform nutzen |
| Linus       | Cybersecurity-Spezialist       | technische Kontrolle, Transparenz und Datenschutz nachvollziehen |

### 2.3 Projektziele

| Nr. | Ziel aus Studie und Konzept | Ergebnis zum Stand 22.04.2026 |
| :-- | :-------------------------- | :----------------------------- |
| Z1  | Webplattform ohne Tracker und ohne unnötige Datenweitergabe | Erreicht. Die Plattform nutzt keine Analytics- oder Werbenetzwerke. Externe Abhängigkeiten wie Cloudflare sind dokumentiert. |
| Z2  | Performante Webapplikation auf vorhandener Hardware | Erreicht nach aktuellem Stand. React, NestJS, MariaDB und MinIO laufen ressourcenschonend im Docker-Umfeld. |
| Z3  | Mail-Service, Datei-Upload und Pastebin/Bin bereitstellen | Teilweise bis weitgehend erreicht. Datei-Upload, Bin, URL-Shortener und Mail-Empfang sind umgesetzt. Vollständiger externer Mail-Versand bleibt ein Ausbaupunkt. |
| Z4  | Zugang über Invite-Code-System beschränken | Erreicht. Registrierung und Verwaltung von Invite Codes sind umgesetzt. |
| Z5  | Übersichtliche und reaktionsschnelle Benutzeroberfläche | Erreicht. Dashboard, Upload, Bin, Mail, Shortener und Einstellungen sind als React-Seiten vorhanden. |
| Z6  | Entwicklung und Deployment im engen Zeitrahmen | Erreicht. Die Vorarbeiten wurden in der Vorbereitungsphase genutzt; an den drei Projekttagen wurden Verbesserungen umgesetzt, redbox im Homelab online gestellt und getestet. |
| Z7  | Praktisches Wissen über datenschutzorientierte Webdienste aufbauen | Erreicht. Das Team konnte Erfahrungen mit Verschlüsselung, MinIO, Prisma, Cloudflare und Docker sammeln. |

### 2.4 Abgrenzung

Nicht Teil des Projektumfangs sind Kalender, Videotelefonie, umfassende Kollaborationstools oder ein vollständig selbst betriebenes Mail-Relay. Der Schwerpunkt liegt auf einer schlanken Plattform mit wenigen, dafür nachvollziehbar umgesetzten Kernfunktionen.

---

## 3 Deklaration der Vorkenntnisse

Das Team verfügte vor Projektbeginn über Grundkenntnisse in Webentwicklung, Git, TypeScript, React, Node.js und Docker. Zusätzlich waren erste Erfahrungen mit Linux-Servern, Domains und Webhosting vorhanden. Noel Kohn brachte vertieftes Wissen in Backend-Entwicklung, Authentifizierung und Serverbetrieb ein. Henry R. Schellenberg und Maksym Shepetko brachten Kenntnisse in Frontend, Dokumentation, Testing und Umsetzung einzelner Funktionsmodule ein.

Nicht vollständig vorhanden waren praktische Erfahrungen mit produktiver Mail-Infrastruktur, MinIO als S3-kompatiblem Speicher, Prisma-Migrationen in einem grösseren Datenmodell sowie clientseitiger Ende-zu-Ende-Verschlüsselung im Browser. Diese Themen wurden während des Projekts erarbeitet.

---

## 4 Deklaration der Vorarbeiten

Vor Projektbeginn waren die Idee, die Domain `redbox.cx` und die Hardware für den Homeserver vorhanden. Ausserdem lagen der Projektinitialisierungsantrag und die Studie als Grundlagen vor. Die Studie verglich drei Varianten und empfahl die Umsetzung als Self-Hosted Custom Stack.

Im Rahmen der Vorbereitung wurden Architekturentscheide, Dokumentationsentwürfe und erste technische Grundlagen erarbeitet. Zusätzlich wurden die grundlegenden Tools der Plattform sowie das React-Frontend des Adminpanels bereits in der Freizeit vorbereitet. Diese Vorarbeiten waren wichtig, damit die Projekttage vom 20. bis 22.04.2026 für Verbesserungen, Sicherheit, zusätzliche Admin-Funktionen, Deployment und Tests genutzt werden konnten. Vor Projektbeginn gab es damit bereits funktionale Grundlagen, aber noch keine final geprüfte und online gestellte redbox-Plattform.

---

## 5 Deklaration der verwendeten Standards

Da es sich um ein Schulprojekt handelt, wurden keine externen Firmenstandards eines Betriebs übernommen. Das Team orientierte sich an folgenden Projektstandards:

| Bereich | Standard |
| :------ | :------- |
| Code-Stil | TypeScript, modulare NestJS-Struktur, React-Komponenten, ESLint und Prettier gemäss Projektkonfiguration |
| Versionsverwaltung | Git-Repository mit nachvollziehbaren Dateiänderungen |
| Datenbank | Prisma Schema und Prisma-Migrationen für strukturierte Änderungen |
| Infrastruktur | Docker Compose für MariaDB, Redis und MinIO |
| Sicherheit | bcrypt für Passwort-Hashes, JWT für Sessions, TLS über Cloudflare, möglichst datensparsame Logs |
| Dokumentation | Markdown-Berichte im `docs`-Verzeichnis |
| Datenschutz | Keine Tracker, keine Werbung, minimale Speicherung personenbezogener Daten |

---

## 6 Zeitplan

Für redbox sind die Vorbereitungsphase in der Freizeit sowie die drei Projekttage vom 20. bis 22.04.2026 relevant. An den späteren Daten aus früheren Planungen wurde nicht an redbox gearbeitet; sie werden deshalb in diesem Schlussbericht nicht als Projektzeit aufgeführt.

| Phase / Datum | Vorgesehener Fokus | Tatsächlicher Verlauf | Abweichung / Bemerkung |
| :------------ | :------ | :-------------------- | :--------------------- |
| Vorbereitungsphase / Freizeit | PIA, Studie, Grobkonzept, Hardware, Domain und technische Grundlagen vorbereiten | Grundlegende Tools der Plattform wurden erstellt. Zusätzlich wurde das React-Frontend des Adminpanels vorbereitet. | Diese Arbeiten fanden vor den drei Projekttagen statt und bildeten die Grundlage für die spätere Optimierung. |
| 20.04.2026 | Bestehende Website und Tools verbessern | Verbesserungen an der Website, Überarbeitung bestehender Abläufe und erste Behebung von Sicherheitslücken. | Der Schwerpunkt lag auf Stabilisierung und Qualität, nicht auf einer vollständigen Neuentwicklung. |
| 21.04.2026 | Adminpanel und Sicherheit erweitern | Mehr Funktionen im Adminpanel umgesetzt, Rate Limiting ergänzt und weitere Sicherheitslücken geschlossen. | Die Plattform wurde besser administrierbar und robuster gegen Missbrauch. |
| 22.04.2026 | Finalisieren, online stellen und testen | Letzte Verbesserungen umgesetzt, redbox im Homelab online gestellt und anschliessend ausführlich getestet. | Abschluss der relevanten redbox-Projektzeit. Weitere im alten Zeitplan erwähnte Daten gehören nicht zur effektiven Arbeit an redbox. |

Die wichtigste Planabweichung besteht darin, dass die Grundfunktionen bereits in der Freizeit und Vorbereitungsphase entstanden sind. Die eigentliche Projektzeit wurde deshalb für Verbesserungen, Sicherheit, Admin-Funktionen, Rate Limiting, Deployment und Tests genutzt.

---

## 7 Arbeitsprotokoll

Das Arbeitsprotokoll fasst die relevanten Arbeiten verdichtet zusammen. Die grundlegenden Tools und das React-Adminpanel wurden bereits vor den drei Projekttagen vorbereitet; die Projekttage selbst dienten der Verbesserung, Absicherung und Inbetriebnahme.

| Phase / Datum | Tätigkeit | Ergebnis / Reflexion |
| :------------ | :-------- | :------------------- |
| Vorbereitungsphase / Freizeit | Grundlegende Tools, React-Frontend des Adminpanels, Projektidee, Studie, Konzept und technische Grundlagen vorbereitet. | Die Vorarbeiten reduzierten das Risiko während der Projekttage. Gleichzeitig musste im Schlussbericht klar deklariert werden, welche Teile bereits vorher entstanden sind. |
| 20.04.2026 | Website verbessert, bestehende Tools geprüft, Abläufe überarbeitet und erste Sicherheitslücken behoben. | Die Arbeit zeigte, dass die Plattform funktional bereits weit war, aber für einen stabilen Betrieb zusätzliche Absicherung und Feinschliff benötigte. |
| 21.04.2026 | Adminpanel erweitert, zusätzliche Verwaltungsfunktionen umgesetzt, Rate Limiting ergänzt und weitere Sicherheitslücken geschlossen. | Das Adminpanel wurde zu einem wichtigeren Teil des Betriebs. Rate Limiting verbesserte den Schutz gegen Missbrauch deutlich. |
| 22.04.2026 | Letzte Verbesserungen umgesetzt, redbox im Homelab online gestellt und ausführliche Tests durchgeführt. | Das Deployment machte sichtbar, ob die lokale Entwicklung auch im realen Betrieb funktioniert. Die anschliessenden Tests bestätigten die wichtigsten Funktionen. |

---

# Teil 2

## 8 Situationsanalyse

Die Studie beschreibt die Ausgangslage als Spannungsfeld zwischen bequemen Cloud-Diensten und dem Bedürfnis nach Datenschutz. Grosse Anbieter bieten viele Funktionen, verlangen dafür aber Vertrauen in fremde Infrastruktur und Geschäftsmodelle. redbox soll eine kleinere, kontrollierbare Alternative sein.

### 8.1 Stärken

| Stärke | Beschreibung |
| :----- | :----------- |
| Datenhoheit | Die Kernsysteme laufen auf eigener Infrastruktur. |
| Schlanker Umfang | Fokus auf Mail-Empfang, Upload, Bin, Shortener und Administration statt überladener Plattform. |
| Geringe Kosten | Hardware und Domain waren bereits vorhanden. |
| Transparenz | Architektur und Datenflüsse sind im Konzept- und Realisierungsbericht dokumentiert. |

### 8.2 Schwächen und Risiken

| Risiko | Beschreibung | Massnahme |
| :----- | :----------- | :-------- |
| Homeserver-Ausfall | Ein einzelner Homeserver bietet keine professionelle Hochverfügbarkeit. | Backups, Monitoring und klare Kommunikation, dass kein SLA besteht. |
| Cloudflare-Abhängigkeit | DNS, Proxy und Mail Routing hängen von einem externen Anbieter ab. | Abhängigkeit dokumentieren, alternatives Mail-Relay als Zukunftspunkt prüfen. |
| Wartungsaufwand | Updates für System, Container und Applikation liegen beim Team. | Docker, klare Dokumentation und regelmässige Wartungsfenster. |
| Admin-Zugriff | Reports und Administration erlauben Einblick in gemeldete Inhalte. | Transparente Nutzungsbedingungen und bewusst begrenzte Admin-Funktionen. |

---

## 9 Systemziele

### 9.1 Funktionale Anforderungen

| ID | Anforderung | Umsetzung |
| :-- | :---------- | :-------- |
| A1 | Registrierung mit Invite Code | Backend validiert Codes, markiert sie als verbraucht und erstellt Nutzerkonten. |
| A2 | Benutzer-Login | Login mit Benutzername und Passwort, Session über JWT. |
| A3 | E-Mail empfangen | Eingehende E-Mails werden über Cloudflare Webhook angenommen und im Mail-Client angezeigt. |
| A4 | Datei-Upload | Dateien werden verschlüsselt hochgeladen und in MinIO gespeichert. |
| A5 | Datei-Download | Dateien können über Share-Link abgerufen und entschlüsselt werden. |
| A6 | Datei-Ablaufzeit | Ablaufdaten werden gespeichert; abgelaufene Inhalte werden entfernt. |
| A7 | Bin erstellen | Texte können als Bin gespeichert und geteilt werden. |
| A8 | Bin abrufen | Bins sind über Share-Link abrufbar, optional mit Passwortschutz. |
| A9 | URL-Shortener | Lange URLs können in Kurzlinks umgewandelt werden. |
| A10 | Dashboard | Übersicht über relevante Inhalte und Speicherverbrauch. |
| A11 | Einstellungen | Passwort, Avatar, Invite Codes und Kontooptionen sind verfügbar. |
| A12 | Invite-Code-Verwaltung | Nutzer und Admins können je nach Rolle Codes verwalten. |
| A13 | Konto löschen | Kontolöschung ist als Workflow vorgesehen und im Datenmodell abgebildet. |

### 9.2 Informationssicherheit und Datenschutz

redbox setzt auf Datensparsamkeit, verschlüsselte Speicherung und beschränkten Zugang. Passwörter werden nicht im Klartext gespeichert. Dateien und Bins verwenden Schlüsselmaterial, das getrennt von den eigentlichen Inhalten verwaltet wird. Die Plattform nutzt keine Tracker oder Werbenetzwerke. Logs sollen technische Ereignisse nachvollziehbar machen, ohne unnötige personenbezogene Daten zu sammeln.

---

## 10 Lösungsvorschläge

Die Studie prüfte drei Varianten:

| Variante | Beschreibung | Bewertung |
| :------- | :----------- | :-------- |
| Self-Hosted Custom Stack | Eigenentwicklung auf vorhandenem Homeserver | Gewählt, weil Datenschutz und Kontrolle am besten erfüllt werden. |
| Cloud VPS Hosting | Betrieb auf gemietetem Server mit Standardsoftware | Technisch einfacher, aber geringere Datenhoheit und laufende Kosten. |
| SaaS-Aggregation | Eigenes Frontend vor bestehenden Diensten wie Gmail oder Dropbox | Verfehlt das Datenschutzziel, da Daten weiterhin bei Drittanbietern liegen. |

Die gewählte Lösung ist Variante 1. Sie passt am besten zum Projektziel, weil Hard- und Software kontrollierbar bleiben und nur die nötigen Funktionen umgesetzt werden.

---

## 11 Systemarchitektur

redbox ist als klassische Webapplikation mit React-Frontend, NestJS-Backend, MariaDB, Redis und MinIO aufgebaut. Cloudflare übernimmt die externe Erreichbarkeit und leitet eingehende E-Mails an das Backend weiter.

```text
Browser
  |
  v
Cloudflare
  |
  +--> Frontend (React, TypeScript, Vite)
  |       |
  |       v
  |    Backend-API (NestJS, REST, JWT)
  |       |
  |       +--> MariaDB (Nutzer, Metadaten, Logs)
  |       +--> Redis (temporäre Session- und Cache-Daten)
  |       +--> MinIO (Dateien, Mail-Inhalte, Anhänge)
  |
  +--> Cloudflare Email Routing
          |
          v
       Backend-Mail-Webhook
```

### 11.1 Komponenten

| Komponente | Technologie | Aufgabe |
| :--------- | :---------- | :------ |
| Frontend | React, TypeScript, Vite | Benutzeroberfläche für Dashboard, Mail, Upload, Bin, Shortener und Settings. |
| Backend | NestJS, TypeScript | API, Authentifizierung, Businesslogik, Admin-Funktionen und Cron-Aufgaben. |
| Datenbank | MariaDB, Prisma | Persistente Speicherung von Nutzern, Codes, Dateien, Bins, Links, Mails und Reports. |
| Object Storage | MinIO | Speicherung grosser Inhalte wie Datei-Blobs, Mail-Inhalte und Anhänge. |
| Cache | Redis | Temporäre Daten und technische Unterstützung für Sessions und Laufzeitdaten. |
| Externe Infrastruktur | Cloudflare | DNS, Proxy und Email Routing. |

### 11.2 Schnittstellen

| Nr. | Schnittstelle | Beschreibung |
| :-- | :------------ | :----------- |
| S1 | Browser zu Frontend | Nutzer interagieren über die React-SPA. |
| S2 | Frontend zu Backend | REST-Anfragen mit JSON, Multipart-Daten und JWT-Authentifizierung. |
| S3 | Backend zu MariaDB | Datenbankzugriff über Prisma ORM. |
| S4 | Backend zu MinIO | Speicherung und Abruf von Datei- und Mail-Inhalten über S3-kompatible API. |
| S5 | Cloudflare zu Backend | Eingehende E-Mails werden per Webhook an das Mail-Modul geliefert. |

---

## 12 Testkonzept und Testspezifikationen

Die Teststrategie kombiniert manuelle Funktionstests, Fehlerfälle und sicherheitsrelevante Prüfungen. Grundlage sind die Anforderungen A1 bis A13 aus Konzept- und Realisierungsbericht.

| ID | Anforderung | Testfall | Erwartetes Ergebnis |
| :-- | :---------- | :------- | :------------------ |
| T1 | A1 | Registrierung mit ungültigem Invite Code | Konto wird nicht erstellt, Fehlermeldung erscheint. |
| T2 | A1, A2 | Registrierung mit gültigem Code und Login | Konto wird erstellt, Code wird verbraucht, Login funktioniert. |
| T3 | A2 | Zugriff auf geschützte API ohne JWT | API gibt HTTP 401 zurück. |
| T4 | A3 | Test-E-Mail empfangen | E-Mail erscheint im Posteingang. |
| T5 | A4, A5 | Datei hochladen und herunterladen | Datei ist nach Download korrekt entschlüsselt. |
| T6 | A4 | Share-Link ohne Schlüssel öffnen | Entschlüsselung schlägt nachvollziehbar fehl. |
| T7 | A6 | Datei nach Ablaufzeit abrufen | Datei ist nicht mehr verfügbar. |
| T8 | A7, A8 | Bin mit Passwort erstellen und abrufen | Ohne Passwort kein Zugriff, mit Passwort Inhalt sichtbar. |
| T9 | A9 | Kurzlink aufrufen | Weiterleitung auf Ziel-URL funktioniert. |
| T10 | A10 | Dashboard laden | Widgets zeigen relevante Daten an. |
| T11 | A13 | Konto löschen und erneuten Login versuchen | Daten sind entfernt, Login ist nicht mehr möglich. |

Endkriterium ist, dass alle kritischen Testfälle bestanden werden und keine offenen Fehler mit hoher Auswirkung bestehen.

---

## 13 Testprotokoll

Nach dem Online-Stellen im Homelab am 22.04.2026 wurden die definierten Testfälle ausführlich geprüft. Die Tests deckten Registrierung, Zugriffsschutz, Mail-Empfang, Upload, Download, Bin, Shortener, Dashboard und Kontolöschung ab.

| ID | Ergebnis | Bemerkung |
| :-- | :------- | :-------- |
| T1 | Bestanden | Ungültiger Code wurde korrekt abgewiesen. |
| T2 | Bestanden | Registrierung und Login funktionierten. |
| T3 | Bestanden | Geschützte Endpunkte waren ohne Token nicht erreichbar. |
| T4 | Bestanden | Mail erschien mit erwarteter Verzögerung im Posteingang. |
| T5 | Bestanden | Upload und Download waren erfolgreich. |
| T6 | Bestanden | Fehlender Schlüssel verhinderte die Entschlüsselung. |
| T7 | Bestanden | Abgelaufene Datei war nicht mehr abrufbar. |
| T8 | Bestanden | Passwortschutz für Bin funktionierte. |
| T9 | Bestanden | Kurzlink leitete korrekt weiter. |
| T10 | Bestanden | Dashboard-Daten wurden angezeigt. |
| T11 | Bestanden | Kontolöschung verhinderte weiteren Login. |

Die wichtigste Beobachtung war die Verzögerung beim Mail-Empfang durch Cloudflare Email Routing. Diese Verzögerung ist für den Projektumfang akzeptabel, sollte im Betrieb aber den Nutzern kommuniziert werden.

---

## 14 Benutzerdokumentation

### 14.1 Registrierung

Neue Nutzer öffnen die Registrierungsseite, wählen Benutzername und Passwort und geben einen gültigen Invite Code ein. Nach erfolgreicher Prüfung wird das Konto erstellt und der Code verbraucht.

### 14.2 Login und Dashboard

Nach dem Login gelangen Nutzer auf das Dashboard. Dort sind die wichtigsten Bereiche erreichbar: Mail, Upload, Bin, Shortener und Einstellungen.

### 14.3 Datei-Upload

Nutzer wählen eine Datei, setzen optional Passwort und Ablaufzeit und laden sie hoch. Das System erstellt einen Share-Link. Dieser Link muss vollständig weitergegeben werden, weil der Schlüssel zur Entschlüsselung Teil des Links ist.

### 14.4 Datei-Download

Empfänger öffnen den Share-Link im Browser. Falls ein Passwort gesetzt wurde, muss dieses eingegeben werden. Danach wird die Datei entschlüsselt und heruntergeladen.

### 14.5 Bin

Im Bin-Bereich können Texte oder Code gespeichert werden. Optional kann ein Passwort und eine Ablaufzeit gesetzt werden. Der erzeugte Link kann mit anderen Personen geteilt werden.

### 14.6 Mail

Eingehende E-Mails werden im Mail-Bereich angezeigt. redbox empfängt E-Mails über Cloudflare Email Routing und speichert Inhalte verschlüsselt ab.

### 14.7 Shortener

Im Shortener-Bereich können lange URLs verkürzt werden. Der erzeugte Kurzlink kann öffentlich aufgerufen werden und leitet auf die Zieladresse weiter.

### 14.8 Einstellungen

In den Einstellungen können Nutzer Passwort, Avatar, Invite Codes und Kontooptionen verwalten. Die Kontolöschung ist endgültig und soll nur bewusst ausgelöst werden.

---

## 15 Projekterfahrung

### 15.1 Erreichte Ziele

Die wichtigsten Projektziele wurden erreicht. Es gibt eine lauffähige Webapplikation mit Invite-Code-Registrierung, Login, Dashboard, Datei-Upload, Bin, URL-Shortener, Mail-Empfang und Administration. Die Architektur folgt der in der Studie empfohlenen Variante und nutzt die vorhandene Infrastruktur sinnvoll. Datenschutzanforderungen wie keine Tracker, begrenzte Logs und verschlüsselte Speicherung wurden berücksichtigt.

Besonders positiv war, dass die Module getrennt entwickelt werden konnten. NestJS bot für Backend-Module eine klare Struktur, während React eine schnelle Umsetzung der Benutzeroberfläche ermöglichte. Prisma half, das wachsende Datenmodell nachvollziehbar zu verwalten.

### 15.2 Nicht vollständig erreichte Ziele

Der vollständige E-Mail-Versand über das Webinterface wurde nicht im ursprünglich gedachten Umfang abgeschlossen. Der E-Mail-Empfang funktioniert, aber ein vollwertiges, selbst kontrolliertes Mail-System mit Versand, Reputation, Spam-Schutz und Zustellbarkeit wäre für den Zeitrahmen zu gross gewesen.

Auch die Betriebssicherheit bleibt ein begrenzender Faktor. Ein Homeserver ist kostengünstig und kontrollierbar, bietet aber keine professionelle Hochverfügbarkeit. Backups, Monitoring und ein Wiederherstellungskonzept sollten in einer nächsten Version stärker ausgebaut werden.

### 15.3 Was gut gelaufen ist

Gut funktioniert haben die klare Fokussierung auf Kernfunktionen, die modulare Architektur und die enge Verbindung zwischen Dokumentation und Umsetzung. Die Entscheidung für einen eigenen Stack war passend, weil damit Datenschutzentscheidungen nicht durch Drittsoftware vorgegeben wurden.

Auch die Erweiterung um Admin-Funktionen, Reports und Systembenachrichtigungen war wertvoll. Dadurch ist die Plattform nicht nur aus Nutzersicht bedienbar, sondern auch betreibbar.

### 15.4 Was schwierig war

Die grössten Schwierigkeiten lagen bei Mail-Routing, Schlüsselverwaltung und sauberer Abgrenzung des Projektumfangs. Gerade Mail wirkt auf den ersten Blick wie eine einzelne Funktion, besteht aber aus vielen Einzelthemen: Empfang, Versand, DNS, Zustellbarkeit, Spam-Schutz, Anhänge und Speicherung.

Zudem verlangt Verschlüsselung eine genaue Trennung zwischen Benutzerkomfort und Sicherheit. Share-Links müssen einfach nutzbar sein, dürfen aber keine unnötigen Geheimnisse an den Server senden.

### 15.5 Was beim nächsten Mal anders gemacht würde

Beim nächsten Projekt würden die Risiken rund um Mail-Infrastruktur früher isoliert getestet. Ausserdem wären automatische Tests für kritische API-Endpunkte und Verschlüsselungsabläufe sinnvoll. Der Funktionsumfang sollte noch früher in Muss-, Soll- und Zukunftsfunktionen getrennt werden, damit der Schluss der Realisierung weniger von Integrationsarbeiten geprägt ist.

---

# Teil 3

## 16 Selbst erstellte Listings und Skripte

Die folgenden selbst erstellten Dateien sind für das Projekt besonders relevant. Vollständige Listings befinden sich im Repository.

| Datei | Inhalt |
| :---- | :----- |
| `apps/backend/src/auth/auth.service.ts` | Registrierung, Login, Passwortwechsel, Token-Logik und Invite-Code-Prüfung. |
| `apps/backend/src/files/files.service.ts` | Datei-Upload, Download, Metadaten und MinIO-Anbindung. |
| `apps/backend/src/bins/bins.service.ts` | Erstellen, Abrufen und Verwalten von Bins. |
| `apps/backend/src/mail/mail.service.ts` | Verarbeitung eingehender Mails und Speicherung der Mail-Inhalte. |
| `apps/backend/src/links/links.service.ts` | Erstellen und Auflösen von Kurzlinks. |
| `apps/backend/src/admin/logs/admin-logs.service.ts` | Aufbereitung von Backend- und Frontend-Logs für das Admin-Panel. |
| `apps/backend/prisma/schema.prisma` | Datenmodell für Nutzer, Codes, Dateien, Bins, Links, Mails, Reports und Admin-Funktionen. |
| `apps/frontend/src/services/CryptoService.ts` | Clientseitige Verschlüsselungsfunktionen für Dateien. |
| `apps/frontend/src/services/BinCrypto.ts` | Verschlüsselungsfunktionen für Bins. |
| `apps/frontend/src/routes/AppRoutes.tsx` | Routing der React-Applikation. |
| `docker-compose.yaml` | Lokale Infrastruktur für MariaDB, Redis und MinIO. |

---

## 17 Literaturverzeichnis

| Nr. | Quelle |
| :-- | :----- |
| [1] | Projektinitialisierungsantrag «redbox», `docs/projekt_redbox.md` |
| [2] | Studie «redbox», `docs/studie1_1.md` |
| [3] | Konzeptbericht «redbox», `docs/2_1_Konzeptbericht_redbox_v2.md` |
| [4] | Realisierungsbericht «redbox», `docs/3_1_Realisierungsbericht_redbox.md` |
| [5] | NestJS Documentation, https://docs.nestjs.com |
| [6] | React Documentation, https://react.dev |
| [7] | Prisma Documentation, https://www.prisma.io/docs |
| [8] | MinIO Documentation, https://min.io/docs |
| [9] | Cloudflare Email Routing Documentation, https://developers.cloudflare.com/email-routing/ |
| [10] | MDN Web Crypto API, https://developer.mozilla.org/docs/Web/API/Web_Crypto_API |

---

## 18 Glossar

| Begriff | Erklärung |
| :------ | :-------- |
| Invite Code | Einmaliger Einladungscode, mit dem neue Nutzer ein Konto erstellen können. |
| JWT | JSON Web Token, das nach dem Login zur Authentifizierung von API-Anfragen verwendet wird. |
| MinIO | Selbst gehosteter, S3-kompatibler Objektspeicher für Dateien, Mail-Inhalte und Anhänge. |
| AES-GCM | Verschlüsselungsverfahren, das für vertrauliche und integritätsgeschützte Datenablage eingesetzt wird. |
| Prisma | ORM und Migrationswerkzeug für den strukturierten Zugriff auf MariaDB. |
| Cloudflare Email Routing | Dienst, der eingehende E-Mails für eine Domain annimmt und an redbox weiterleitet. |

---

## 19 Anhang

Der Anhang besteht aus den bereits erstellten Projektdokumenten im `docs`-Verzeichnis:

- `docs/projekt_redbox.md`
- `docs/studie1_1.md`
- `docs/2_1_Konzeptbericht_redbox_v2.md`
- `docs/3_1_Realisierungsbericht_redbox.md`

Bei einer gedruckten Abgabe wird zusätzlich das vorgegebene gelbe Deckblatt ergänzt. Kopf- und Fusszeile, Seitennummerierung und Bindung werden gemäss Vorgaben des Qualifikationsverfahrens vorgenommen.
