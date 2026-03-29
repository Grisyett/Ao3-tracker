# 🏗️ AO3 Tracker - Documentación de Arquitectura

## Descripción General

AO3 Tracker es una extensión de navegador que rastrea actualizaciones de fanfics en Archive of Our Own (AO3) con un enfoque de **Privacidad Total**. Ningún dato de usuario se almacena en servidores externos: todos los datos viven en el ecosistema personal de Google del usuario.

**Versión Actual:** 1.5

---

## Arquitectura del Sistema

El proyecto utiliza una **arquitectura descentralizada de tres capas** con estrategia de sincronización híbrida:

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAVEGADOR DEL USUARIO                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Extensión Chrome (Frontend)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  content_   │  │   ui_logic  │  │   background    │   │  │
│  │  │  script.js  │  │     .js     │  │      .js        │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  │         │                │                  │             │  │
│  │         └────────────────┼──────────────────┘             │  │
│  │                          │                                │  │
│  │            ┌─────────────▼─────────────┐                  │  │
│  │            │   chrome.storage.local    │                  │  │
│  │            │   (Almacenamiento Local)  │                  │  │
│  │            └───────────────────────────┘                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS Fetch (GET/POST)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ECOSISTEMA GOOGLE                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Google Apps Script (Middleware)            │   │
│  │  ┌──────────────────────┐    ┌──────────────────────┐   │   │
│  │  │  script_engine.js    │    │ script_puente_doGet  │   │   │
│  │  │  (Motor Principal)   │    │ (API para Usuario)   │   │   │
│  │  │  - Parsing Gmail     │    │ - doGet (sync)       │   │   │
│  │  │  - Email regex       │    │ - doPost (acciones)  │   │   │
│  │  │  - Actualiz. Hojas   │    │ - Consolidac. Datos  │   │   │
│  │  └──────────────────────┘    └──────────────────────┘   │   │
│  │              │                          │                │   │
│  │              └──────────┬───────────────┘                │   │
│  │                         ▼                                │   │
│  │         ┌──────────────────────────────┐                 │   │
│  │         │     Google Sheets            │                 │   │
│  │         │     - Data (BD global)       │                 │   │
│  │         │     - Seguimiento (usuario)  │                 │   │
│  │         └──────────────────────────────┘                 │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              ▲                                    │
│                              │                                    │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │                    Gmail (Parser de Emails)              │   │
│  │         Emails de Notificación AO3 → Extracción Regex    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Desglose de Componentes

### 1. Frontend (Extensión Chrome)

**Tecnología:** Vanilla JavaScript + Alpine.js (versión compatible con CSP)

#### Estructura de Archivos

| Archivo | Tipo | Responsabilidad |
|---------|------|-----------------|
| `manifest.json` | Configuración | Metadatos de extensión, permisos, content scripts, recursos web accesibles |
| `content_script.js` | Script | Inyección DOM, renderizado UI, scraper de metadata AO3, botones seguir/leer |
| `ui_logic.js` | Script | Gestión de datos reactivos Alpine.js, estado de sync, funciones globales |
| `background.js` | Service Worker | Sync incremental (5 min), sync backup (hourly), notificaciones, actualizaciones badge |
| `interfaz/style.css` | Hoja de Estilos | Estilos de extensión con soporte de temas (rojo para notificaciones, verde para seguidos) |
| `interfaz/notificaciones.html` | Plantilla | Lista de notificaciones con bindings Alpine.js |
| `interfaz/seguidos.html` | Plantilla | Lista de fics seguidos con seguimiento de progreso |
| `interfaz/configuracion.html` | Plantilla | Página de configuración de URL de Web App |
| `interfaz/configuracion.js` | Script | Manejo y validación del formulario de configuración |
| `libs/alpine.csp.js` | Biblioteca | Framework reactivo (build compatible con CSP) |

#### Responsabilidades Clave

- **Inyección de UI:** Inyecta dropdown tracker en la barra de navegación de AO3 (`ul.primary.navigation.actions`)
- **Scraping de Metadata:** Extrae título, autor, fandom, rating, warnings, ships, sumario, conteo de capítulos desde páginas AO3 vía fetch + DOMParser
- **Almacenamiento Local:** Usa `chrome.storage.local` para acceso instantáneo a datos y capacidad offline
- **Sistema Badge:** Contador visual en el ícono de la extensión mostrando actualizaciones no leídas (tiempo real vía `chrome.storage.onChanged`)
- **Actualizaciones en Tiempo Real:** Escucha eventos de sync en segundo plano (mensaje `refrescar_interfaz_ao3`)
- **Página de Configuración:** Abre `interfaz/configuracion.html` vía `chrome.tabs.create()`
- **Visibilidad Dinámica de Botones:** Botones Seguir/Dejar de seguir y Marcar como Leído solo aparecen cuando es apropiado

---

### 2. Middleware (Google Apps Script)

**Rol:** Backend serverless que procesa notificaciones de Gmail y expone API a la extensión

#### Arquitectura de Dos Scripts

**A. script_engine.js (Motor Principal)**
- Library ID: `1gy3mpZP4tfJT9pzuH_J3dAtyGnNyUbmNXDPVHPW6o_JnY3bv8JodWERz`
- Contiene lógica principal para parsing de Gmail y gestión de hojas
- Funciones:
  - `procesarNotificacionesAO3()`: Escanea Gmail en busca de emails de AO3, extrae metadata vía regex
  - `buscarYActualizar()`: Actualiza entradas de fic existentes en hojas
  - `insertarEnLaCima()`: Inserta fics nuevos en la parte superior de la hoja
  - `inicializarEstructuraDeHojas()`: Crea hojas Data y Seguimiento con encabezados
  - `prepararJSONMetadatos()`: Parsea HTML del email para extraer metadata de fic
  - `extraerSumario()`: Extrae y limpia texto de sumario desde HTML del email
  - `extraerCampoMultilinea()`: Extrae campos de metadata (fandom, rating, warnings, etc.)
 

**B. script_puente.js (Puente API para Usuario)**
- Requiere biblioteca: AO3_Engine_Core
- Expone endpoints HTTP para comunicación con extensión
- Funciones:
  - `doGet(e)`: Maneja solicitudes de sync desde la extensión
    - Soporta `?sync=full` para sync completo de backup
    - Soporta `?sync=incremental&since={timestamp}` para sync incremental
    - Filtra fics por timestamp de última sync para reducir transferencia de datos
    - Consolida datos desde ambas hojas Data y Seguimiento
    - Retorna JSON con array de fics y metadata de debug
  - `doPost(e)`: Maneja acciones de usuario desde la extensión
    - `action: "marcar_seguido"`: Agrega/actualiza fic en hoja Seguimiento
    - `action: "dejar_de_seguir"`: Elimina fic de hoja Seguimiento
    - `action: "actualizar_progreso"`: Actualiza columna "Leídos" (J) con último capítulo leído
  - `mapearFilaAFic()`: Convierte fila de hoja a objeto fic
  - `onOpen()`: Crea menú personalizado "🚀 AO3 Tracker" en UI de Google Sheets
  - `onEdit()`: Actualiza timestamp cuando celdas son modificadas

#### Estrategia de Parsing de Gmail

```javascript
Query: from:do-not-reply@archiveofourown.org subject:"posted Chapter" is:unread after:2026/01/16

HTML del Email → Extracción Regex:
- Fic ID: /works\/(\d+)/
- URL Capítulo: /works\/(\d+)\/chapters\/\d+/
- Conteo palabras: /\((\d+)\s+words\)/gi (toma segundo match para palabras del capítulo)
- Campos metadata: /Fandoms?:\s*<\/b>\s*([\s\S]*?)(?=<br|\s*<b|<\/p)/i
- Sumario: /Summary:\s*<\/b>[\s\S]*?<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i
```

#### Configuración de Implementación

- **Tipo:** Aplicación Web
- **Ejecutar como:** Yo (propietario del script)
- **Quién tiene acceso:** Cualquiera (requerido para acceso de extensión)
- **Formato URL:** `https://script.google.com/macros/s/{ID_IMPLEMENTACION}/exec`

---

### 3. Base de Datos (Google Sheets)

**Estructura:** Dos hojas con esquema idéntico de 14 columnas (A-N)

| Columna | Campo | Tipo | Descripción |
|---------|-------|------|-------------|
| **A** | Fecha | Date | Detección de última actualización (auto-actualizado al editar) |
| **B** | Título | String | Título del fanfiction |
| **C** | Autor | String | Nombre del autor |
| **D** | Fandom | String | Categoría/fandom principal |
| **E** | Ship | String | Relaciones/parejas |
| **F** | FicId | String | Identificador único de obra AO3 |
| **G** | URL | String | Enlace al último capítulo |
| **H** | Capítulo | String | Total de capítulos (ej: "10/10" o "4/?") |
| **I** | Palabras | Number | Conteo de palabras del capítulo actual |
| **J** | Leídos | Number | Último capítulo marcado como leído por el usuario |
| **K** | Pendientes | Formula | Auto-calculado: `=H{fila}-J{fila}` |
| **L** | Rating | String | Clasificación de contenido (G, T, M, E, etc.) |
| **M** | Warnings | String | Advertencias de contenido AO3 |
| **N** | Sumario | String | Resumen de la historia (texto limpio) |

#### Roles de Hojas

**Hoja Data (Base de Datos Global)**
- 
- Poblada automáticamente desde parsing de Gmail
- Contiene todos los fics para los que el usuario ha recibido emails de AO3
- Fuente de verdad para enriquecimiento de metadata

**Hoja Seguimiento (Lista de Seguidos del Usuario)**

- Poblada manualmente cuando usuario hace clic en "Seguir en Tracker"
- Contiene solo fics que el usuario sigue explícitamente
- Rastrea progreso de lectura (columna Leídos)
- Puede ser enriquecida con metadata desde hoja Data

---

## Flujo de Datos

### Proceso de Sincronización Híbrida (Cada 5 minutos)

```
1. background.js dispara alarma (periodInMinutes: 5)
       │
       ▼
2. Determinar tipo de sync:
   ├─ Incremental (11 de 12 syncs): ?sync=incremental&since={lastSyncTimestamp}
   │  └─ Solo obtener fics actualizados desde última sync
   │
   └─ Backup Completo (cada 12da sync = 1 hora): ?sync=full&since=0
      └─ Obtener todos los fics de ambas hojas
       │
       ▼
3. Fetch desde URL de Web App de Google Apps Script
       │
       ▼
4. Google Apps Script (doGet):
   ├─ Leer hoja Data → filtrar por timestamp (si es incremental)
   ├─ Leer hoja Seguimiento → filtrar por timestamp (si es incremental)
   ├─ Consolidar en objeto ficsConsolidados (por ficId)
   └─ Retornar JSON: { fics: [...], debug: {...} }
       │
       ▼
5. background.js procesa respuesta:
   ├─ Limpiar números de capítulo (remover "/", manejar fechas → "1*")
   │
   ├─ Actualizar "misSeguidos" silenciosamente:
   │  ├─ Solo actualizar fics que ya están siendo seguidos
   │  ├─ Nuevo capítulo: mover al inicio + establecer isUpdated=true + timestamp=ahora
   │  └─ Cambio de metadata: actualizar en lugar + establecer isUpdated=true
   │
   ├─ Procesar notificaciones:
   │  ├─ Fic nuevo (no está en eliminadosIds): agregar a notificaciones
   │  ├─ Resurrección (en eliminadosIds + cap > 0): agregar + eliminar de blacklist
   │  ├─ Nuevo capítulo: mover al inicio + leido=false + isUpdated=true
   │  └─ Solo metadata: actualizar en lugar + isUpdated=true
   │
   └─ Ordenar seguidos por timestamp (más reciente primero)
       │
       ▼
6. Actualizar chrome.storage.local:
   ├─ misNotificaciones (máx 50 elementos)
   ├─ misSeguidos (ordenado por timestamp)
   ├─ eliminadosIds (blacklist)
   └─ lastSyncTimestamp (para próxima sync incremental)
       │
       ▼
7. Actualizar contador badge vía listener chrome.storage.onChanged
       │
       ▼
8. Enviar mensaje de refresco a content script (refrescar_interfaz_ao3)
```

### Flujo de Interacción de Usuario

```
Usuario hace clic en dropdown "Tracker AO3"
       │
       ▼
UI carga desde plantillas interfaz/*.html vía fetch
       │
       ▼
Alpine.js inicializa datos reactivos trackerApp
       │
       ▼
Acciones de usuario:
├─ Seguir fic nuevo (content_script.js):
│  ├─ Hacer scraping de metadata desde página AO3 vía fetch + DOMParser
│  ├─ Agregar a misSeguidos (unshift → aparece al inicio)
│  ├─ POST a Web App: { action: "marcar_seguido", ... }
│  └─ Inyectar botón "Marcar como Leído" inmediatamente
│
├─ Marcar como leído (ui_logic.js):
│  ├─ Actualizar ultimoLeido en misSeguidos
│  └─ POST a Web App: { action: "actualizar_progreso", ficId, ultimoLeido }
│
├─ Eliminar fic (ui_logic.js):
│  ├─ Eliminar de misSeguidos o misNotificaciones
│  ├─ Si está seguido: POST a Web App: { action: "dejar_de_seguir" }
│  └─ Si es notificación: agregar a blacklist eliminadosIds
│
└─ Navegar (Alpine.js):
   ├─ navNotificaciones() → cargarInterfaz('notificaciones')
   ├─ navSeguidos() → cargarInterfaz('seguidos')
   └─ navConfig() → chrome.runtime.sendMessage('open_config')
       │
       ▼
Listeners chrome.storage.onChanged disparan auto-refresco de UI
       │
       ▼
Badge se actualiza en tiempo real (content_script.js + background.js)
```

### Lógica de Visibilidad de Botones

**Botón Seguir (inyectarBotonSeguir):**
- Solo aparece en páginas `/works/{ficId}`
- Color: Verde (#2b580c) si no sigue, Rojo (#900) si sigue
- Texto: "Seguir en Tracker" o "Dejar de seguir"
- Al hacer clic: alterna estado de seguido, inyecta botón de lectura si está siguiendo

**Botón Marcar como Leído (inyectarBotonMarcarLectura):**
- Solo aparece si el fic está en misSeguidos
- Solo aparece en páginas `/works/{ficId}`
- Color: Rojo (#900) si no marcado, Gris (#444) si ya marcado
- Texto: "Marcar cap. X como leído" o "Cap. X leído ✓"
- Eliminado inmediatamente si el usuario deja de seguir el fic

---

## Esquema de Almacenamiento

### Claves de `chrome.storage.local`

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `webAppUrl` | String | URL de Web App de Google Apps Script (requerida para sync) |
| `misNotificaciones` | Array[] | Lista de notificaciones (máx 50 elementos, ordenado por más reciente primero) |
| `misSeguidos` | Array[] | Lista de fics seguidos (ordenado por timestamp, más reciente primero) |
| `eliminadosIds` | String[] | Blacklist de IDs de fics eliminados/descartados |
| `lastSyncTimestamp` | Number | Timestamp Unix de última sync (para sync incremental) |

### Estructura de Objeto Fic

```javascript
{
  ficId: string,          // ID de obra AO3 (identificador único)
  titulo: string,         // Título del fanfiction
  autor: string,          // Nombre del autor
  fandom: string,         // Categoría de fandom
  ship: string,           // Relaciones/parejas
  rating: string,         // Clasificación de contenido (G, T, M, E, etc.)
  warnings: string,       // Advertencias de contenido AO3
  sumario: string,        // Resumen de la historia (texto limpio, sin HTML)
  capitulo: string,       // Capítulo actual (ej: "10", "4/?", "1*")
  url: string,            // URL del capítulo
  palabras: number,       // Conteo de palabras
  leido: boolean,         // Estado de lectura (solo notificaciones)
  ultimoLeido: number,    // Número de último capítulo leído (solo seguidos)
  fechaRegistro: string,  // Fecha de registro (string local)
  timestamp: number,      // Timestamp Unix para ordenamiento (más reciente primero)
  isUpdated: boolean      // True cuando se detecta nuevo capítulo (dispara borde rojo)
}
```

---

## Decisiones Clave de Diseño

### Arquitectura Primero Privacidad

- **Sin servidores externos:** Todos los datos de usuario almacenados en la propia cuenta de Google del usuario
- **Local-first:** La extensión funciona offline con datos en caché
- **Controlado por usuario:** Los usuarios poseen su base de datos (Google Sheet)


### Estrategia de Sync Híbrida

- **Sync incremental (cada 5 min):** Solo obtiene fics actualizados desde última sync
  - Reduce transferencia de datos y tiempo de respuesta de API
  - Usa `lastSyncTimestamp` para filtrar resultados del lado del servidor
- **Sync completo de backup (cada hora):** Obtiene todos los fics de ambas hojas
  - Asegura consistencia de datos y recuperación desde corrupción
  - Reinicia contador de sync para siguiente ciclo de hora

### Normalización de Número de Capítulo

```javascript
if (capRaw.includes("/")) {
    capLimpio = capRaw.split("/")[0].trim();  // "4/?" → "4"
} else if (capRaw.includes("-") || capRaw.includes(":") || capRaw.length > 5) {
    capLimpio = "1*";  // Tipo fecha o inválido → marcador provisional
} else {
    capLimpio = capRaw || "1*";
}
```

### Sistema de Blacklist

- Notificaciones eliminadas se agregan a `eliminadosIds`
- Previene reaparición de fics intencionalmente descartados
- Automáticamente eliminado si el fic recibe actualización de nuevo capítulo (resurrección)
- Fics en blacklist NO se agregan a `misSeguidos` durante sync

### Ordenamiento Basado en Timestamp

- Fics seguidos nuevos usan `unshift()` para aparecer al inicio inmediatamente
- Proceso de sync agrega `timestamp: Date.now()` a fics actualizados
- `misSeguidos` ordenado por timestamp (más reciente primero) antes de mostrar
- Asegura ordenamiento consistente entre sesiones y dispositivos

### Indicadores Visuales de Actualización

- **Borde rojo** (clase `is-new`): 3px sólido #900 cuando `isUpdated=true`
- **Desvanecimiento a 5 segundos:** Animación CSS desvanece borde a normal (1px sólido #ddd)
- **Bandera isUpdated:** Automáticamente eliminada después de 5 segundos vía timeout en ui_logic.js
- **Notificaciones:** Borde aparece en detección de nuevo capítulo o fic nuevo
- **Seguidos:** Borde aparece solo en detección de nuevo capítulo

### Enriquecimiento de Metadata

Cuando se sigue un fic, el sistema prioriza datos de Google Sheets sobre datos scrapeados:
1. Verificar hoja Data para metadata existente (título, autor, fandom, etc.)
2. Verificar hoja Seguimiento para progreso existente (ultimoLeido)
3. Usar datos de Excel si está disponible y no vacío, fallback a datos scrapeados
4. Asegura consistencia entre sesiones y enriquece scrapes incompletos

---

## Historial de Versiones

| Versión | Estado | Características Clave |
|---------|--------|----------------------|
| 1.5 | Actual | Sync incremental, rotación de backup, ordenamiento por timestamp, indicadores de borde rojo, badge en tiempo real, resurrección de blacklist, enriquecimiento de metadata |
| 1.4 | Anterior | Sync cada 5 min, página de configuración, scraping de metadata completo, parsing de Gmail |
| 1.3 | Beta | Sync básico, notificaciones, sistema de seguidos |

---

## Dependencias de Archivos

```
manifest.json
├── background.js (service_worker, module)
│   ├── chrome.alarms → sync cada 5 min
│   ├── chrome.storage.onChanged → actualizarBadge()
│   ├── chrome.runtime.onMessage → sync_now, open_config
│   └── Fetch → script_puente_doGet.js (?sync=...)
│
├── content_scripts (https://archiveofourown.org/*)
│   ├── libs/alpine.csp.js → Framework reactivo
│   ├── ui_logic.js (run_at: document_end)
│   │   ├── setupTrackerApp() → Alpine.data('trackerApp', ...)
│   │   ├── actualizarProgresoLectura() → función global
│   │   ├── registrarComponenteAlpine() → registro de componente Alpine
│   │   └── chrome.storage.onChanged → auto-refresco de UI
│   └── content_script.js (run_at: document_end)
│       ├── cargarInterfaz() → carga plantillas HTML vía fetch
│       ├── inyectarBase() → inyecta botón dropdown tracker
│       ├── scrapearDatosFic() → fetch + DOMParser para metadata
│       ├── inyectarBotonSeguir() → lógica botón seguir/dejar de seguir
│       ├── inyectarBotonMarcarLectura() → botón marcar leído (condicional)
│       ├── actualizarContadorEnPagina() → actualización badge inline
│       └── chrome.runtime.onMessage → refrescar_interfaz_ao3
│
├── interfaz/style.css
│   ├── .fic-notif-item.is-new → borde rojo (3px sólido #900)
│   ├── .fic-notif-item.fade-border.is-new → animación de desvanecimiento
│   └── .tema-seguidos anula temas → esquema de color verde (#580c0c)
│
└── web_accessible_resources
    ├── interfaz/*.html (notificaciones, seguidos, configuracion)
    ├── interfaz/*.css (style.css, seguidos.css)
    ├── ui_logic.js
    └── libs/alpine.csp.js
```

---

## Resumen de Comportamiento de UI

### Fics Seguidos (`seguidos.html`)

| Acción | Comportamiento |
|--------|---------------|
| Seguir fic nuevo | Aparece al **inicio** de lista (unshift) + timestamp=ahora |
| Nuevo capítulo detectado | Mueve al **inicio** + **borde rojo** (5 seg) + timestamp=ahora |
| Actualización de metadata | Actualiza en lugar + **borde rojo** (5 seg) + timestamp=ahora |
| Marcar como leído | Actualiza `ultimoLeido`, botón muestra "Cap. X leído ✓" |
| Dejar de seguir | Elimina de lista + elimina botón de lectura inmediatamente |

### Notificaciones (`notificaciones.html`)

| Acción | Comportamiento |
|--------|---------------|
| Fic nuevo detectado | Aparece al **inicio** + **borde rojo** (5 seg) + leido=false |
| Nuevo capítulo detectado | Mueve al **inicio** + **borde rojo** (5 seg) + leido=false |
| Resurrección (fic eliminado con nuevo capítulo) | Eliminado de blacklist + agregado al inicio + borde rojo |
| Marcar como leído | Establece `leido=true`, opacidad cae a 0.6 |
| Eliminar | Elimina de lista + agrega a blacklist `eliminadosIds` |

---

## Menú Personalizado (Google Sheets)

Al abrir la Google Sheet, los usuarios ven un menú personalizado "🚀 AO3 Tracker":

| Ítem de Menú | Función | Descripción |
|--------------|---------|-------------|
| 1. Inicializar Tablas (14 cols) | celdas() | Crea hojas Data y Seguimiento con encabezados |
| 2. Sincronizar Gmail ahora | ejecutarSincronizacion() | Trigger manual para parsing de Gmail |
| 3. Activar Rastreo Automático | activarRastreoDiezMinutos() | Crea trigger basado en tiempo (cada 10 min) |

---

**Licencia:** MIT  
**Mantenedor:** [Griyo](https://github.com/Grisyett)  
**Última Actualización:** Marzo 2026
