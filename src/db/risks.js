import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getRisks(projectName = '') {
  const q = projectName ? `?project_name=${encodeURIComponent(projectName)}` : '';
  return apiGet(`/risks${q}`);
}

export async function createRisk(data) {
  return apiPost('/risks', data);
}

export async function updateRisk(id, data) {
  return apiPut(`/risks/${id}`, data);
}

export async function deleteRisk(id) {
  return apiDelete(`/risks/${id}`);
}
