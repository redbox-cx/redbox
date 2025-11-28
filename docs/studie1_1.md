# redbox
## Studie
<br>

#### Projektübersicht
| Name               | Value                                  |
| ------------------ | -------------------------------------- |
| **Projektname**    | redbox                                 |
| **Projektleiter**  | Noel Kohn                              |
| **Auftraggeber**   | gibb                                   |
| **Autoren**        | Noel Kohn, Henry R. Schellenberg, Maksym Shepetko |
| **Klassifizierung**| Intern                                 |
| **Status**         | In Arbeit                              |

#### Änderungskontrolle
| Version | Datum        | Beschreibung, Bemerkung | Name oder Rolle |
| :------ | :----------- | :---------------------- | :-------------- |
| 1.0     | 28.11.2025   | Ersterstellung Studie   | Noel Kohn       |

### Inhalt
- [1 - Situationsanalyse](#1---situationsanalyse)
  - [1.1 - Ausgangslage](#11---ausgangslage)
  - [1.2 - Stärken](#12---stärken)
  - [1.3 - Schwächen](#13---schwächen)
- [2 - Ziele](#2---ziele)
  - [2.1 - Rahmenbedingungen](#21---rahmenbedingungen)
  - [2.2 - Abgrenzung](#22---abgrenzung)
- [3 - Anforderungen](#3---anforderungen)
- [4 - Lösungsvarianten](#4---lösungsvarianten)
  - [4.1 - Variantenübersicht](#41---variantenübersicht)
  - [4.2 - Beschreibung der Varianten](#42---beschreibung-der-varianten)
- [5 - Bewertung der Varianten (Tabelle)](#5---bewertung-der-varianten-tabelle)
- [6 - Lösungsbeschreibung](#6---lösungsbeschreibung)
- [7 - Projektplanung](#7---projektplanung)
- [8 - Empfehlung](#8---empfehlung)
- [9 - Projektfreigabe](#9---projektfreigabe)

---
### 1 - Situationsanalyse
#### 1.1 - Ausgangslage

In der heutigen digitalen Landschaft werden persönliche Daten oft als Währung betrachtet. Grosse Technologiekonzerne bieten kostenlose Dienste an, bezahlen dies jedoch mit der Privatsphäre der Nutzer. Für Journalisten, Aktivisten und datenschutzbewusste Personen gibt es kaum Plattformen, die eine vertrauenswürdige Kommunikation und Datenspeicherung garantieren, ohne dass Metadaten analysiert oder an Dritte verkauft werden.

Das Projektteam verfügt bereits über die notwendige Hardware (Mini-PC, i7 7th Gen, 8GB RAM), eine Domain (redbox.cx) sowie fundierte Web-Kenntnisse, um eine unabhängige Lösung zu schaffen.

#### 1.2 - Stärken

-   **Datenschutz:** Durch das Hosting auf eigener Hardware (Homeserver) liegen die Daten nicht bei unkontrollierbaren Drittanbietern (ausgenommen Cloudflare für Mail-Routing).
-   **Kosteneffizienz:** Die benötigte Infrastruktur ist bereits vorhanden.
-   **Fokus:** Konzentration auf Kernfunktionen ohne unnötige «Bloatware»-Ballast.

#### 1.3 - Schwächen

-   **S1 (Fehlende Software):** Es existiert aktuell keine einsatzbereite Plattform auf dem Server. Das Team muss die Lösung von Grund auf in sehr kurzer Zeit (5 Tage) entwickeln ("Greenfield Project").
-   **S2 (Ausfallsicherheit):** Da die Infrastruktur auf einem einzelnen Homeserver (Mini-PC) basiert, gibt es keine Redundanz. Bei Stromausfall oder Hardwaredefekt im privaten Haushalt ist der Dienst nicht erreichbar (im Gegensatz zu Cloud-Anbietern).
-   **S3 (Netzwerk-Anbindung):** Die Anbindung erfolgt über einen privaten Internetanschluss. Dies kann zu Problemen mit dynamischen IP-Adressen oder geringerer Bandbreite im Vergleich zu Rechenzentren führen.
-   **S4 (Wartungsaufwand):** Im Gegensatz zu "Managed Services" liegt die gesamte Verantwortung für Sicherheitsupdates (OS, Docker, Applikation) beim Projektteam.

---

### 2 - Ziele

Die Ziele für unser Projekt "redbox" leiten sich primär aus der in der Situationsanalyse identifizierten Problemstellung und den genannten Schwachpunkten ab. Die Formulierung der Zielsetzungen erfolgt gemäss den SMART-Kriterien (Spezifisch, Messbar, Attraktiv, Realistisch, Terminiert), um deren Überprüfbarkeit bei Projektende zu gewährleisten.

**Systemziele**

| Nr. | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Priorität |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------- |
| 1   | **Bereitstellung einer Webplattform**, die **keine Nutzerdaten an Dritte weitergibt** und **technische Logs auf ein absolutes Minimum reduziert**, um maximale Privatsphäre zu gewährleisten. <br> _(Messbar durch: Audit der Datenspeicherung und Log-Konfigurationen, Bestätigung der Nicht-Weitergabe bei Projektabschluss. Adressiert S1, S3)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | M         |
| 2   | Die **Webapplikation** muss flüssig und **ohne spürbare Verzögerung** funktionieren, wobei Ladezeiten für Kernfunktionen **unter 1 Sekunde im internen Netz** und **unter 3 Sekunden extern** liegen. <br> _(Messbar durch: Performance-Tests (Benchmarking) bei Projektabschluss. Adressiert S3)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | M         |
| 3   | Ein **voll funktionsfähiger Mail-Service (Senden/Empfangen)** über ein Webinterface, **sicherer File-Upload** und ein **Pastebin** stehen zur Verfügung. <br> _(Messbar durch: Erfolgreiche Testläufe und Funktionalitätsprüfung aller drei Kernkomponenten bis Projektabschluss. Adressiert S1)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | M         |
| 4   | Der Zugang zur Plattform ist durch ein **Invite-Code-System ("Red Codes")** beschränkt, um **Spam und Missbrauch vollständig auszuschliessen**. <br> _(Messbar durch: Erfolgreiche Implementierung des Invite-Code-Systems und Test der Zugangsrestriktion. Adressiert S1)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | M         |
| 5   | Die **Benutzeroberfläche** ist intuitiv bedienbar und lenkt nicht vom Wesentlichen ab, was durch eine Bewertung von **mindestens 80% der Testnutzer als "gut" oder "sehr gut"** in Bezug auf Benutzerfreundlichkeit bestätigt wird. <br> _(Messbar durch: Usability-Tests und Umfragen bei Testnutzern bis zum Ende der Finalisierungsphase.)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 1         |

*Legende: Priorität: M=Muss /1=hoch, 2=mittel, 3=tief*

**Vorgehensziele (Projektziele)**

| Nr. | Beschreibung                                                                                                                                                                             | Priorität |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------- |
| 6   | **Erfolgreiche Entwicklung** und **Deployment** der "redbox"-Plattform innerhalb des definierten Zeitrahmens von 5 Tagen Projektzeit + 1 Tag Vorbereitung.                               | M         |
| 7   | **Aufbau von praktischem Wissen** im Team hinsichtlich der Implementierung datenschutzfokussierter Webdienste sowie der Integration von E-Mail-, Datei-Upload- und Pastebin-Funktionalitäten.               | 1         |

---

#### 2.1 - Rahmenbedingungen

Das Projekt "redbox" wird unter den folgenden Rahmenbedingungen durchgeführt, die den Kontext und die Grenzen der Projektdurchführung definieren:

**Zeitlicher Rahmen:**
Das Projekt hat einen sehr engen Zeitrahmen:
*   **5 Tage** dedizierte Projektzeit in der gibb.
*   **1 Tag** für die Vorbereitung.

**Räumlich / Infrastruktur:**
Die zentrale Infrastruktur für das Hosting und die Entwicklung ist bereits vorhanden:
*   **Hardware:** Ein Mini-PC (Intel i7 7th Gen, 8GB RAM) dient als Homeserver für das Hosting der redbox-Anwendung.
*   **Domain:** Die Domain `redbox.cx` ist bereits registriert.
*   **Betriebssystem:** Linux (Ubuntu Server oder Debian / Proxmox mit Docker) wird für den Homeserver verwendet.

**Administrativ / Werkzeuge:**
Die Projektentwicklung und der Betrieb werden durch folgende Tools und Technologien unterstützt:
*   **Backend:** Nest.js für die API-Logik.
*   **Datenbank:** SQLite oder MongoDB (lokal) für Benutzerdaten und Metadaten der Uploads.
*   **Frontend:** React für die Benutzeroberfläche.
*   **Containerisierung:** Docker zur Paketierung und Bereitstellung der Anwendung.
*   **Mail-Routing:** Cloudflare Email Routing wird für den Empfang von E-Mails integriert.
*   **Git:** Für Code-Management und Zusammenarbeit.
*   **VSCode:** Als Entwicklungsumgebung.

**Organisatorisch:**
Das Projekt wird vom genannten Projektteam (Noel Kohn, Henry R. Schellenberg, Maksym Shepetko) unter der Leitung von Noel Kohn durchgeführt.

**Projektmethode:**
Für die Durchführung des Projekts wird die agile SCRUM-Methode verwendet.

---

#### 2.2 - Abgrenzung

Vorerst werden keine umfangreichen Cloud-Services oder erweiterte Kollaborationstools implementiert. Der Fokus liegt strikt auf den Kernfunktionen:

*   **Keine umfangreichen Cloud-Services:** Kalender, Adressbücher, Video-Chats oder erweiterte Kollaborationstools werden nicht implementiert.
*   **Kein Video- oder Audio-Chat:** Die Kommunikation beschränkt sich auf Textnachrichten über den Mail-Client.
*   **Fokus auf Kernfunktionen:** Die Entwicklung konzentriert sich ausschliesslich auf den **Mail-Client (Webinterface)**, **File Upload (temporär/sicher)** und **Pastebin (temporäre Textspeicherung)**.

---

### 3 - Anforderungen

Die folgenden Anforderungen, formuliert als User Stories, beschreiben, welche Funktionen und Eigenschaften die Lösung "redbox" erfüllen muss, um die in Punkt 2 genannten Systemziele zu erreichen. Jede User Story ist einem oder mehreren Zielen zugeordnet.

| Nr. | User Story                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Abgedecktes Ziel (Nr.) |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| A1  | **Als neuer Nutzer** möchte ich mich nur mit einem **gültigen Invite-Code** registrieren können, **damit der Zugang zur Plattform limitiert ist und Spam/Missbrauch ausgeschlossen wird**.                                                                                                                                                                                                                                                                                                                                           | 4                      |
| A2  | **Als Nutzer** möchte ich **E-Mails über das Webinterface lesen und versenden** können, **damit ich meine Kommunikation zentral und datenschutzfreundlich verwalten kann**.                                                                                                                                                                                                                                                                                                                                                          | 1, 3                   |
| A3  | **Als Nutzer** möchte ich **Dateien sicher hochladen und abrufen** können, sowie **Texte in einem Pastebin sicher speichern und abrufen** können, **damit ich vertrauliche Inhalte temporär und geschützt teilen kann**.                                                                                                                                                                                                                                                                                                              | 1, 3                   |
| A4  | **Als Nutzer** erwarte ich, dass die Anwendung **auf dem vorhandenen Homeserver performant läuft** (trotz 8GB RAM), **damit ich eine flüssige und reaktionsschnelle Nutzung ohne spürbare Verzögerungen erleben kann**.                                                                                                                                                                                                                                                                                                                   | 2                      |
| A5  | **Als Nutzer** erwarte ich, dass **keine Tracker, Analytics-Tools oder externen Werbenetzwerke** in die Plattform eingebunden sind, **damit meine Privatsphäre vollständig respektiert wird und meine Daten nicht missbraucht werden**.                                                                                                                                                                                                                                                                                                | 1                      |
| A6  | **Als Nutzer** möchte ich eine **"Clean" und reaktionsschnelle Benutzeroberfläche** vorfinden, **damit ich mich auf meine Aufgaben konzentrieren kann und ein angenehmes Nutzererlebnis habe**.                                                                                                                                                                                                                                                                                                                                         | 5                      |
| A7  | **Als Betreiber** möchte ich **Zugriff auf Server-Logs** haben, die System-Events und Fehler protokollieren, aber **keine personenbezogenen Daten** enthalten, **damit ich die Stabilität der Plattform überwachen kann, ohne die Privatsphäre der Nutzer zu gefährden**.                                                                                                                                                                                                                                                           | 1, 2                   |
| A8  | **Als Betreiber** möchte ich **Invite-Codes generieren und verwalten** können, **damit ich den Zugang zur Plattform kontrollieren und neue vertrauenswürdige Nutzer einladen kann**.                                                                                                                                                                                                                                                                                                                                               | 4                      |
| A9  | **Als Betreiber** möchte ich **Datenschutzrichtlinien und Nutzungsbedingungen** klar definieren und kommunizieren können, **damit die Transparenz über den Umgang mit Daten jederzeit gewährleistet ist**.                                                                                                                                                                                                                                                                                                                            | 1                      |

---
### 4 - Lösungsvarianten

Um die Ziele des Projekts "redbox" zu erreichen, wurden verschiedene Lösungsansätze für das Hosting und die Software-Architektur in Betracht gezogen. Die Varianten konzentrieren sich darauf, wie der Datenschutz und die Funktionalität unter den gegebenen Rahmenbedingungen am besten gewährleistet werden können.

#### 4.1 - Variantenübersicht

| Variante          | Beschreibung                                                                                                                             |
| :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Variante 1: Self-Hosted Custom Stack** | Eigenentwicklung der Software, gehostet auf dem vorhandenen Mini-PC zuhause. Volle Kontrolle über Hard- und Software.   |
| **Variante 2: Cloud VPS Hosting**        | Mieten eines virtuellen Servers (z.B. bei Hetzner/DigitalOcean) und Installation von Open-Source Software (z.B. Nextcloud). |
| **Variante 3: SaaS-Aggregation**         | Bau eines Frontends, das im Hintergrund bestehende APIs (Gmail API, Dropbox API) nutzt, aber "privat" aussieht.           |

---
#### 4.2 - Beschreibung der Varianten

In diesem Abschnitt werden die im vorherigen Kapitel vorgestellten Lösungswege detaillierter erläutert.

**Variante 1: Self-Hosted Custom Stack**

-   **Konzept:** Wir nutzen den vorhandenen i7 Mini-PC als dedizierten Homeserver. Das Backend wird mit Nest.js von Grund auf neu entwickelt, um massgeschneiderte Funktionen (Mail, Upload, Paste) genau nach den spezifischen Anforderungen zu liefern. Frontend-Entwicklung erfolgt mit React.
-   **Vorteile:** Volle Kontrolle über die gesamte Hard- und Software-Infrastruktur. Maximale Datenhoheit und Anpassbarkeit. Keine monatlichen Kosten ausser Strom- und Internetanschluss.
-   **Nachteile:** Höherer Initialaufwand für Entwicklung und Wartung. Abhängigkeit von der Stabilität der Heiminfrastruktur (Internet, Strom).

**Variante 2: Cloud VPS Hosting**

-   **Konzept:** Anstatt den eigenen Mini-PC zu nutzen, wird ein virtueller Server (Virtual Private Server, VPS) bei einem kommerziellen Anbieter (z.B. Hetzner oder DigitalOcean) gemietet. Darauf wird Open-Source Software (z.B. Nextcloud) installiert und konfiguriert, um die gewünschten Funktionen bereitzustellen.
-   **Vorteile:** Bessere physikalische Sicherheit und garantierte Uptime durch professionelles Rechenzentrum. Weniger Wartungsaufwand für die Hardware.
-   **Nachteile:** Daten liegen bei einem Drittanbieter, was die Datenhoheit beeinträchtigt und dem Kernziel des Datenschutzes entgegensteht. Monatliche Kosten für den VPS. Standardsoftware wie Nextcloud kann überladen sein ("Bloat") und ist auf günstigen Instanzen oft langsamer.

**Variante 3: SaaS-Aggregation**

-   **Konzept:** Bei dieser Variante würde ein eigenes Frontend entwickelt, das im Hintergrund bestehende APIs von grossen SaaS-Anbietern (z.B. Gmail API, Dropbox API) nutzt. Das Frontend würde ein "privates" Aussehen simulieren, während die eigentliche Datenverarbeitung und -speicherung bei den Drittanbietern erfolgt.
-   **Vorteile:** Sehr einfacher und schneller Entwicklungsaufwand, da die Kernfunktionalitäten von externen Diensten bereitgestellt werden. Geringer Wartungsaufwand für die Backend-Infrastruktur.
-   **Nachteile:** Verfehlt das Ziel des Datenschutzes und der Datenhoheit komplett, da die Daten schlussendlich wieder bei grossen Technologiekonzernen liegen würden. Keine Kontrolle über die Metadaten.

---

### 5 - Bewertung der Varianten (Tabelle)

Die Bewertung der Lösungsansätze erfolgt anhand der definierten Kriterien, um eine fundierte Entscheidung für die Projektumsetzung zu treffen. Die Gewichtung der Kriterien reflektiert deren Bedeutung für den Projekterfolg von "redbox".

| Kriterium               | Gewichtung | Variante 1 (Self-Hosted Custom Stack) | Variante 2 (Cloud VPS Hosting) | Variante 3 (SaaS-Aggregation) |
| :---------------------- | :--------- | :------------------------------------ | :----------------------------- | :---------------------------- |
| **Datenschutz / Privacy** | 5          | 5 (25)                                | 3 (15)                         | 1 (5)                         |
| **Kosten**              | 3          | 5 (15)                                | 3 (9)                          | 2 (6)                         |
| **Performance**         | 4          | 4 (16)                                | 5 (20)                         | 3 (12)                        |
| **Erfüllung Anforderungen**| 5          | 5 (25)                                | 3 (15)                         | 2 (10)                        |
| **Gesamtpunkte**        |            | **81**                                | **59**                         | **33**                        |

*Legende der Punkte: 5 (sehr gut), 4 (gut), 3 (mittel), 2 (schlecht), 1 (sehr schlecht)*
*Legende der Gewichtung: 5 (sehr wichtig), 4 (wichtig), 3 (eher wichtig), 2 (weniger wichtig), 1 (trivial)*

**Entscheid:** **Variante 1 (Self-Hosted Custom Stack)** wird gewählt. Sie bietet die einzige wirkliche Garantie für Privatsphäre und Datenhoheit, was ein Kernziel des Projekts ist. Zudem nutzt sie die vorhandenen Ressourcen optimal und ermöglicht eine massgeschneiderte Erfüllung der Anforderungen. Die Nachteile in Bezug auf den höheren Entwicklungsaufwand und die Abhängigkeit von der Heiminfrastruktur werden durch die Vorteile im Datenschutz und der Kosteneffizienz übertroffen.

---
### 6 - Lösungsbeschreibung

Die Lösung "redbox" wird als **Self-Hosted Custom Stack** (Variante 1) auf der vorhandenen Hardware umgesetzt. Dies gewährleistet die volle Kontrolle über Daten und Infrastruktur, was für die Kernziele Datenschutz und Anonymität unerlässlich ist.

## Systemarchitektur

Die Lösung "redbox" basiert auf einer klassischen Client-Server-Architektur mit folgenden Komponenten:

*   **Hardware:** Ein Mini-PC (Intel i7 7th Gen, 8GB RAM) dient als Homeserver. Dieser ist der physische Ort, an dem alle Dienste laufen.
*   **Betriebssystem:** Auf dem Mini-PC läuft Linux (z.B. Ubuntu Server oder Debian), um Stabilität und Sicherheit zu gewährleisten. Docker wird für die Containerisierung der Anwendungen verwendet.
*   **Backend:** Ein massgeschneidertes Backend, entwickelt mit **Nest.js**, dient als zentrale API-Logik. Es verwaltet die Benutzerauthentifizierung (Invite-Codes), die Verzeichnisstrukturen für Datei-Uploads und die Speicherung der Pastebin-Einträge.
*   **Datenbank:** Eine lokale Datenbank (z.B. SQLite oder MongoDB) wird für die Speicherung von Benutzerdaten (Hashwerte von Passwörtern, Invite-Codes) und Metadaten der Uploads sowie Pastebin-Einträge verwendet.
*   **Mail-Service:** Der E-Mail-Empfang wird über **Cloudflare Email Routing** abgewickelt, um die tatsächliche IP-Adresse des Homeservers zu verschleiern und Spam zu filtern. Der E-Mail-Versand erfolgt über ein SMTP-Relay oder eine API, das über den eigenen Web-Client angesprochen wird.
*   **Frontend:** Eine **React-basierte Single-Page Application (SPA)** bildet das Webinterface, über das die Nutzer auf alle Funktionen (Mail, Upload, Pastebin) zugreifen.

## Funktionsweise

1.  **Login & Registrierung:**
    *   Neue Benutzer können sich nur mit einem gültigen, vom Administrator generierten "Red Code" registrieren. Dies stellt sicher, dass der Zugang zur Plattform kontrolliert ist und Missbrauch vorgebeugt wird.
    *   Bestehende Benutzer loggen sich über ein Web-Login ein, um Zugriff auf das Dashboard zu erhalten.

2.  **Dashboard:**
    *   Nach dem Login gelangen die Nutzer auf ein zentrales Dashboard, von dem aus sie auf die drei Hauptfunktionen zugreifen können: Mail, File Upload und Pastebin.

3.  **Mail-Client:**
    *   Über das Webinterface können E-Mails empfangen und versendet werden. Der Mail-Client kommuniziert mit dem Backend, welches die Interaktion mit dem SMTP-Relay für den Versand und das Abrufen über Cloudflare oder einen IMAP-Proxy für den Empfang steuert.

4.  **Datenhaltung:**
    *   **Dateien:** Hochgeladene Dateien werden lokal auf dem Homeserver in verschlüsselten Verzeichnissen abgelegt.
    *   **Pastebin:** Temporäre Textspeicherungen werden in der lokalen Datenbank abgelegt.
    *   **Nutzerdaten:** Benutzerkonten (Benutzernamen, Passwort-Hashes, Invite-Codes) werden ebenfalls in der lokalen Datenbank gespeichert. Es werden keine unnötigen personenbezogenen Daten erfasst oder gespeichert.

## Abdeckung der Anforderungen

| Nr. | Anforderung                             | Abdeckung durch gewählte Lösung                                                                           |
|----:|-----------------------------------------|------------------------------------------------------------------------------------------------------------|
| A1  | Invite-Code Registrierung               | Ja. Das Backend verwaltet Red Codes; Frontend bietet die entsprechende Eingabemaske.                      |
| A2  | E-Mails lesen & versenden               | Ja. Frontend bietet Web-Client; Backend integriert SMTP/Cloudflare.                                      |
| A3  | Sichere Datei-Uploads & Pastebin        | Ja. Backend verwaltet Speicherung; Dateien/Texte werden lokal verschlüsselt gespeichert.                |
| A4  | Performante Ausführung auf Mini-PC      | Ja. Nest.js/React im Docker-Container sind ressourcenschonend; System ist auf minimale Hardware ausgelegt. |
| A5  | Keine Tracker/Werbenetzwerke            | Ja. Eigenentwicklung ohne Drittanbieter-Code, Server-Hosting in Eigenregie.                              |
| A6  | "Clean" & reaktionsschnelle Oberfläche  | Ja. React SPA ermöglicht modernes, schnelles UI ohne Neuladen.                                           |
| A7  | Anonymisierte Server-Logs               | Ja. Logging-Konfiguration im Backend sorgt für Minimalismus und Anonymität.                              |
| A8  | Invite-Code Generierung/Verwaltung      | Ja. Administrative Funktionen im Backend für den Betreiber.                                                |
| A9  | Datenschutzrichtlinien transparent      | Ja. Dokumentation und klare Kommunikation sind Teil des Projekts.                                          |

---
### 7 - Projektplanung

Der folgende Zeitplan skizziert die Hauptphasen als Sprints für die Umsetzung des Projekts "redbox". Jeder Sprint zielt darauf ab, ein funktionierendes Inkrement des Produkts zu liefern. Der Plan basiert auf dem vorgegebenen Zeitrahmen von 5 Tagen Projektzeit + 1 Tag Vorbereitung.

**Gesamtübersicht:**
*   **Vorbereitung:** 1 Tag
*   **Projektzeit:** 5 Tage
*   **Gesamtteam:** 3 Personen (Noel Kohn, Henry R. Schellenberg, Maksym Shepetko)

| Phase / Fokus   | Tag | Hauptaufgaben (Backend & Frontend)                                                                                                              |
| :-------------- | :-- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Initialisierung** | 0   | Erstellung PIA, Studie, Grobkonzept Design; Aufgabenverteilung; Docker-Basis vorbereiten.                                                      |
| **Setup & Core**| 1   | Server aufsetzen (OS, Docker, Node.js); Domain DNS Config (Cloudflare); Git Repo erstellen; **Backend-API für Auth, Invite-Codes, User-Verwaltung.** |
| **Backend Logik**| 2   | Entwicklung der **API für Upload-Logik und Pastebin-Speicherung**; Datenbank-Design finalisieren (SQLite/MongoDB).                               |
| **Frontend & Mail**| 3   | Design des UI (Dashboard); Anbindung des **Mail-Empfangs und -Versands** im Frontend.                                                          |
| **Integration** | 4   | **Zusammenführung von Front- & Backend**; Implementierung der **Pastebin-Funktionalität** im UI; Erste **Security Checks**.                       |
| **Finalisierung** | 5   | **Testing, Bugfixing**; Dokumentation abschliessen; Vorbereitung der Präsentation.                                                              |

---

### 8 - Empfehlung

Das Projekt "redbox" sollte zwingend in der **Variante 1 (Self-Hosted Custom Stack)** umgesetzt werden. Diese Entscheidung basiert auf einer detaillierten Abwägung der Kriterien Datenschutz, Kosten, Performance und der Erfüllung der Kernanforderungen.

Der entscheidende Vorteil dieser Variante liegt in der **vollständigen Datenhoheit und Transparenz**, da die gesamte Infrastruktur auf dem eigenen Homeserver betrieben wird. Dies adressiert die kritischen Schwachpunkte bestehender Dienste, wie fehlende Transparenz und Datenmissbrauch durch Dritte. Obwohl der initiale Entwicklungsaufwand höher ist, ermöglicht dieser Ansatz eine massgeschneiderte und schlanke Lösung, die genau auf die Bedürfnisse einer datenschutzbewussten Zielgruppe zugeschnitten ist.

Mit der vorhandenen Infrastruktur (Mini-PC, Domain) und dem Know-how des Teams kann "redbox" eine performante und wirklich sichere Alternative für Journalisten, Aktivisten und Privacy-Enthusiasten werden, die eine vertrauenswürdige Plattform für Mail, File-Uploads und temporäre Textspeicherung suchen.

---
### 9 - Projektfreigabe

Hiermit wird die Freigabe des Projekts "redbox" zur Umsetzung gemäss der beschriebenen Studie und der gewählten Variante 1 beantragt und bestätigt.

---