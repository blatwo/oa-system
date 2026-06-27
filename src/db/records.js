import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getAllRecords() {
  const rows = await apiGet('/records');
  return rows.map((r) => ({
    ...r,
    todoDone: !!r.todo_done,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function addRecord(record) {
  const dbRecord = {
    ...record,
    todo_done: record.todoDone ? 1 : 0,
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return apiPost('/records', dbRecord);
}

export async function updateRecord(id, record) {
  const dbRecord = { ...record };
  if (dbRecord.todoDone !== undefined) {
    dbRecord.todo_done = dbRecord.todoDone ? 1 : 0;
  }
  dbRecord.updated_at = new Date().toISOString();
  return apiPut(`/records/${id}`, dbRecord);
}

export async function deleteRecord(id) {
  return apiDelete(`/records/${id}`);
}

export async function deleteRecords(ids) {
  return apiPost('/records/batch-delete', { ids });
}

export async function getProjectStats(startDate, endDate) {
  let url = '/stats';
  const params = [];
  if (startDate) params.push(`date_from=${startDate}`);
  if (endDate) params.push(`date_to=${endDate}`);
  if (params.length) url += '?' + params.join('&');
  return apiGet(url);
}

export async function getTodos(project) {
  let url = '/todos';
  if (project) url += `?project=${encodeURIComponent(project)}`;
  const rows = await apiGet(url);
  return rows.map((r) => ({ ...r, todoDone: !!r.todo_done }));
}

export async function countRecordsByDictValue(category, value) {
  const result = await apiGet(
    `/dicts/check-value?category=${encodeURIComponent(category)}&value=${encodeURIComponent(value)}`,
  );
  return result.count;
}
