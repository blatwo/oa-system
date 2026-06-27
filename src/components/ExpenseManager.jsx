import { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Tooltip, Chip, MenuItem, Snackbar, Collapse,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { getTrips, getTripDetail, createTrip, updateTrip, deleteTrip, createTripExpense, updateTripExpense, deleteTripExpense, getTripStats } from '../db/expenses';

const CATEGORIES = ['住宿', '济南出租/公交', '外埠出租/公交', '网约车', '火车/高铁/动车',
  '轮船/飞机', '退票/改签/补票', '长途汽车/拼车', '出差补助', '项目费用',
  '请客/聚餐', '办公用品', '项目设备', '公司福利', '话费', '其他'];
const STATUSES = ['未报销', '已报销', '部分报销'];
const CUR_YEAR = new Date().getFullYear();
const YEAR_OPTS = Array.from({ length: 7 }, (_, i) => CUR_YEAR - i);

const EMPTY_TRIP = { code: '', project: '', location: '', start_time: '', end_time: '', status: '未报销', year: CUR_YEAR, remark: '' };
const EMPTY_EXPENSE = { category: '', amount: 0, invoice_amount: 0, invoice_count: 0, description: '', start_time: '', end_time: '', location: '', from_place: '', to_place: '', remark: '' };

export default function ExpenseManager() {
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState([]);
  const [filterYear, setFilterYear] = useState(CUR_YEAR);
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [detailExpenses, setDetailExpenses] = useState([]);

  // Trip dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_TRIP);

  // Expense dialog
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [editingExp, setEditingExp] = useState(null);
  const [expForm, setExpForm] = useState(EMPTY_EXPENSE);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteExpTarget, setDeleteExpTarget] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const load = async () => {
    try {
      const [t, s] = await Promise.all([getTrips(filterYear, filterStatus), getTripStats(filterYear)]);
      setTrips(t); setStats(s);
    } catch (e) { setSnackbar({ open: true, message: e.message, severity: 'error' }); }
  };

  useEffect(() => { load(); }, [filterYear, filterStatus]);

  // Trip handlers
  const handleOpenTrip = (item) => {
    if (item) { setEditing(item); setForm({ ...EMPTY_TRIP, ...item }); }
    else { setEditing(null); setForm({ ...EMPTY_TRIP, year: filterYear }); }
    setDialogOpen(true);
  };

  const handleSaveTrip = async () => {
    try {
      if (editing) { await updateTrip(editing.id, form); setSnackbar({ open: true, message: '已更新', severity: 'success' }); }
      else { await createTrip(form); setSnackbar({ open: true, message: '已添加', severity: 'success' }); }
      setDialogOpen(false); await load();
    } catch (e) { setSnackbar({ open: true, message: e.message, severity: 'error' }); }
  };

  const handleDeleteTrip = async () => {
    if (!deleteTarget) return;
    try { await deleteTrip(deleteTarget.id); setSnackbar({ open: true, message: '已删除', severity: 'success' }); setDeleteTarget(null); await load(); }
    catch (e) { setSnackbar({ open: true, message: e.message, severity: 'error' }); }
  };

  // Toggle trip detail expand
  const handleToggleExpand = async (trip) => {
    if (expandedTrip === trip.id) { setExpandedTrip(null); return; }
    try {
      const d = await getTripDetail(trip.id);
      setDetailExpenses(d.expenses || []);
      setExpandedTrip(trip.id);
    } catch (e) { setSnackbar({ open: true, message: e.message, severity: 'error' }); }
  };

  // Expense handlers
  const handleOpenExpense = (item) => {
    if (item) { setEditingExp(item); setExpForm({ ...EMPTY_EXPENSE, ...item }); }
    else { setEditingExp(null); setExpForm({ ...EMPTY_EXPENSE }); }
    setExpDialogOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!expandedTrip) return;
    try {
      if (editingExp) { await updateTripExpense(editingExp.id, expForm); }
      else { await createTripExpense({ ...expForm, trip_id: expandedTrip }); }
      setExpDialogOpen(false);
      const d = await getTripDetail(expandedTrip);
      setDetailExpenses(d.expenses || []);
      await load();
      setSnackbar({ open: true, message: '已保存', severity: 'success' });
    } catch (e) { setSnackbar({ open: true, message: e.message, severity: 'error' }); }
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpTarget) return;
    try {
      await deleteTripExpense(deleteExpTarget.id);
      setDeleteExpTarget(null);
      const d = await getTripDetail(expandedTrip);
      setDetailExpenses(d.expenses || []);
      await load();
      setSnackbar({ open: true, message: '已删除', severity: 'success' });
    } catch (e) { setSnackbar({ open: true, message: e.message, severity: 'error' }); }
  };

  const tripColumns = useMemo(() => [
    { field: 'code', headerName: '编号', width: 110, resizable: true,
      renderCell: (p) => <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>{p.value}</Typography>,
    },
    { field: 'project', headerName: '项目', flex: 1.5, minWidth: 150, resizable: true },
    { field: 'location', headerName: '地点', width: 80 },
    { field: 'start_time', headerName: '开始', width: 110, resizable: true, valueFormatter: ({ value }) => value ? value.slice(0, 10) : '' },
    { field: 'end_time', headerName: '结束', width: 110, resizable: true, valueFormatter: ({ value }) => value ? value.slice(0, 10) : '' },
    { field: 'total_amount', headerName: '总费用', width: 90, align: 'right', headerAlign: 'right',
      renderCell: (p) => <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>{(Number(p.value) || 0).toFixed(0)}</Typography>,
    },
    { field: 'allowance', headerName: '补助', width: 70, align: 'right', headerAlign: 'right',
      renderCell: (p) => <Typography variant="body2" color="text.secondary">{p.value ? Number(p.value).toFixed(0) : '-'}</Typography>,
    },
    { field: 'status', headerName: '状态', width: 80, align: 'center', headerAlign: 'center',
      renderCell: (p) => <Chip label={p.value} size="small" color={p.value === '已报销' ? 'success' : p.value === '未报销' ? 'warning' : 'info'} />,
    },
    { field: '_expand', headerName: '', width: 40, sortable: false, align: 'center',
      renderCell: (p) => (
        <IconButton size="small" onClick={() => handleToggleExpand(p.row)}>
          {expandedTrip === p.row.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      ),
    },
    { field: 'actions', headerName: '', width: 70, sortable: false, align: 'center',
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.2 }}>
          <Tooltip title="编辑"><IconButton size="small" onClick={() => handleOpenTrip(p.row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => setDeleteTarget(p.row)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ], [expandedTrip]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceWalletIcon color="primary" /> 财务报销
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenTrip(null)}>新增出差</Button>
      </Box>

      {/* Filter */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField select label="年份" size="small" value={filterYear}
          onChange={e => setFilterYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
          {YEAR_OPTS.map(y => <MenuItem key={y} value={y}>{y}年</MenuItem>)}
        </TextField>
        <TextField select label="状态" size="small" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)} sx={{ minWidth: 110 }}>
          <MenuItem value="">全部</MenuItem>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        {stats.length > 0 && stats.map((s, i) => (
          <Chip key={i} label={`${s.status} ${s.cnt}次 ¥${s.total.toFixed(0)}`} size="small"
            color={s.status === '已报销' ? 'success' : 'warning'} variant="outlined" />
        ))}
      </Paper>

      {/* Trips DataGrid */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ height: 500, width: '100%' }}>
          <DataGrid
            rows={trips}
            columns={tripColumns}
            pageSizeOptions={[20, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
            disableRowSelectionOnClick
            sx={{ border: 0, '& .MuiDataGrid-cell': { fontSize: '0.85rem' }, '& .MuiDataGrid-columnHeaders': { backgroundColor: '#fce4ec', fontWeight: 600 } }}
          />
        </Box>
      </Paper>

      {/* Expanded detail panel */}
      {expandedTrip && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {trips.find(t => t.id === expandedTrip)?.code} — 费用明细
            </Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenExpense(null)}>新增费用</Button>
          </Box>
          {detailExpenses.length === 0 ? (
            <Typography variant="body2" color="text.secondary">暂无费用明细</Typography>
          ) : (
            detailExpenses.map((exp, idx) => (
              <Box key={exp.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5,
                borderBottom: '1px solid #f0f0f0', '&:last-child': { borderBottom: 'none' }
              }}>
                <Typography variant="caption" color="text.disabled" sx={{ minWidth: 24 }}>{idx + 1}</Typography>
                <Chip label={exp.category} size="small" variant="outlined" sx={{ minWidth: 100 }} />
                <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }} noWrap>{exp.description}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main', minWidth: 70, textAlign: 'right' }}>{exp.amount.toFixed(2)}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: 'right' }}>
                  {exp.start_time ? exp.start_time.slice(0, 10) : '-'}
                </Typography>
                <Tooltip title="编辑"><IconButton size="small" onClick={() => handleOpenExpense(exp)}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => setDeleteExpTarget(exp)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              </Box>
            ))
          )}
        </Paper>
      )}

      {/* Trip Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '编辑出差' : '新增出差'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="编号" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} size="small" sx={{ flex: 1 }} placeholder="如 HG2026001" />
              <TextField select label="年份" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} size="small" sx={{ minWidth: 100 }}>
                {YEAR_OPTS.map(y => <MenuItem key={y} value={y}>{y}年</MenuItem>)}
              </TextField>
              <TextField select label="状态" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} size="small" sx={{ minWidth: 100 }}>
                {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Box>
            <TextField label="项目" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} size="small" fullWidth />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="地点" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} size="small" sx={{ flex: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="开始" type="date" value={form.start_time ? form.start_time.slice(0, 10) : ''}
                onChange={e => setForm({ ...form, start_time: e.target.value })} size="small" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
              <TextField label="结束" type="date" value={form.end_time ? form.end_time.slice(0, 10) : ''}
                onChange={e => setForm({ ...form, end_time: e.target.value })} size="small" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
            </Box>
            <TextField label="备注" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} size="small" fullWidth multiline minRows={2} />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setDialogOpen(false)}>取消</Button><Button variant="contained" onClick={handleSaveTrip}>保存</Button></DialogActions>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expDialogOpen} onClose={() => setExpDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingExp ? '编辑费用明细' : '新增费用明细'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField select label="类别" value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })} size="small" sx={{ flex: 1 }}>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <TextField label="金额" type="number" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: Number(e.target.value) })} size="small" sx={{ minWidth: 110 }} />
            </Box>
            <TextField label="描述" value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} size="small" fullWidth />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="发票金额" type="number" value={expForm.invoice_amount} onChange={e => setExpForm({ ...expForm, invoice_amount: Number(e.target.value) })} size="small" sx={{ flex: 1 }} />
              <TextField label="发票数量" type="number" value={expForm.invoice_count} onChange={e => setExpForm({ ...expForm, invoice_count: Number(e.target.value) })} size="small" sx={{ flex: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="开始" type="datetime-local" value={expForm.start_time ? expForm.start_time.slice(0, 16) : ''}
                onChange={e => setExpForm({ ...expForm, start_time: e.target.value })} size="small" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
              <TextField label="结束" type="datetime-local" value={expForm.end_time ? expForm.end_time.slice(0, 16) : ''}
                onChange={e => setExpForm({ ...expForm, end_time: e.target.value })} size="small" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="出发地" value={expForm.from_place} onChange={e => setExpForm({ ...expForm, from_place: e.target.value })} size="small" sx={{ flex: 1 }} />
              <TextField label="到达地" value={expForm.to_place} onChange={e => setExpForm({ ...expForm, to_place: e.target.value })} size="small" sx={{ flex: 1 }} />
            </Box>
            <TextField label="备注" value={expForm.remark} onChange={e => setExpForm({ ...expForm, remark: e.target.value })} size="small" fullWidth />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setExpDialogOpen(false)}>取消</Button><Button variant="contained" onClick={handleSaveExpense}>保存</Button></DialogActions>
      </Dialog>

      {/* Delete Trip */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent><Typography>确定要删除出差「<strong>{deleteTarget?.code}</strong>」及其全部费用明细吗？</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="contained" color="error" onClick={handleDeleteTrip}>确认删除</Button></DialogActions>
      </Dialog>

      {/* Delete Expense */}
      <Dialog open={!!deleteExpTarget} onClose={() => setDeleteExpTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent><Typography>确定要删除此费用明细吗？</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteExpTarget(null)}>取消</Button><Button variant="contained" color="error" onClick={handleDeleteExpense}>确认删除</Button></DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
