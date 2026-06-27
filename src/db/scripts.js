import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getScripts(category = '') {
  const params = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiGet(`/scripts${params}`);
}

export async function createScript(data) {
  return apiPost('/scripts', data);
}

export async function updateScript(id, data) {
  return apiPut(`/scripts/${id}`, data);
}

export async function deleteScript(id) {
  return apiDelete(`/scripts/${id}`);
}
