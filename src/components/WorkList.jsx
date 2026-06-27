import { useState, useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import { DataGrid, zhCN } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import dayjs from 'dayjs';
import { useWorkContext } from '../context/WorkContext';
import { exportJSON } from '../utils/storage';

/**
 * Work Record List component with DataGrid.
 * Supports filtering by date range and project, inline edit/delete, batch delete,
 * and JSON import/export.
 */
export default function WorkList() {
  const { state, deleteRecord, deleteRecords, setEditing, importRecords } = useWorkContext();

  const today = dayjs().format('YYYY-MM-DD');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [projectFilter, setProjectFilter] = useState('');
  // Applied filter (only updated on 查询 click)
  const [applied, setApplied] = useState({ dateFrom: today, dateTo: today, project: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, ids: [], single: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const doSearch = () => setApplied({ dateFrom, dateTo, project: projectFilter });

  /** Set to this week (Mon~Sun) */
  const setThisWeek = () => {
    const d = dayjs();
    const from = d.day(1).format('YYYY-MM-DD'); // Monday
    const to = d.day(7).format('YYYY-MM-DD');   // Sunday
    setDateFrom(from); setDateTo(to);
    setApplied({ dateFrom: from, dateTo: to, project: projectFilter });
  };

  /** Set to last week */
  const setLastWeek = () => {
    const d = dayjs().subtract(1, 'week');
    const from = d.day(1).format('YYYY-MM-DD');
    const to = d.day(7).format('YYYY-MM-DD');
    setDateFrom(from); setDateTo(to);
    setApplied({ dateFrom: from, dateTo: to, project: projectFilter });
  };

  /** Filtered records based on APPLIED date range and project */
  const filteredRecords = useMemo(() => {
    return state.records.filter((r) => {
      if (applied.dateFrom && r.date < applied.dateFrom) return false;
      if (applied.dateTo && r.date > applied.dateTo) return false;
      if (applied.project && !r.project?.toLowerCase().includes(applied.project.toLowerCase())) return false;
      return true;
    });
  }, [state.records, applied]);

  /** Unique projects for filter dropdown suggestions */
  const projects = useMemo(
    () => [...new Set(state.records.map((r) => r.project).filter(Boolean))].sort(),
    [state.records],
  );

  /** Handle editing a record */
  const handleEdit = (row) => {
    setEditing(row);
  };

  /** Open delete confirmation */
  const handleDeleteClick = (id) => {
    setDeleteDialog({ open: true, ids: [id], single: true });
  };

  /** Batch delete confirmation */
  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteDialog({ open: true, ids: selectedIds, single: false });
  };

  /** Confirm delete action */
  const confirmDelete = () => {
    if (deleteDialog.single) {
      deleteRecord(deleteDialog.ids[0]);
      setSnackbar({ open: true, message: '记录已删除', severity: 'success' });
    } else {
      deleteRecords(deleteDialog.ids);
      setSelectedIds([]);
      setSnackbar({
        open: true,
        message: `已删除 ${deleteDialog.ids.length} 条记录`,
        severity: 'success',
      });
    }
    setDeleteDialog({ open: false, ids: [], single: false });
  };

  /** Export current records to JSON file */
  const handleExport = () => {
    exportJSON(state.records);
    setSnackbar({ open: true, message: '数据已导出为 JSON 文件', severity: 'success' });
  };

  /** Import records from JSON file */
  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) {
          throw new Error('JSON 数据格式不正确，应为数组');
        }
        importRecords(data);
        setSnackbar({
          open: true,
          message: `成功导入 ${data.length} 条记录`,
          severity: 'success',
        });
      } catch (err) {
        setSnackbar({
          open: true,
          message: `导入失败：${err.message}`,
          severity: 'error',
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  /** DataGrid column definitions */
  const columns = [
    {
      field: 'date',
      headerName: '日期',
      width: 110,
      valueFormatter: (params) => params.value || '',
    },
    {
      field: 'project',
      headerName: '项目',
      width: 220,
      valueFormatter: (params) => {
        const val = params.value || '';
        return val.length > 30 ? val.slice(0, 30) + '...' : val;
      },
    },
    { field: 'env', headerName: '环境', width: 85 },
    { field: 'stage', headerName: '阶段', width: 85 },
    { field: 'service1', headerName: '服务Ⅰ', width: 90 },
    {
      field: 'status',
      headerName: '状态',
      width: 85,
      renderCell: (params) => {
        const colorMap = {
          '已完成': 'success.main',
          '进行中': 'info.main',
          '部分完成': 'warning.main',
          '待处理': 'error.main',
        };
        return (
          <Typography variant="body2" sx={{ color: colorMap[params.value] || 'text.primary', fontWeight: 500 }}>
            {params.value}
          </Typography>
        );
      },
    },
    { field: 'hours', headerName: '工时', width: 60, valueFormatter: (params) => params.value != null ? `${params.value}h` : '' },
    { field: 'bsc', headerName: 'BSC', width: 80 },
    { field: 'difficulty', headerName: '难易', width: 65 },
    {
      field: 'actions',
      headerName: '操作',
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="编辑">
            <IconButton size="small" color="primary" onClick={() => handleEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton size="small" color="error" onClick={() => handleDeleteClick(params.row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700' }}>
          工作记录列表
        </Typography>

        {/* Filters and action buttons */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2,
            alignItems: 'center',
          }}
        >
          <TextField label="开始日期" type="date" size="small"
            value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
          <TextField label="结束日期" type="date" size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <Button variant="outlined" size="small" onClick={doSearch}>查询</Button>

          <Button variant="text" size="small" onClick={setThisWeek}>本周</Button>
          <Button variant="text" size="small" onClick={setLastWeek}>上周</Button>
          <TextField
            label="项目筛选"
            size="small"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
            placeholder="输入项目名..."
            sx={{ minWidth: 200 }}
            inputProps={{ list: 'project-datalist' }}
          />
          <datalist id="project-datalist">
            {projects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="outlined"
            size="small"
            startIcon={<FileUploadIcon />}
            component="label"
          >
            导入 JSON
            <input type="file" accept=".json" hidden onChange={handleImport} />
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
          >
            导出 JSON
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteSweepIcon />}
            onClick={handleBatchDelete}
            disabled={selectedIds.length === 0}
          >
            批量删除 ({selectedIds.length})
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          共 {filteredRecords.length} 条记录
          {applied.dateFrom && ` · ${applied.dateFrom}`}
          {applied.dateTo && applied.dateTo !== applied.dateFrom ? ` ~ ${applied.dateTo}` : ''}
          {applied.project ? ` · 项目: ${applied.project}` : ''}
        </Typography>

        {/* DataGrid */}
        <Box sx={{ height: 560, width: '100%' }}>
          <DataGrid
            rows={filteredRecords}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[10, 25, 50, 100]}
            checkboxSelection
            disableSelectionOnClick
            onSelectionModelChange={(ids) => setSelectedIds(ids)}
            selectionModel={selectedIds}
            localeText={zhCN.components.MuiDataGrid.defaultProps.localeText}
            getRowId={(row) => row.id}
            density="compact"
            sx={{
              '& .MuiDataGrid-cell': { fontSize: '0.85rem' },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'primary.50',
                fontWeight: 600,
              },
            }}
          />
        </Box>

        {/* Stats footer */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          共 {filteredRecords.length} 条记录
          {filteredRecords.length > 0 &&
            `，合计工时 ${filteredRecords.reduce((sum, r) => sum + (Number(r.hours) || 0), 0).toFixed(1)}h`}
        </Typography>
      </Paper>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, ids: [], single: false })}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteDialog.single
              ? '确定要删除这条工作记录吗？此操作不可撤销。'
              : `确定要删除选中的 ${deleteDialog.ids.length} 条记录吗？此操作不可撤销。`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, ids: [], single: false })}>取消</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
