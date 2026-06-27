import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getCriteria() {
  return apiGet('/priority-criteria');
}

export async function createCriteria(data) {
  return apiPost('/priority-criteria', data);
}

export async function updateCriteria(id, data) {
  return apiPut(`/priority-criteria/${id}`, data);
}

export async function deleteCriteria(id) {
  return apiDelete(`/priority-criteria/${id}`);
}
