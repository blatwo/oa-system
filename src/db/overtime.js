import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getOvertime() {
  return apiGet('/overtime');
}

export async function createOvertime(data) {
  return apiPost('/overtime', data);
}

export async function updateOvertime(id, data) {
  return apiPut(`/overtime/${id}`, data);
}

export async function deleteOvertime(id) {
  return apiDelete(`/overtime/${id}`);
}
