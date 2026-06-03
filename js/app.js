import { fetchNoticias, triggerScrape, sendChat, searchUniversity } from './api.js';

// ── Estado ────────────────────────────────────────────────────────────────────
let allNoticias   = [];
let searchResults = null;   // null = modo normal; array = resultados de /uninews-search
let searchMeta    = null;   // { universidad, total }
let searchLoading = false;
let filters       = { categoria: '', universidad: '', keyword: '' };
let chatHistory   = [];
let chatLoading   = false;
const noticiaMap  = new Map();

// ── Colores (hex exactos según guía de producción) ────────────────────────
const CATEGORY_COLORS = {
  Convocatoria:  { bg: '#DBEAFE', text: '#1D4ED8' },
  Investigacion: { bg: '#DCFCE7', text: '#15803D' },
  Tecnologia:    { bg: '#FEF3C7', text: '#B45309' },
  Cultura:       { bg: '#FEE2E2', text: '#DC2626' },
  Deporte:       { bg: '#F1F5F9', text: '#475569' },
  Institucional: { bg: '#F3E8FF', text: '#7E22CE' },
  Obituario:     { bg: '#F1F5F9', text: '#475569' },
  'Política':    { bg: '#FEF3C7', text: '#B45309' },
  Otro:          { bg: '#F8FAFC', text: '#94A3B8' },
};

const RELEVANCE = {
  alta:  { color: '#22C55E', label: 'Alta' },
  media: { color: '#F59E0B', label: 'Media' },
  baja:  { color: '#94A3B8', label: 'Baja' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getVisibleNoticias() {
  const source = searchResults !== null ? searchResults : allNoticias;
  const kw = filters.keyword.trim().toLowerCase();
  const applyUniFilter = searchResults === null;
  return source.filter(n =>
    (!filters.categoria   || n.category        === filters.categoria) &&
    (!applyUniFilter || !filters.universidad || n.university_name === filters.universidad) &&
    (!kw || [n.title, n.ai_resume, n.resume, n.university_name].some(
      t => (t || '').toLowerCase().includes(kw)
    ))
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Renderizado de cards ──────────────────────────────────────────────────────
function cardId(n) {
  return n.original_url || n.title || '';
}

function renderCard(n) {
  const cat  = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.Otro;
  const rel  = RELEVANCE[n.relevance]      || RELEVANCE.baja;
  const date = formatDate(n.published_date);
  const uni  = n.university_name || '';

  return `
    <article data-id="${cardId(n).replace(/"/g, '&quot;')}"
             class="news-card bg-white rounded-xl border border-brand-border p-4 flex flex-col gap-2.5 transition-shadow cursor-pointer"
             style="box-shadow:var(--shadow-sm)"
             onmouseover="this.style.boxShadow='var(--shadow-md)'"
             onmouseout="this.style.boxShadow='var(--shadow-sm)'">

      <!-- Fila 1: badge categoría + relevancia -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-medium px-2.5 py-0.5 rounded-full"
              style="background:${cat.bg};color:${cat.text}">${n.category}</span>
        <span class="text-xs font-medium" style="color:${rel.color}">● ${rel.label}</span>
      </div>

      <!-- Título -->
      <h2 class="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">${n.title}</h2>

      <!-- Universidad · Fecha -->
      <p class="text-xs text-gray-400">${uni}${uni && date ? ' · ' : ''}${date}</p>

      <!-- Resumen IA -->
      ${n.ai_resume ? `<p class="text-xs text-gray-500 line-clamp-2">${n.ai_resume}</p>` : ''}

      <!-- Ver artículo -->
      ${n.original_url
        ? `<div class="flex justify-end mt-auto pt-1">
             <a href="${n.original_url}" target="_blank" rel="noopener noreferrer"
                onclick="event.stopPropagation()"
                class="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
               Ver artículo →
             </a>
           </div>`
        : ''}
    </article>`;
}

function renderCards() {
  const panel      = document.getElementById('news-panel');
  const counter    = document.getElementById('news-count');
  const banner     = document.getElementById('search-banner');
  const bannerText = document.getElementById('search-banner-text');
  const visible    = getVisibleNoticias();

  counter.textContent = `${visible.length} noticia${visible.length !== 1 ? 's' : ''}`;

  if (searchResults !== null && searchMeta) {
    bannerText.textContent = `Resultados de: "${searchMeta.universidad}" · ${searchResults.length} noticias encontradas`;
    banner.classList.remove('hidden');
    banner.classList.add('flex');
  } else {
    banner.classList.add('hidden');
    banner.classList.remove('flex');
  }

  if (visible.length === 0) {
    panel.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
        <svg class="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-sm">No hay noticias con estos filtros</p>
      </div>`;
    return;
  }

  noticiaMap.clear();
  visible.forEach(n => noticiaMap.set(cardId(n), n));
  panel.innerHTML = visible.map(renderCard).join('');
}

// ── Modal de noticia ──────────────────────────────────────────────────────────
function openModal(n) {
  const cat = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.Otro;
  const rel = RELEVANCE[n.relevance]      || RELEVANCE.baja;

  const badgeEl = document.getElementById('modal-badge');
  badgeEl.className = 'inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full';
  badgeEl.style.background = cat.bg;
  badgeEl.style.color      = cat.text;
  badgeEl.textContent      = n.category;

  const relEl = document.getElementById('modal-relevance');
  if (relEl) { relEl.textContent = `● ${rel.label}`; relEl.style.color = rel.color; }

  document.getElementById('modal-date').textContent       = formatDate(n.published_date);
  document.getElementById('modal-title').textContent      = n.title        || '';
  document.getElementById('modal-university').textContent = n.university_name || '';

  const aiBlock = document.getElementById('modal-ai-block');
  if (n.ai_resume) {
    document.getElementById('modal-ai-resume').textContent = n.ai_resume;
    aiBlock.classList.remove('hidden');
  } else {
    aiBlock.classList.add('hidden');
  }

  const resumeBlock = document.getElementById('modal-resume-block');
  if (n.resume) {
    document.getElementById('modal-resume').textContent = n.resume;
    resumeBlock.classList.remove('hidden');
  } else {
    resumeBlock.classList.add('hidden');
  }

  const link = document.getElementById('modal-link');
  if (n.original_url) {
    link.href = n.original_url;
    link.classList.remove('hidden');
  } else {
    link.classList.add('hidden');
  }

  document.getElementById('news-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('news-modal').classList.add('hidden');
}

// ── Carga de noticias ─────────────────────────────────────────────────────────
async function loadNoticias(silent = false) {
  const panel = document.getElementById('news-panel');
  if (!silent) {
    panel.innerHTML = `
      <div class="col-span-full flex items-center justify-center py-20">
        <span class="loader"></span>
      </div>`;
  }

  try {
    allNoticias = await fetchNoticias();
    if (!silent) renderCards();
  } catch (err) {
    if (!silent) {
      panel.innerHTML = `
        <div class="col-span-full text-center py-20 text-red-500 text-sm">
          Error al cargar noticias: ${err.message}
        </div>`;
    }
  }
}

// ── Buscador libre ────────────────────────────────────────────────────────────
async function handleSearch(e) {
  e.preventDefault();
  if (searchLoading) return;

  const input   = document.getElementById('search-input');
  const query   = input.value.trim();
  if (!query) return;

  const errorEl = document.getElementById('search-error');
  const overlay = document.getElementById('search-overlay');
  const btnSearch = document.getElementById('btn-search');

  searchLoading = true;
  errorEl.classList.add('hidden');
  overlay.classList.remove('hidden');
  btnSearch.disabled = true;

  try {
    const data = await searchUniversity(query);
    searchResults = (data.noticias || []).map(n => ({
      ...n,
      university_name: n.university_name || data.universidad,
    }));
    searchMeta = { universidad: data.universidad, total: data.total };
    renderCards();
    loadNoticias(true);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    searchLoading = false;
    overlay.classList.add('hidden');
    btnSearch.disabled = false;
  }
}

function clearSearch() {
  searchResults = null;
  searchMeta    = null;
  document.getElementById('search-input').value = '';
  document.getElementById('search-error').classList.add('hidden');
  document.getElementById('filter-keyword').value = '';
  document.getElementById('btn-clear-keyword').classList.add('hidden');
  filters.keyword = '';
  renderCards();
}

// ── Scraping ──────────────────────────────────────────────────────────────────
async function handleScrape() {
  const btn     = document.getElementById('btn-scrape');
  const overlay = document.getElementById('scrape-overlay');
  const label   = document.getElementById('scrape-universidad');

  label.textContent = 'todas las universidades';
  btn.disabled = true;
  overlay.classList.remove('hidden');

  try {
    await triggerScrape('');
    await loadNoticias();
  } catch (err) {
    alert(`Error al actualizar: ${err.message}`);
  } finally {
    btn.disabled = false;
    overlay.classList.add('hidden');
  }
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function handleFilterChange() {
  filters.categoria = document.getElementById('filter-categoria').value;
  renderCards();
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function renderChat() {
  const container = document.getElementById('chat-messages');
  if (chatHistory.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = chatHistory.map(msg => {
    if (msg.role === 'user') {
      return `
        <div class="flex justify-end">
          <div class="chat-msg-user max-w-[85%] text-xs rounded-2xl rounded-tr-sm px-3 py-2">
            ${msg.text}
          </div>
        </div>`;
    }
    if (msg.role === 'loading') {
      return `
        <div class="flex justify-start">
          <div class="bg-gray-100 text-gray-500 text-xs rounded-2xl rounded-tl-sm px-3 py-2">
            <span class="loader-dots"></span>
          </div>
        </div>`;
    }
    return `
      <div class="flex justify-start">
        <div class="max-w-[85%] bg-gray-100 text-gray-700 text-xs rounded-2xl rounded-tl-sm px-3 py-2 leading-relaxed">
          ${msg.text}
        </div>
      </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

async function handleChatSubmit() {
  if (chatLoading) return;
  const input    = document.getElementById('chat-input');
  const pregunta = input.value.trim();
  if (!pregunta) return;

  input.value = '';
  chatLoading = true;

  chatHistory.push({ role: 'user', text: pregunta });
  chatHistory.push({ role: 'loading', text: '' });
  renderChat();

  try {
    const respuesta = await sendChat(pregunta, filters.universidad);
    chatHistory.pop();
    chatHistory.push({ role: 'ai', text: respuesta });
  } catch (err) {
    chatHistory.pop();
    chatHistory.push({ role: 'ai', text: `Error: ${err.message}` });
  } finally {
    chatLoading = false;
    renderChat();
  }
}

// ── Dark mode ─────────────────────────────────────────────────────────────────
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('icon-sun').classList.toggle('hidden', dark);
  document.getElementById('icon-moon').classList.toggle('hidden', !dark);
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved ? saved === 'dark' : prefersDark);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.getElementById('btn-theme').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    applyTheme(!isDark);
  });

  document.getElementById('btn-scrape').addEventListener('click', handleScrape);
  document.getElementById('search-form').addEventListener('submit', handleSearch);
  document.getElementById('btn-clear-search').addEventListener('click', clearSearch);
  document.getElementById('filter-categoria').addEventListener('change', handleFilterChange);

  // Filtro de texto local
  const filterKeyword  = document.getElementById('filter-keyword');
  const btnClearKw     = document.getElementById('btn-clear-keyword');
  filterKeyword.addEventListener('input', () => {
    filters.keyword = filterKeyword.value;
    btnClearKw.classList.toggle('hidden', !filters.keyword);
    renderCards();
  });
  btnClearKw.addEventListener('click', () => {
    filterKeyword.value = '';
    filters.keyword = '';
    btnClearKw.classList.add('hidden');
    renderCards();
  });

  const chatForm  = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    handleChatSubmit();
  });
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  });

  // Modal: abrir al hacer clic en una card
  document.getElementById('news-panel').addEventListener('click', e => {
    if (e.target.closest('a')) return;  // dejar que los links funcionen normalmente
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const n = noticiaMap.get(card.dataset.id);
    if (n) openModal(n);
  });

  // Modal: cerrar con el botón X, clic en el backdrop o tecla Escape
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('news-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // ── Tabs móvil ────────────────────────────────────────────────────────────
  const tabNews     = document.getElementById('tab-news');
  const tabChat     = document.getElementById('tab-chat');
  const newsCol     = document.getElementById('news-col');
  const chatSidebar = document.getElementById('chat-sidebar');

  function setMobileTab(tab) {
    const isNews = tab === 'news';
    newsCol.classList.toggle('mobile-hidden', !isNews);
    chatSidebar.classList.toggle('mobile-visible', !isNews);
    tabNews.classList.toggle('text-brand-primary', isNews);
    tabNews.classList.toggle('text-gray-400', !isNews);
    tabChat.classList.toggle('text-brand-primary', !isNews);
    tabChat.classList.toggle('text-gray-400', isNews);
    if (!isNews) document.getElementById('chat-input')?.focus();
  }

  tabNews.addEventListener('click', () => setMobileTab('news'));
  tabChat.addEventListener('click', () => setMobileTab('chat'));

  loadNoticias();

  renderChat();
});
