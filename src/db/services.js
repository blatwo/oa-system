import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getServiceCatalog(level = 0, parentId = 0) {
  let q = '';
  if (level) q += `&level=${level}`;
  if (parentId) q += `&parent_id=${parentId}`;
  if (q) q = '?' + q.slice(1);
  return apiGet(`/service-catalog${q}`);
}

export async function createServiceItem(parentId, level, name, description = '', sortOrder = 0) {
  return apiPost('/service-catalog', { parent_id: parentId, level, name, description, sort_order: sortOrder });
}

export async function updateServiceItem(id, name, sortOrder, description) {
  const body = { name, sort_order: sortOrder };
  if (description !== undefined) body.description = description;
  return apiPut(`/service-catalog/${id}`, body);
}

export async function deleteServiceItem(id) {
  return apiDelete(`/service-catalog/${id}`);
}
