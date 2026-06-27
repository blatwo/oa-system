import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getTrips(year = 0, status = '', project = '') {
  let q = new URLSearchParams();
  if (year) q.set('year', year);
  if (status) q.set('status', status);
  if (project) q.set('project', project);
  const qs = q.toString();
  return apiGet(`/trips${qs ? '?' + qs : ''}`);
}

export async function getTripDetail(id) {
  return apiGet(`/trips/${id}`);
}

export async function createTrip(data) {
  return apiPost('/trips', data);
}

export async function updateTrip(id, data) {
  return apiPut(`/trips/${id}`, data);
}

export async function deleteTrip(id) {
  return apiDelete(`/trips/${id}`);
}

export async function createTripExpense(data) {
  return apiPost('/trip-expenses', data);
}

export async function updateTripExpense(id, data) {
  return apiPut(`/trip-expenses/${id}`, data);
}

export async function deleteTripExpense(id) {
  return apiDelete(`/trip-expenses/${id}`);
}

export async function getTripStats(year = 0) {
  return apiGet(`/trips/stats${year ? '?year=' + year : ''}`);
}
