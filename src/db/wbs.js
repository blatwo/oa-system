import { apiGet, apiPost, apiPut, apiDelete } from './database';

// Items
export async function getWbsItems() { return apiGet('/wbs-items'); }
export async function createWbsItem(data) { return apiPost('/wbs-items', data); }
export async function updateWbsItem(id, data) { return apiPut(`/wbs-items/${id}`, data); }
export async function deleteWbsItem(id) { return apiDelete(`/wbs-items/${id}`); }

// Scenarios
export async function getWbsScenarios() { return apiGet('/wbs-scenarios'); }
export async function createWbsScenario(data) { return apiPost('/wbs-scenarios', data); }
export async function updateWbsScenario(id, data) { return apiPut(`/wbs-scenarios/${id}`, data); }
export async function deleteWbsScenario(id) { return apiDelete(`/wbs-scenarios/${id}`); }
