import { apiGet } from './database';

export async function getBacklog() {
  return apiGet('/backlog');
}
