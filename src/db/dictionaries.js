import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getDictByCategory(category) {
  const rows = await apiGet(`/dicts/${encodeURIComponent(category)}`);
  return rows.map((r) => r.value);
}

export async function getAllDicts() {
  return apiGet('/dicts');
}

export async function getDictCategories() {
  return apiGet('/dict-categories');
}

export async function createDictCategory(code, name, sortOrder, description = '') {
  return apiPost('/dict-categories', { code, name, sort_order: sortOrder, description });
}

export async function updateDictCategory(id, code, name, sortOrder, description) {
  return apiPut(`/dict-categories/${id}`, { code, name, sort_order: sortOrder, description });
}

export async function deleteDictCategory(id) {
  return apiDelete(`/dict-categories/${id}`);
}

export async function addDictItem(category, value, description = '', categoryId = 0) {
  return apiPost('/dicts', { category, value, description, category_id: categoryId });
}

export async function updateDictItem(id, value, sortOrder, description) {
  const body = {};
  if (value !== undefined) body.value = value;
  if (sortOrder !== undefined) body.sort_order = sortOrder;
  if (description !== undefined) body.description = description;
  return apiPut(`/dicts/${id}`, body);
}

export async function deleteDictItem(id) {
  return apiDelete(`/dicts/${id}`);
}
