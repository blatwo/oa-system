import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getIssues(type = '', status = '', productId = 0, severity = '') {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (productId) params.set('product_id', productId);
  if (severity) params.set('severity', severity);
  return apiGet(`/issues?${params.toString()}`);
}

export async function getIssue(id) {
  return apiGet(`/issues/${id}`);
}

export async function createIssue(data) {
  return apiPost('/issues', data);
}

export async function updateIssue(id, data) {
  return apiPut(`/issues/${id}`, data);
}

export async function deleteIssue(id) {
  return apiDelete(`/issues/${id}`);
}
