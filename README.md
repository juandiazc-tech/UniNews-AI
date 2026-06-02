# UniNews AI

Dashboard frontend para noticias universitarias colombianas clasificadas por IA.  
Desarrollado para [Divergency AI](mailto:divergencyai@gmail.com).

## Stack

- HTML5 · CSS3 · JavaScript ES Modules (sin build step)
- [Tailwind CSS CDN](https://cdn.tailwindcss.com) con tokens de marca Divergency AI
- Fuentes: Montserrat · Nunito · Poppins (Google Fonts)
- Backend: n8n + PostgreSQL + Groq (`llama-3.3-70b-versatile`)
- Deploy: Firebase Hosting

## Cómo correrlo

ES Modules requieren un origen HTTP — no abre directo con `file://`.

```bash
# VS Code — extensión Live Server (clic derecho → Open with Live Server)
npx serve .          # → http://localhost:3000
python -m http.server 8080  # → http://localhost:8080
npx firebase serve   # → http://localhost:5000 (igual al deploy)
```

## Deploy a producción

```bash
npx firebase deploy --only hosting
```

## Estructura

```
UniNews_AI/
├── index.html              # Shell: layout, Tailwind config, overlays
├── css/
│   ├── brand.css           # Tokens de color, fuente y sombra de Divergency AI
│   └── styles.css          # Scrollbars, loaders, dark mode, animaciones
├── js/
│   ├── api.js              # fetch a los 4 endpoints del backend
│   └── app.js              # estado, renderizado, filtros, búsqueda, chat
└── assets/images/          # Logos e ícono de Divergency AI
```

## Backend

Base URL: `https://n8n.divergencyai.cloud/webhook/`  
Sin autenticación. CORS abierto (`Access-Control-Allow-Origin: *`).

| Endpoint | Método | Qué hace | Tiempo |
|---|---|---|---|
| `/dai-noticias` | GET | Todas las noticias de la BD | rápido |
| `/uninews-search` | POST | Busca cualquier universidad en internet y guarda en BD | 8–15 s |
| `/dai-scrape` | POST | Scraping de una universidad del catálogo | 30–90 s |
| `/dai-chat` | POST | Pregunta a Groq; el backend obtiene su propio contexto de la BD | 2–4 s |

Ver [srs.md](srs.md) para el contrato completo.

## Universidades del catálogo

| Universidad | Código |
|---|---|
| Corporación Unificada Nacional | CUN |
| UNAD | UNAD |
| EAFIT | EAFIT |
| Observatorio Universitario Colombia | Observatorio |

Las universidades buscadas via `/uninews-search` se agregan dinámicamente a la BD y aparecen en el panel tras la búsqueda.

## Funcionalidades

- **Buscador libre** — escribe cualquier universidad colombiana, el backend la busca en internet y guarda las noticias en la BD (Javeriana, Andes, EAN, etc.)
- **Filtros rápidos** — por universidad del catálogo, categoría y relevancia (100% local, sin re-fetch)
- **Cards de noticias** — badge de categoría, dot de relevancia, resumen IA y enlace al artículo original
- **Actualizar** — dispara scraping de una universidad del catálogo y recarga noticias
- **Chat IA** — pregunta en lenguaje natural sobre el ecosistema universitario colombiano
- **Dark mode** — persiste en `localStorage`
