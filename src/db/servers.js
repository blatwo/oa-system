import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getServers(projectName = '') {
  const q = projectName ? `?project_name=${encodeURIComponent(projectName)}` : '';
  return apiGet(`/servers${q}`);
}

export async function createServer(data) {
  return apiPost('/servers', data);
}

export async function updateServer(id, data) {
  return apiPut(`/servers/${id}`, data);
}

export async function deleteServer(id) {
  return apiDelete(`/servers/${id}`);
}

export async function createDisk(data) {
  return apiPost('/server-disks', data);
}

export async function updateDisk(id, data) {
  return apiPut(`/server-disks/${id}`, data);
}

export async function deleteDisk(id) {
  return apiDelete(`/server-disks/${id}`);
}
