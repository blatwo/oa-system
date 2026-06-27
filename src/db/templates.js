import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getTemplates() {
  return apiGet('/templates');
}

export async function createTemplate(data) {
  return apiPost('/templates', data);
}

export async function updateTemplate(id, data) {
  return apiPut(`/templates/${id}`, data);
}

export async function deleteTemplate(id) {
  return apiDelete(`/templates/${id}`);
}
