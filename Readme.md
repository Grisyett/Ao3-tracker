# 🚀 AO3 Tracker (Edición Griyo)

**Versión:** 1.5 | **Estado:** Estable

Una extensión de navegador diseñada para rastrear actualizaciones de fanfics en **Archive of Our Own (AO3)** con un enfoque de **Privacidad Total**. Tus datos permanecen en tu cuenta personal de Google: sin servidores externos, sin bases de datos de terceros.

![Menú de Notificaciones](./img/Captura.PNG)
*Dropdown de notificaciones integrado en la navegación de AO3*

![Base de Datos Google Sheet](./img/Googlesheet.PNG)
*Tu base de datos personal en Google Sheet con actualizaciones automáticas*

![Código Google Apps Script](./img/appscript.PNG)
*Backend serverless ejecutándose en Google Apps Script*

---

## ✨ Características

### Para Lectores

- **Notificaciones en tiempo real:** Recibe notificaciones cuando tus fics seguidos se actualicen (sincronización cada 5 minutos)
- **Contador Badge Inteligente:** Indicador visual que muestra actualizaciones no leídas, integrado en el menú de AO3
- **Seguimiento de Progreso de Lectura:** Marca capítulos como leídos y ve tu progreso de un vistazo
- **Sistema de Seguidos:** Rastrea fics específicos separadamente de las notificaciones generales
- **Detección de Resurrección:** Detecta automáticamente cuando fics "muertos" reciben nuevos capítulos
- **Enriquecimiento de Metadata:** Obtiene información completa (fandom, ship, rating, warnings, sumario) desde tu Google Sheet

### Privacidad y Control

- **Almacenamiento 100% Local:** Todos los datos guardados en `chrome.storage.local` de tu navegador
- **Tu Propia Base de Datos:** Google Sheet que posees y controlas
- **Sin Servidores Externos:** Todo se ejecuta en la infraestructura de Google bajo tu cuenta
- **Funciona Offline:** La extensión trabaja sin internet usando datos en caché
- **Código Abierto:** Todo el código visible y auditable en GitHub

### Sincronización Inteligente

- **Sincronización Incremental:** Solo descarga fics actualizados (ahorra ancho de banda y tiempo)
- **Backup Hourly:** Sincronización completa cada hora para asegurar consistencia de datos
- **Parsing Automático de Gmail:** Lee emails de notificación de AO3 y extrae metadata
- **Resolución de Conflictos:** El número de capítulo más reciente siempre gana

---

## 🛠️ Instalación (Paso a Paso)

Para que el tracker funcione de forma autónoma y esté siempre disponible "en la nube", configuraremos un motor personal en tu cuenta de Google.

### 1. El Excel (Base de Datos y Motor)
No necesitas programar el backend. Copia la **Plantilla Maestra** que ya incluye la estructura de tablas y el motor lógico.

*Nota: Para el rastreo automático, asegúrate de estar suscrito a las actualizaciones de tus fics en AO3 y que lleguen a tu bandeja de entrada del correo que usaste para copiar la hoja de calculo.*

1. **Copia la Plantilla:** Haz clic en [este enlace de la Plantilla Maestra](https://docs.google.com/spreadsheets/d/1vd1UlqOvEnscoWE-wfRHKgdQ4kEA2wov4RUTmCEJoJU/edit?usp=sharing) y selecciona `Archivo > Hacer una copia`.
2. **Accede al Script:** En tu nueva copia de Excel, ve a `Extensiones > Apps Script`. Allí verás el código que gestiona la lógica.

3. **Configuración de codigo puente:**
    - Ve a biblioteca, copia y busca este ID de la biblioteca: `1gy3mpZP4tfJT9pzuH_J3dAtyGnNyUbmNXDPVHPW6o_JnY3bv8JodWERz`
    - Asegurese de usar la ultima versión disponible.
    - Copie y reemplace el codigo que trae por defecto al copiar la hoja de calculo por el **codigo puente** que lo puede encontrar en: `script_puente.js`
    - Ejecute por primera vez usando la funcion `onOpen` seleccionandolo en el select al lado del boton de Depuración y autorice los permisos solicitados **(Aparecera el aviso de que no es seguro pero no te preocupes por eso, es un aviso porque como tal no esta verificada por google, pero el codigo base y lo que hace lo puedes verificar en el repositorio)**
    - Seleccione en **Configuración Avanzada** y luego a **Ir a AO3_Engine_Core** acepte los permisos.
    - Revisa que ahora tengas una nueva opción en la hoja de calculo llamada **🚀 AO3 Tracker**

4. **Configuración de la API:** - Haz clic en el botón azul **Implementar > Nueva implementación**.
   - Selecciona Tipo: **Aplicación web**.
   - Configura **"Ejecutar como":** `Yo` (tu cuenta).
   - Configura **"Quién tiene acceso":** `Cualquiera`. *(Esto permite que tu extensión envíe datos a tu hoja).*
5. **Copia la URL:** Guarda la URL de la aplicación web que termina en `/exec`.




### Paso 2: Instalar la Extensión de Chrome

1. **Descargar la Extensión**
   - Clona este repositorio o descarga como ZIP y extrae
   - O descarga la última release desde la [página de Releases](link-a-releases)

2. **Cargar en Chrome**
   - Abre Chrome y ve a `chrome://extensions/`
   - Activa el **Modo desarrollador** (interruptor en la esquina superior derecha)
   - Haz clic en **Cargar sin empaquetar**
   - Selecciona la carpeta que contiene los archivos de la extensión
   - La extensión ahora debería aparecer en tu lista de extensiones

3. **Configurar la Extensión**
   - Ve a cualquier página de AO3 (ej: https://archiveofourown.org)
   - Deberías ver un nuevo elemento de menú: **Tracker AO3** en la barra de navegación superior
   - Haz clic → haz clic en **⚙️ Config**
   - Pega la **URL de la Aplicación Web** que copiaste anteriormente
   - Haz clic en **Guardar y Vincular**
   - La extensión se sincronizará inmediatamente con tu Google Sheet

---

## 📋 Cómo Usar

### Seguir un Fic

1. Navega a cualquier página de fic en AO3 (ej: `https://archiveofourown.org/works/12345`)
2. Busca el botón **Seguir en Tracker** (verde) debajo del título del fic
3. Haz clic: el botón cambia a **Dejar de seguir** (rojo)
4. Aparece un nuevo botón **Marcar como leído** en la barra de feedback
5. El fic ahora se agrega a tu lista **Seguidos** y se rastrea en tu Google Sheet

### Marcar Capítulos como Leídos

1. Cuando leas un capítulo de un fic seguido, busca la barra de feedback debajo del texto del capítulo
2. Haz clic en **Marcar cap. X como leído** (botón rojo)
3. El botón cambia a **Cap. X leído ✓** (gris con checkmark)
4. Tu progreso se guarda localmente y se sincroniza con tu Google Sheet

### Ver Notificaciones

- Haz clic en **Tracker AO3** en la barra de navegación superior
- El dropdown muestra actualizaciones de fics nuevos y notificaciones de capítulos
- Haz clic en **Detalles** para ver fandom, ship, rating, warnings y sumario
- Haz clic en **Marcar** para marcar como leído (la opacidad disminuye a 0.6)
- Haz clic en **Quitar** para descartar (agrega a la lista negra)

### Ver Fics Seguidos

- Haz clic en **Tracker AO3** → pestaña **Seguidos**
- Ve todos los fics que estás siguiendo con el capítulo actual y progreso de lectura
- Los fics con nuevos capítulos aparecen arriba con un borde rojo (se desvanece después de 5 segundos)
- El indicador de progreso muestra: `Leído: X` y `Y pdt.` (capítulos pendientes) o `✓ Al día` (actualizado)

---

## 🏗️ Arquitectura Técnica

### Diseño de Tres Capas

```
┌─────────────────────────────────────────┐
│  Extensión Chrome (Frontend)            │
│  - Vanilla JS + Alpine.js               │
│  - chrome.storage.local                 │
└─────────────────────────────────────────┘
              │
              │ HTTPS (GET/POST)
              ▼
┌─────────────────────────────────────────┐
│  Google Apps Script (Middleware)        │
│  - Parsing de Gmail (regex)             │
│  - Consolidación de hojas               │
│  - API doGet / doPost                   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Google Sheets (Base de Datos)          │
│  - Hoja Data (global)                   │
│  - Hoja Seguimiento (usuario)           │
│  - 14 columnas (A-N)                    │
└─────────────────────────────────────────┘
```

### Esquema de Base de Datos (14 Columnas)

| Columna | Campo | Descripción |
|---------|-------|-------------|
| **A** | Fecha | Último timestamp de actualización |
| **B** | Título | Nombre del fic |
| **C** | Autor | Nombre del autor |
| **D** | Fandom | Categoría principal de fandom |
| **E** | Ship | Relaciones/parejas |
| **F** | FicId | ID de obra de AO3 (único) |
| **G** | URL | Enlace al último capítulo |
| **H** | Capítulo | Total de capítulos (ej: "10/10") |
| **I** | Palabras | Conteo de palabras |
| **J** | Leídos | Último capítulo marcado como leído (progreso del usuario) |
| **K** | Pendientes | Fórmula: `=H-K` (auto-calculado) |
| **L** | Rating | Clasificación de contenido (G, T, M, E) |
| **M** | Warnings | Advertencias de contenido de AO3 |
| **N** | Sumario | Resumen de la historia |

---

## 🔧 Desarrollo

### Prerrequisitos

- Cuenta de Google con acceso a Google Sheets y Apps Script
- Navegador Chrome (o navegador basado en Chromium con soporte de extensiones)
- Conocimiento básico de JavaScript y Google Apps Script

### Estructura del Proyecto

```
Ao3 tracker/
├── manifest.json           # Configuración de la extensión
├── background.js           # Service worker (sync, badges, notificaciones)
├── content_script.js       # Inyección DOM, scraping, botones
├── ui_logic.js             # Gestión de datos reactivos Alpine.js
 (parsing Gmail)
├── script_puente_doGet.js  # Puente API de Apps Script (doGet/doPost)
├── interfaz/
│   ├── style.css           # Estilos principales (tema rojo)
│   ├── seguidos.css        # Estilos de fics seguidos (tema verde)
│   ├── notificaciones.html # Plantilla de notificaciones
│   ├── seguidos.html       # Plantilla de fics seguidos
│   ├── configuracion.html  # Página de configuración
│   └── configuracion.js    # Lógica de configuración
├── libs/
│   └── alpine.csp.js       # Build CSP-compliant de Alpine.js
└── img/                    # Capturas de pantalla para documentación
```

### Probar Cambios

1. **Frontend (Extensión)**
   - Haz cambios en archivos JS/CSS/HTML
   - Ve a `chrome://extensions/`
   - Haz clic en el ícono de refrescar en la tarjeta de la extensión AO3 Tracker
   - Recarga cualquier página de AO3 para ver los cambios

2. **Backend (Apps Script)**
   - Haz cambios en el editor de Apps Script
   - Haz clic en **Implementar → Gestionar implementaciones**
   - Edita la implementación existente (ícono de lápiz)
   - Establece **Versión:** Nueva versión
   - Haz clic en **Implementar**
   - Los cambios surten efecto inmediatamente

### Depuración

- **Consola de la Extensión:** Abre página AO3 → F12 → Consola (busca logs de `[Background]`, `[Sync]`, `[Content Script]`)
- **Logs de Apps Script:** Editor de Apps Script → Ejecuciones (barra lateral izquierda)
- **Inspección de Hojas:** Revisa manualmente las hojas Data y Seguimiento para verificar integridad de datos

---

## 🔒 Seguridad y Privacidad

### Qué Datos Se Almacenan

- **Solo metadata pública de AO3:** Títulos, autores, fandoms, ships, ratings, warnings, sumarios, conteos de capítulos
- **Tu progreso de lectura:** Qué capítulos has marcado como leídos
- **Tu lista de fics seguidos:** Qué fics estás rastreando

### Qué NO Se Almacena

- Tus credenciales de inicio de sesión de AO3
- Tu dirección de correo electrónico o información personal
- Cualquier historial de navegación más allá de AO3
- Cualquier dato en servidores de terceros (solo tu cuenta de Google)

### Permisos Explicados

| Permiso | Por qué es Necesario |
|---------|---------------------|
| `storage` | Guardar datos de fics y configuración localmente |
| `alarms` | Sincronización en segundo plano cada 5 minutos |
| `notifications` | Mostrar notificaciones de escritorio (función futura) |
| `action` | Contador badge en el ícono de la extensión |
| `host_permissions: archiveofourown.org` | Inyectar UI y hacer scraping de metadata |
| `host_permissions: script.google.com` | Comunicarse con la API de tu Google Sheet |

---

## 📝 Solución de Problemas

### La Extensión No Aparece

- Asegúrate de estar en una página de AO3 (ej: `https://archiveofourown.org`)
- Revisa `chrome://extensions/` para asegurar que la extensión está habilitada
- Intenta recargar la página de AO3 (F5 o Ctrl+R)

### La Sincronización No Funciona

1. Verifica que tu URL de Aplicación Web esté correctamente configurada en la configuración
2. Verifica que la URL termine con `/exec`
3. Revisa la implementación de Apps Script:
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquiera
4. Revisa los logs de ejecución de Apps Script en busca de errores

### Los Fics No Se Actualizan

- Asegúrate de estar suscrito a actualizaciones de fics en AO3 (para recibir emails)
- Ejecuta **🚀 AO3 Tracker → 2. Sincronizar Gmail ahora** manualmente
- Verifica que los emails de notificación estén en tu bandeja de entrada de Gmail (no en spam/papelera)

### El Contador Badge No Se Actualiza

- El badge se actualiza cuando se completa la sincronización
- Revisa la consola del navegador en busca de errores de sync
- Intenta hacer clic en el dropdown para activar una sync manual

---

## 🗺️ Roadmap

- [ ] Notificaciones de escritorio cuando se detecten nuevos capítulos
- [ ] Exportar/importar datos (backup JSON)
- [ ] Intervalos de sync personalizados (configurable por usuario)
- [ ] Tema de modo oscuro
- [ ] Panel de estadísticas (fandoms más leídos, autores, etc.)
- [ ] Soporte para navegadores móviles (Firefox, Safari)

---

## 📄 Licencia

**Licencia MIT** - Siéntete libre de usar, modificar y distribuir como lo consideres apropiado.

---

## 🙏 Agradecimientos

- **Equipo de AO3:** Por crear una plataforma increíble y enviar emails de notificación útiles
- **Alpine.js:** Por el framework reactivo ligero y compatible con CSP
- **Google:** Por proporcionar infraestructura serverless gratuita vía Apps Script

---

**Creado por:** [Griyo](https://github.com/Grisyett)  
**Para:** Lectores de fanfiction que quieren nunca perderse un capítulo  
**Filosofía:** Tus datos te pertenecen a ti, no a corporaciones

*¡Feliz lectura! 📚*
