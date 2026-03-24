# 🏗️ AO3 Tracker - Architecture Documentation

## Overview

AO3 Tracker is a browser extension that tracks fanfiction updates on Archive of Our Own (AO3) with a **Total Privacy** approach. No user data is stored on external servers.

---

## System Architecture

The project uses a **three-layer decentralized architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Chrome Extension (Frontend)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  content_   │  │   ui_logic  │  │   background    │   │  │
│  │  │  script.js  │  │     .js     │  │      .js        │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  │         │                │                  │             │  │
│  │         └────────────────┼──────────────────┘             │  │
│  │                          │                                │  │
│  │            ┌─────────────▼─────────────┐                  │  │
│  │            │   chrome.storage.local    │                  │  │
│  │            │      (Local Storage)      │                  │  │
│  │            └───────────────────────────┘                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS Fetch
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE ECOSYSTEM                             │
│  ┌─────────────────────┐         ┌─────────────────────────┐   │
│  │   Google Apps Script│         │    Google Sheets        │   │
│  │   (Middleware)      │────────►│      (Database)         │   │
│  │   - Web App URL     │         │   - 14 Columns (A-N)    │   │
│  │   - Serverless API  │         │   - Formulas injected   │   │
│  └─────────────────────┘         └─────────────────────────┘   │
│                              ▲                                  │
│                              │                                  │
│  ┌───────────────────────────┴──────────────────────────────┐  │
│  │                    Gmail (Email Parser)                  │  │
│  │         AO3 Notification Emails → Regex Extraction       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Frontend (Chrome Extension)

**Technology:** Vanilla JavaScript + Alpine.js (CSP-compliant version)

#### Files Structure

| File | Type | Responsibility |
|------|------|----------------|
| `manifest.json` | Config | Extension metadata, permissions, content scripts |
| `content_script.js` | Script | DOM injection, UI rendering, scraper de metadata AO3 |
| `ui_logic.js` | Script | Alpine.js reactive data management, sync con Google Sheets |
| `background.js` | Service Worker | Background sync (5 min), notifications, badge updates, open config |
| `interfaz/style.css` | Stylesheet | Extension styling |
| `interfaz/*.html` | Templates | UI components (notifications, settings, followed) |
| `interfaz/configuracion.js` | Script | Configuración de Web App URL |
| `libs/alpine.csp.js` | Library | Reactive framework (CSP-compliant) |

#### Key Responsibilities

- **UI Injection:** Injects tracker button into AO3 navigation bar (`ul.primary.navigation.actions`)
- **Metadata Scraping:** Extracts title, author, fandom, rating, warnings, ships, summary from AO3 pages
- **Local Storage:** Uses `chrome.storage.local` for instant data access
- **Badge System:** Visual counter on extension icon showing unread updates
- **Real-time Updates:** Listens for background sync events (`refrescar_interfaz_ao3`)
- **Config Page:** Opens `interfaz/configuracion.html` via `chrome.tabs.create()`

---

### 2. Middleware (Google Apps Script)

**Role:** Serverless backend that processes Gmail notifications

#### Functions

- Parses AO3 email notifications using **Regex**
- Extracts metadata: Fic IDs, chapters, summaries, authors
- Updates Google Sheets database automatically
- Exposes Web App API endpoint for extension sync

#### Configuration

- **Library ID:** `1gy3mpZP4tfJT9pzuH_J3dAtyGnNyUbmNXDPVHPW6o_JnY3bv8JodWERz`
- **Deployment:** Web App running as "Me", accessible by "Anyone"

---

### 3. Database (Google Sheets)

**Structure:** 14-column table (A-N)

| Column | Field | Type | Description |
|--------|-------|------|-------------|
| **A** | Fecha | Date | Last update detection |
| **B** | Título | String | Fanfiction title |
| **C** | Autor | String | Author name |
| **D** | Fandom | String | Main category |
| **E** | Ship | String | Relationships/pairings |
| **F** | FicId | String | AO3 unique identifier |
| **G** | URL | String | Link to latest chapter |
| **H** | Capítulo | String | Total chapters (e.g., "10/10") |
| **I** | Palabras | Number | Word count of current chapter |
| **J** | Leídos | Number | Last chapter marked as read by user |
| **K** | Pendientes | Formula | Auto-calculated: `H - J` |
| **L** | Rating | String | Content rating |
| **M** | Warnings | String | AO3 content warnings |
| **N** | Sumario | String | Story summary |

---

## Data Flow

### Sync Process (Every 5 minutes)

```
1. background.js alarm triggers (periodInMinutes: 5)
       │
       ▼
2. Fetch from Google Apps Script Web App URL (?sync=full)
       │
       ▼
3. Receive JSON with fic updates
       │
       ▼
4. Process updates:
   - Update "misSeguidos" silently (metadata changes)
   - Filter out deleted/blacklisted fics
   - Detect new chapters
   - "Resurrect" fics with new content (cap > ultimoLeido)
       │
       ▼
5. Update chrome.storage.local (misNotificaciones, misSeguidos, eliminadosIds)
       │
       ▼
6. Update badge counter (unread count)
       │
       ▼
7. Send refresh message to content script (refrescar_interfaz_ao3)
```

### User Interaction Flow

```
User clicks "Tracker AO3" button
       │
       ▼
UI loads from interfaz/*.html templates
       │
       ▼
Alpine.js initializes reactive data
       │
       ▼
User actions (mark read, delete, navigate)
       │
       ▼
Update chrome.storage.local
       │
       ▼
UI auto-refreshes via Alpine.js reactivity
```

---

## Storage Schema

### `chrome.storage.local` Keys

| Key | Type | Description |
|-----|------|-------------|
| `webAppUrl` | String | Google Apps Script Web App URL |
| `misNotificaciones` | Array[] | Notification list (max 50 items) |
| `misSeguidos` | Array[] | Followed fics list |
| `eliminadosIds` | String[] | Blacklist of deleted fic IDs |

### Notification Object Structure

```javascript
{
  ficId: string,          // AO3 work ID
  titulo: string,         // Title
  autor: string,          // Author
  fandom: string,         // Fandom category
  ship: string,           // Relationships/pairings
  rating: string,         // Content rating
  warnings: string,       // AO3 content warnings
  sumario: string,        // Story summary
  capitulo: number,       // Current chapter number
  url: string,            // Chapter URL
  leido: boolean,         // Read status (notifications only)
  ultimoLeido: number,    // Last read chapter (followed only)
  fechaRegistro: string   // Registration date
}
```

---

## Key Design Decisions

### Privacy-First Architecture

- **No external servers:** All user data stored in user's own Google account
- **Local-first:** Extension works offline with cached data
- **User-controlled:** Users own their database (Google Sheet)

### Decentralized Sync

- **Polling-based:** 30-minute sync intervals via `chrome.alarms`
- **Stateless API:** Google Apps Script processes requests without storing state
- **Conflict resolution:** Latest chapter number always wins

### Blacklist System

- Deleted notifications are added to `eliminadosIds`
- Prevents re-appearing of intentionally dismissed fics
- Automatically removed if fic receives new chapter update

---

## Extension Points

### For Developers

1. **Custom Google Sheets:** Modify column mappings in Apps Script
2. **Sync interval:** Change `periodInMinutes` in `background.js`
3. **UI themes:** Edit `interfaz/style.css`
4. **Additional permissions:** Update `manifest.json`

### For Users

1. **Web App URL:** Configure in extension settings
2. **Notification limit:** Currently capped at 50 items
3. **Badge visibility:** Shows unread count on extension icon

---

## Security Considerations

- **CSP Compliance:** Uses Alpine.js CSP build for content scripts
- **Web App Permissions:** Google Apps Script set to "Anyone" (required for extension access)
- **No sensitive data:** Only public AO3 metadata is stored
- **User consent:** Explicit authorization required for Google Apps Script

---

## Version History

| Version | Status | Notes |
|---------|--------|-------|
| 1.4 | Current | Sync 5 min, config page, metadata scraping completo |
| 1.3 | Beta | Previous release |

---

## File Dependencies

```
manifest.json
├── background.js (service_worker, module)
│   ├── chrome.alarms (sync cada 5 min)
│   ├── chrome.storage.onChanged
│   └── chrome.runtime.onMessage (sync_now, open_config)
├── content_scripts (https://archiveofourown.org/*)
│   ├── libs/alpine.csp.js
│   ├── ui_logic.js
│   └── content_script.js
├── interfaz/style.css
└── web_accessible_resources
    ├── interfaz/*.html (notificaciones, seguidos, configuracion)
    ├── interfaz/*.css
    ├── ui_logic.js
    └── libs/alpine.csp.js
```

---

**License:** MIT  
**Maintainer:** [Griyo](https://github.com/Grisyett)
