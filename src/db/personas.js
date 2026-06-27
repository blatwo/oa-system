import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getPersonas(projectName = '') {
  const q = projectName ? `?project_name=${encodeURIComponent(projectName)}` : '';
  return apiGet(`/personas${q}`);
}

export async function createPersona(data) {
  return apiPost('/personas', data);
}

export async function updatePersona(id, data) {
  return apiPut(`/personas/${id}`, data);
}

export async function deletePersona(id) {
  return apiDelete(`/personas/${id}`);
}
