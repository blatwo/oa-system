import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getProfiles() {
  return apiGet('/ai/profiles');
}

export async function createProfile(name, endpoint, apiKey, model) {
  return apiPost('/ai/profiles', { name, endpoint, api_key: apiKey, model });
}

export async function updateProfile(id, name, endpoint, apiKey, model) {
  return apiPut(`/ai/profiles/${id}`, { name, endpoint, api_key: apiKey, model });
}

export async function deleteProfile(id) {
  return apiDelete(`/ai/profiles/${id}`);
}

export async function setDefaultProfile(id) {
  return apiPost(`/ai/profiles/${id}/set-default`);
}

export async function getDefaultProfile() {
  return apiGet('/ai/profiles/default');
}

export async function analyzeData(mode, profileId, project = '', dateFrom = '', dateTo = '', question = '', customPrompt = '') {
  return apiPost('/ai/analyze', { mode, profile_id: profileId, project, date_from: dateFrom, date_to: dateTo, question, custom_prompt: customPrompt });
}

export async function testConnection(profileId) {
  return apiPost('/ai/test-connection', { pid: profileId });
}

export async function autoClassify(content, profileId) {
  return apiPost('/ai/auto-classify', { content, profile_id: profileId });
}

export async function autoVerify(content, profileId) {
  return apiPost('/ai/auto-verify', { content, profile_id: profileId });
}

export async function testConnectionDirect(endpoint, apiKey, model) {
  return apiPost('/ai/test-connection', { endpoint, api_key: apiKey, model });
}

export async function listModelsFromApi(endpoint, apiKey) {
  return apiPost('/ai/list-models', { endpoint, api_key: apiKey });
}
