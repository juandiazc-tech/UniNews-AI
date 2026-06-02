import { fetchNoticias, triggerScrape, sendChat, searchUniversity } from './api.js';

// ── Estado ────────────────────────────────────────────────────────────────────
let allNoticias   = [];
let searchResults = null;   // null = modo normal; array = resultados de /uninews-search
let searchMeta    = null;   // { universidad, total }
let searchLoading = false;
let filters       = { universidad: '', categoria: '', relevancia: '' };
let chatHistory   = [];
let chatLoading   = false;
const noticiaMap  = new Map();  // serial → objeto noticia completo para el modal

// ── Colores ───────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  Convocatoria:  'bg-brand-surface text-brand-primary',
  Investigacion: 'bg-green-100 text-green-800',
  Tecnologia:    'bg-orange-100 text-orange-800',
  Cultura:       'bg-red-100 text-red-800',
  Deporte:       'bg-gray-100 text-gray-700',
  Institucional: 'bg-purple-100 text-purple-800',
  Otro:          'bg-gray-100 text-gray-500',
};

const RELEVANCE_DOT = {
  alta:  'bg-green-500',
  media: 'bg-yellow-400',
  baja:  'bg-red-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getVisibleNoticias() {
  const source = searchResults !== null ? searchResults : allNoticias;
  return source.filter(n => {
    const matchU = searchResults !== null || !filters.universidad || n.university_name === filters.universidad;
    const matchC = !filters.categoria || n.category  === filters.categoria;
    const matchR = !filters.relevancia || n.relevance === filters.relevancia;
    return matchU && matchC && matchR;
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Renderizado de cards ──────────────────────────────────────────────────────
function renderCard(n) {
  const badge = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.Otro;
  const dot   = RELEVANCE_DOT[n.relevance]  || 'bg-gray-300';
  const date  = formatDate(n.published_date);

  return `
    <article data-serial="${n.serial}"
             class="news-card bg-white rounded-xl border border-brand-border p-4 flex flex-col gap-3 transition-shadow cursor-pointer"
             style="box-shadow:var(--shadow-sm)"
             onmouseover="this.style.boxShadow='var(--shadow-md)'"
             onmouseout="this.style.boxShadow='var(--shadow-sm)'">
      <div class="flex items-start justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${badge}">
          <span class="w-1.5 h-1.5 rounded-full ${dot} inline-block"></span>
          ${n.category}
        </span>
        <span class="text-xs text-gray-400 shrink-0">${date}</span>
      </div>

      <div>
        <h2 class="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">${n.title}</h2>
        <p class="mt-1 text-xs text-gray-500 line-clamp-2">${n.ai_resume || ''}</p>
      </div>

      <div class="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
        <span class="text-xs text-gray-400 font-medium">${n.university_name || ''}</span>
        ${n.original_url
          ? `<a href="${n.original_url}" target="_blank" rel="noopener noreferrer"
               onclick="event.stopPropagation()"
               class="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
               Ver artículo →
             </a>`
          : ''}
      </div>
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
  visible.forEach(n => noticiaMap.set(String(n.serial), n));
  panel.innerHTML = visible.map(renderCard).join('');
}

// ── Modal de noticia ──────────────────────────────────────────────────────────
function openModal(n) {
  const badge = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.Otro;
  const dot   = RELEVANCE_DOT[n.relevance]  || 'bg-gray-300';

  const badgeEl = document.getElementById('modal-badge');
  badgeEl.className = `inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${badge}`;
  badgeEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dot} inline-block"></span>${n.category}`;

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
  renderCards();
}

// ── Scraping ──────────────────────────────────────────────────────────────────
async function handleScrape() {
  const btn     = document.getElementById('btn-scrape');
  const overlay = document.getElementById('scrape-overlay');
  const label   = document.getElementById('scrape-universidad');

  label.textContent = filters.universidad || 'todas las universidades';
  btn.disabled = true;
  overlay.classList.remove('hidden');

  try {
    await triggerScrape(filters.universidad);
    await loadNoticias();
  } catch (err) {
    alert(`Error al actualizar: ${err.message}`);
  } finally {
    btn.disabled = false;
    overlay.classList.add('hidden');
  }
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function handleUniversityChange() {
  filters.universidad = document.getElementById('filter-universidad').value;
  filters.categoria   = document.getElementById('filter-categoria').value;
  filters.relevancia  = document.getElementById('filter-relevancia').value;
  renderCards();
}

function handleFilterChange() {
  filters.categoria  = document.getElementById('filter-categoria').value;
  filters.relevancia = document.getElementById('filter-relevancia').value;
  renderCards();  // solo re-renderiza, no re-fetch
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function renderChat() {
  const container = document.getElementById('chat-messages');
  if (chatHistory.length === 0) {
    container.innerHTML = `
      <p class="text-xs text-gray-400 text-center mt-8 px-4">
        Pregúntame sobre las noticias de las universidades
      </p>`;
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
  document.getElementById('filter-universidad').addEventListener('change', handleUniversityChange);
  document.getElementById('filter-categoria').addEventListener('change', handleFilterChange);
  document.getElementById('filter-relevancia').addEventListener('change', handleFilterChange);

  document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('chat-input').value = chip.dataset.text;
      handleChatSubmit();
    });
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
    const card = e.target.closest('[data-serial]');
    if (!card) return;
    const n = noticiaMap.get(card.dataset.serial);
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

  renderChat();
  loadNoticias();
});
