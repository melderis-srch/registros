'use client';
// Llama a la API de Apps Script a través de /api/gas
export async function api(accion, ...args) {
  const r = await fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, args }),
  });
  if (r.status === 401) {
    window.location.href = '/login';
    throw new Error('Sesión vencida');
  }
  const j = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida del servidor' }));
  if (!j.ok) throw new Error(j.error || 'Error');
  return j.data;
}
