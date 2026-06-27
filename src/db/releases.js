import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getReleases() {
  return apiGet('/product-releases');
}

export async function createRelease(data) {
  return apiPost('/product-releases', data);
}

export async function updateRelease(id, data) {
  return apiPut(`/product-releases/${id}`, data);
}

export async function deleteRelease(id) {
  return apiDelete(`/product-releases/${id}`);
}
