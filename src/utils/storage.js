/**
 * @deprecated Since SQLite migration (2025-05).
 *
 * This module's localStorage-based storage functions have been replaced by SQLite
 * via sql.js. The following functions are kept for backward compatibility:
 *
 * - `generateId()` → Use `crypto.randomUUID()` instead
 * - `loadRecords()` → Use `getAllRecords()` from `../db/records.js`
 * - `saveRecords()` → Use `addRecord()` / `updateRecord()` from `../db/records.js`
 * - `exportJSON()` → Still used by WorkList for JSON export (kept active)
 * - `validateRecord()` → Still used by WorkForm for validation (kept active)
 *
 * @module storage
 */

/** Storage key for localStorage */
const STORAGE_KEY = 'hg_work_records';

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID if available, otherwise falls back to manual generation.
 *
 * @deprecated Use `crypto.randomUUID()` directly.
 * @returns {string} UUID v4 string
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Load work records from localStorage.
 *
 * @deprecated Use `getAllRecords()` from `../db/records.js`.
 * @returns {Array} Array of work record objects
 */
export function loadRecords() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load records from localStorage:', e);
    return [];
  }
}

/**
 * Save work records to localStorage.
 *
 * @deprecated Data is now persisted via SQLite. Use CRUD functions from `../db/records.js`.
 * @param {Array} records - Array of work record objects
 */
export function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save records to localStorage:', e);
  }
}

/**
 * Export records as a downloadable JSON file.
 * Still active — used by WorkList component.
 *
 * @param {Array} records - Array of work record objects
 */
export function exportJSON(records) {
  const dataStr = JSON.stringify(records, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  anchor.download = `hg_work_records_${dateStr}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Validate a record has the required fields and correct types.
 * Still active — used by WorkForm component.
 *
 * @param {Object} record - Work record to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateRecord(record) {
  const errors = [];
  if (!record.date) errors.push('日期为必填项');
  if (!record.project || record.project.trim() === '') errors.push('项目为必填项');
  const hoursVal = Number(record.hours);
  if (record.hours == null || record.hours === '' || isNaN(hoursVal) || hoursVal <= 0) {
    errors.push('工时必须在 0.5-24 小时之间');
  } else if (hoursVal > 24) {
    errors.push('工时不能超过24小时');
  }
  return { valid: errors.length === 0, errors };
}
