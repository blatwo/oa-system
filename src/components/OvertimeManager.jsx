import { useState, useEffect } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControl, InputLabel, Select, MenuItem, Chip,
} from '@mui/material';
import { DataGrid, zhCN } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { getOvertime, createOvertime, updateOvertime, deleteOvertime } from '../db/overtime';

const EMPTY = { date: '', sign_in: '', sign_out: '', hours: '', comp_leave: 'N', meal: '20', transport: '', content: '', reimburse: 'N', remark: '' };

const columns = [
  { field: 'date', headerName: '日期', width: 110 },
  { field: 'sign_in', headerName: '签到', width: 70 },
  { field: 'sign_out', headerName: '签退', width: 70 },
  { field: 'hours', headerName: '工时', width: 65, type: 'number', align: 'center', headerAlign: 'center' },
  {
    field: 'comp_leave', headerName: '调休', width: 55, align: 'center', headerAlign: 'center',
    renderCell: (p) => p.value === 'Y' ? '✓' : '',
  },
  {
    field: 'reimburse', headerName: '报销', width: 65, align: 'center', headerAlign: 'center',
    renderCell: (p) => (
      <Chip label={p.value === 'Y' ? '是' : '否'} size="small"
        color={p.value === 'Y' ? 'success' : 'default'} variant="outlined" sx={{ height: 22 }} />
    ),
  },
  { field: 'meal', headerName: '餐补', width: 65, align: 'right', headerAlign: 'right' },
  { field: 'transport', headerName: '交通', width: 65, align: 'right', headerAlign: 'right' },
  { field: 'content', headerName: '工作内容', flex: 1, minWidth: 200 },
  {
    field: 'actions', headerName: '操作', width: 90, align: 'center', headerAlign: 'center',
    sortable: false, filterable: false,
    renderCell: (p) => (
      <Box>
        <IconButton size="small" onClick={() => p.row._onEdit()}><EditIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={() => p.row._onDelete()}><DeleteIcon fontSize="small" /></IconButton>
      </Box>
    ),
  },
];

export default function OvertimeManager() {
  const [records, setRecords] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try { setRecords(await getOvertime()); } catch (e) { /* */ }
  };
  useEffect(() => { load(); }, []);

  const totalHours = records.reduce((s, r) => s + r.hours, 0);
  const totalMeal = records.reduce((s, r) => s + (parseFloat(r.meal) || 0), 0);
  const totalTransport = records.reduce((s, r) => s + (parseFloat(r.transport) || 0), 0);

  const handleOpen = (r) => {
    if (r) {
      setEditing(r);
      setForm({ date: r.date, sign_in: r.sign_in, sign_out: r.sign_out, hours: String(r.hours), comp_leave: r.comp_leave, meal: r.meal, transport: r.transport, content: r.content || '', reimburse: r.reimburse || 'N', remark: r.remark || '' });
    } else { setEditing(null); setForm(EMPTY); }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = { ...form, hours: parseFloat(form.hours) || 0 };
      if (editing) await updateOvertime(editing.id, data);
      else await createOvertime(data);
      setDialogOpen(false); await load();
      setMsg({ text: '保存成功', severity: 'success' });
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const handleDelete = async () => {
    try { await deleteOvertime(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const rows = records.map((r, i) => ({
    ...r, id: r.id || i,
    _onEdit: () => handleOpen(r),
    _onDelete: () => setDeleteTarget(r),
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon color="primary" /> 加班记录
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', mr: 1 }}>
            共 {records.length} 条 · 累计 {totalHours.toFixed(1)}h · 餐补 {totalMeal} · 交通 {totalTransport}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>新增加班</Button>
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Paper sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          localeText={zhCN.components.MuiDataGrid.defaultProps.localeText}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
            sorting: { sortModel: [{ field: 'date', sort: 'desc' }] },
          }}
          pageSizeOptions={[15, 25, 50, 100]}
          density="compact"
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          sx={{
            border: 0,
            '& .MuiDataGrid-row:nth-of-type(even)': { bgcolor: '#fafafa' },
            '& .MuiDataGrid-row:hover': { bgcolor: '#e3f2fd' },
          }}
        />
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '编辑' : '新增加班'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="日期" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                size="small" InputLabelProps={{ shrink: true }} fullWidth autoFocus />
              <TextField label="加班工时" type="number" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })}
                size="small" inputProps={{ step: 0.5, min: 0 }} sx={{ width: 140 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="签到" type="time" value={form.sign_in} onChange={e => setForm({ ...form, sign_in: e.target.value })}
                size="small" InputLabelProps={{ shrink: true }} fullWidth />
              <TextField label="签退" type="time" value={form.sign_out} onChange={e => setForm({ ...form, sign_out: e.target.value })}
                size="small" InputLabelProps={{ shrink: true }} fullWidth />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>调休</InputLabel>
                <Select value={form.comp_leave} onChange={e => setForm({ ...form, comp_leave: e.target.value })} label="调休">
                  <MenuItem value="N">否</MenuItem>
                  <MenuItem value="Y">是</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>报销</InputLabel>
                <Select value={form.reimburse} onChange={e => setForm({ ...form, reimburse: e.target.value })} label="报销">
                  <MenuItem value="N">否</MenuItem>
                  <MenuItem value="Y">是</MenuItem>
                </Select>
              </FormControl>
              <TextField label="餐补" value={form.meal} onChange={e => setForm({ ...form, meal: e.target.value })}
                size="small" fullWidth />
              <TextField label="交通" value={form.transport} onChange={e => setForm({ ...form, transport: e.target.value })}
                size="small" fullWidth />
            </Box>
            <TextField label="工作内容" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              size="small" multiline minRows={2} placeholder="简述加班做的工作..." fullWidth />
            <TextField label="备注" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })}
              size="small" multiline minRows={1} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.date}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除 {deleteTarget?.date} 的加班记录吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
