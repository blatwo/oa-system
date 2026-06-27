import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getCerts() {
  return apiGet('/compatibility-certs');
}

export async function createCert(data) {
  return apiPost('/compatibility-certs', data);
}

export async function updateCert(id, data) {
  return apiPut(`/compatibility-certs/${id}`, data);
}

export async function deleteCert(id) {
  return apiDelete(`/compatibility-certs/${id}`);
}
