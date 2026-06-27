import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getCatalog(level = 0, parentId = 0) {
  let q = '';
  if (level) q += `&level=${level}`;
  if (parentId) q += `&parent_id=${parentId}`;
  if (q) q = '?' + q.slice(1);
  return apiGet(`/product-catalog${q}`);
}

export async function createCatalogItem(parentId, level, name, description = '', sortOrder = 0) {
  return apiPost('/product-catalog', { parent_id: parentId, level, name, description, sort_order: sortOrder });
}

export async function updateCatalogItem(id, name, sortOrder, description) {
  const body = { name, sort_order: sortOrder };
  if (description !== undefined) body.description = description;
  return apiPut(`/product-catalog/${id}`, body);
}

export async function deleteCatalogItem(id) {
  return apiDelete(`/product-catalog/${id}`);
}
