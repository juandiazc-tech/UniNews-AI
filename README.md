# UniNews AI

Dashboard frontend para noticias universitarias clasificadas por IA.  
Desarrollado para [Divergency AI](mailto:divergencyai@gmail.com).

## Stack

- HTML5 · CSS3 · JavaScript (ES Modules, sin build step)
- [Tailwind CSS CDN](https://cdn.tailwindcss.com)
- Fuentes: Montserrat · Nunito · Poppins (Google Fonts)
- Backend: n8n + PostgreSQL + Groq (`llama-3.3-70b-versatile`)

## Cómo correrlo

Abrir `index.html` con un servidor local (requerido por ES Modules):

```bash
# VS Code — extensión Live Server (clic derecho → Open with Live Server)
# Python
python -m http.server 5500
# Node
npx serve .
```

Luego visitar `http://localhost:5500`.

> No funciona directo con `file://` porque los ES Modules requieren un origen HTTP.

## Estructura

```
UniNews_AI/
├── index.html              # Shell: layout, imports, Tailwind config
├── css/
│   ├── brand.css           # Tokens de color, fuente y sombra de Divergency AI
│   └── styles.css          # Scrollbars, loader, animaciones
├── js/
│   ├── api.js              # fetch a los 3 endpoints del backend
│   └── app.js              # estado, renderizado, event listeners
└── assets/images/          # Logos de Divergency AI
```

## Backend (ya existe)

Base URL: `https://n8n.divergencyai.cloud/webhook/`

| Endpoint | Método | Qué hace |
|---|---|---|
| `/dai-noticias` | GET | Devuelve todas las noticias (`?universidad=CUN`, `?categoria=Tecnologia`) |
| `/dai-scrape` | POST | Dispara scraping de una universidad (10–30 s) |
| `/dai-chat` | POST | Pregunta a Groq con las noticias visibles como contexto |

Sin autenticación en V1. Ver [srs.md](srs.md) para el contrato completo.

## Funcionalidades

- **Cards de noticias** con badge de categoría, dot de relevancia, resumen IA y enlace al artículo original
- **Filtros locales** por universidad y categoría (sin re-fetch)
- **Actualizar** — dispara scraping y recarga las noticias
- **Chat IA** — pregunta sobre las noticias visibles en pantalla (contexto dinámico post-filtro)
