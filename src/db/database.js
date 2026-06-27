const API_BASE = '/api';

async function handleError(res) {
  try {
    const data = await res.json();
    if (data.detail) throw new Error(data.detail);
  } catch (e) {
    if (e.message && e.message !== 'Unexpected end of JSON input' && e.message !== 'API error') throw e;
  }
  throw new Error(`API ${res.status}: ${res.statusText}`);
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) await handleError(res);
  return res.json();
}
