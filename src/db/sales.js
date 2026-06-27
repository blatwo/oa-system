import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getAllSales() {
  return apiGet('/sales');
}

export async function addSale(name, department = '', phone = '', notes = '') {
  return apiPost('/sales', { name, department, phone, notes });
}

export async function updateSale(id, data) {
  return apiPut(`/sales/${id}`, data);
}

export async function deleteSale(id) {
  return apiDelete(`/sales/${id}`);
}

export async function getSalesStats() {
  return apiGet('/sales/stats');
}
