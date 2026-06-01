const BASE = 'https://n8n.divergencyai.cloud/webhook';

export async function searchUniversity(query) {
  const res  = await fetch(`${BASE}/uninews-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!text.trim()) throw new Error('El servidor no respondió. Intenta de nuevo.');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Respuesta inesperada del servidor. Intenta de nuevo.');
  }
  if (!data.ok) throw new Error(data.error || 'Universidad no encontrada');
  return data;
}

export async function fetchNoticias() {
  const res  = await fetch(`${BASE}/dai-noticias`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al obtener noticias');
  return data.noticias || [];
}

export async function triggerScrape(universidad = '') {
  const res = await fetch(`${BASE}/dai-scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ universidad }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) return { ok: true };
  const data = JSON.parse(text);
  if (!data.ok) throw new Error(data.error || 'Error en el scraping');
  return data;
}

export async function sendChat(pregunta, universidad = '') {
  const res = await fetch(`${BASE}/dai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pregunta, universidad }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error en el chat');
  return data.respuesta;
}
