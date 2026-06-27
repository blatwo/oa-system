import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { getAllRecords, addRecord as dbAddRecord, updateRecord as dbUpdateRecord, deleteRecord as dbDeleteRecord, deleteRecords as dbDeleteRecords } from '../db/records';

const WorkContext = createContext(null);

const initialState = {
  records: [],
  currentPage: 'form',
  editingRecord: null,
};

function workReducer(state, action) {
  switch (action.type) {
    case 'SET_RECORDS': {
      return { ...state, records: action.payload };
    }

    case 'SET_PAGE': {
      return {
        ...state,
        currentPage: action.payload,
        editingRecord: action.payload !== 'form' ? null : state.editingRecord,
      };
    }

    case 'SET_EDITING': {
      return { ...state, editingRecord: action.payload, currentPage: 'form' };
    }

    default:
      return state;
  }
}

/**
 * Provider component that wraps the app and provides work record state management.
 * Loads records from the FastAPI backend on initial mount.
 */
export function WorkProvider({ children }) {
  const [state, dispatch] = useReducer(workReducer, initialState);

  const loadRecords = useCallback(async () => {
    try {
      const records = await getAllRecords();
      dispatch({ type: 'SET_RECORDS', payload: records });
    } catch (err) {
      console.error('Failed to load records:', err);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  /** Extract unique project names for datalist suggestions */
  const projectNames = [
    ...new Set(state.records.map((r) => r.project).filter(Boolean)),
  ].sort();

  const addRecord = useCallback(async (record) => {
    const now = new Date().toISOString();
    const newRecord = {
      ...record,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    // Optimistic update
    dispatch({ type: 'SET_RECORDS', payload: [newRecord, ...state.records] });
    try {
      await dbAddRecord(newRecord);
      loadRecords(); // Refresh from server to ensure consistency
    } catch (err) {
      console.error('Add failed:', err);
      loadRecords();
    }
  }, [state.records, loadRecords]);

  const updateRecord = useCallback(async (record) => {
    const now = new Date().toISOString();
    const updated = { ...record, updatedAt: now };
    // Optimistic update
    const newRecords = state.records.map((r) =>
      r.id === record.id ? { ...r, ...updated } : r,
    );
    dispatch({ type: 'SET_RECORDS', payload: newRecords });
    try {
      await dbUpdateRecord(record.id, updated);
      loadRecords();
    } catch (err) {
      console.error('Update failed:', err);
      loadRecords();
    }
  }, [state.records, loadRecords]);

  const deleteRecord = useCallback(async (id) => {
    // Optimistic update
    const newRecords = state.records.filter((r) => r.id !== id);
    dispatch({ type: 'SET_RECORDS', payload: newRecords });
    try {
      await dbDeleteRecord(id);
      loadRecords();
    } catch (err) {
      console.error('Delete failed:', err);
      loadRecords();
    }
  }, [state.records, loadRecords]);

  const deleteRecords = useCallback(async (ids) => {
    // Optimistic update
    const idsSet = new Set(ids);
    const newRecords = state.records.filter((r) => !idsSet.has(r.id));
    dispatch({ type: 'SET_RECORDS', payload: newRecords });
    try {
      await dbDeleteRecords(ids);
    } catch (err) {
      console.error('Batch delete failed:', err);
      loadRecords();
    }
  }, [state.records, loadRecords]);

  const importRecords = useCallback(async (records) => {
    const existingIds = new Set(state.records.map((r) => r.id));
    const toImport = records.filter((r) => !existingIds.has(r.id));
    if (toImport.length === 0) return;
    // Optimistic update
    const newRecords = [...toImport, ...state.records];
    dispatch({ type: 'SET_RECORDS', payload: newRecords });
    try {
      for (const record of toImport) {
        await dbAddRecord(record);
      }
    } catch (err) {
      console.error('Import failed:', err);
      loadRecords();
    }
  }, [state.records, loadRecords]);

  const setPage = useCallback(
    (page) => dispatch({ type: 'SET_PAGE', payload: page }),
    [],
  );
  const setEditing = useCallback(
    (record) => dispatch({ type: 'SET_EDITING', payload: record }),
    [],
  );

  const value = {
    state,
    dispatch,
    addRecord,
    updateRecord,
    deleteRecord,
    deleteRecords,
    importRecords,
    setPage,
    setEditing,
    projectNames,
  };

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

/**
 * Hook to access the work record context.
 * Must be used within a WorkProvider.
 */
export function useWorkContext() {
  const context = useContext(WorkContext);
  if (!context) {
    throw new Error('useWorkContext must be used within a WorkProvider');
  }
  return context;
}
