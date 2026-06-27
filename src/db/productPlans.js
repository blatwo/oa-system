import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getProductPlans() {
  return apiGet('/product-plans');
}

export async function createProductPlan(data) {
  return apiPost('/product-plans', data);
}

export async function updateProductPlan(id, data) {
  return apiPut(`/product-plans/${id}`, data);
}

export async function deleteProductPlan(id) {
  return apiDelete(`/product-plans/${id}`);
}
