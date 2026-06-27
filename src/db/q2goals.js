import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getQ2Goals() {
  return apiGet('/q2-goals');
}

export async function createQ2Goal(data) {
  return apiPost('/q2-goals', data);
}

export async function updateQ2Goal(id, data) {
  return apiPut(`/q2-goals/${id}`, data);
}

export async function deleteQ2Goal(id) {
  return apiDelete(`/q2-goals/${id}`);
}
