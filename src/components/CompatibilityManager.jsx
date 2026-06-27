import { useState, useEffect } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { DataGrid, zhCN } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VerifiedIcon from '@mui/icons-material/Verified';
import { getCerts, createCert, updateCert, deleteCert } from '../db/compatibility';
import { getDictByCategory } from '../db/dictionaries';
import { getAllProjects } from '../db/projects';

const EMPTY = { project: '', app_system: '', completed: 'N', stage: '', issue_date: '', issued_by: '', cert_count: 0, adapt_count: 0, adapted_by: '', claimed_by: '', remark: '' };

const columns = [
  { field: 'project', headerName: '项目', width: 160 },
  { field: 'app_system', headerName: '应用系统', width: 140 },
  {
    field: 'completed', headerName: '状态', width: 70, align: 'center', headerAlign: 'center',
    renderCell: (p) => (
      <Chip label={p.value === 'Y' ? '已做' : '未做'} size="small"
        color={p.value === 'Y' ? 'success' : 'default'} variant="outlined" sx={{ height: 22 }} />
    ),
  },
  {
    field: 'stage', headerName: '当前环节', width: 100, align: 'center', headerAlign: 'center',
    renderCell: (p) => p.value ? <Chip label={p.value} size="small" variant="outlined" sx={{ height: 22 }} /> : '',
  },
  { field: 'issue_date', headerName: '开具时间', width: 105 },
  { field: 'issued_by', headerName: '开具人', width: 80 },
  { field: 'cert_count', headerName: '证明数', width: 70, type: 'number', align: 'center', headerAlign: 'center' },
  { field: 'adapt_count', headerName: '适配数', width: 70, type: 'number', align: 'center', headerAlign: 'center' },
  { field: 'adapted_by', headerName: '适配人', width: 80 },
  { field: 'claimed_by', headerName: '认领人', width: 80 },
  { field: 'remark', headerName: '备注', flex: 1, minWidth: 120 },
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

export default function CompatibilityManager() {
  const [records, setRecords] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stages, setStages] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const [certs, proj, stg] = await Promise.all([getCerts(), getAllProjects(), getDictByCategory('compat_stage')]);
      setRecords(certs); setProjects(proj.map(p => p.name));
      setStages(stg.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    } catch (e) { /* */ }
  };
  useEffect(() => { load(); }, []);

  const doneCount = records.filter(r => r.completed === 'Y').length;
  const pendingCount = records.filter(r => r.completed === 'N').length;
  const totalCerts = records.reduce((s, r) => s + (r.cert_count || 0), 0);

  const handleOpen = (r) => {
    if (r) {
      setEditing(r);
      setForm({ project: r.project, app_system: r.app_system, completed: r.completed, stage: r.stage, issue_date: r.issue_date, issued_by: r.issued_by, cert_count: r.cert_count || 0, adapt_count: r.adapt_count || 0, adapted_by: r.adapted_by || '', claimed_by: r.claimed_by || '', remark: r.remark || '' });
    } else { setEditing(null); setForm(EMPTY); }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) await updateCert(editing.id, form);
      else await createCert(form);
      setDialogOpen(false); await load();
      setMsg({ text: '保存成功', severity: 'success' });
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const handleDelete = async () => {
    try { await deleteCert(deleteTarget.id); setDeleteTarget(null); await load(); }
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
          <VerifiedIcon color="primary" /> 兼容证明管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', mr: 1 }}>
            共 {records.length} 条 · 已做 {doneCount} · 未做 {pendingCount} · 证明数 {totalCerts}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>新增</Button>
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
            sorting: { sortModel: [{ field: 'completed', sort: 'asc' }] },
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '编辑' : '新增兼容证明'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <FormControl size="small">
                <InputLabel>项目</InputLabel>
                <Select value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} label="项目">
                  {projects.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="应用系统" value={form.app_system} onChange={e => setForm({ ...form, app_system: e.target.value })}
                size="small" placeholder="如：雄安OA、智慧水务..." />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <FormControl size="small">
                <InputLabel>是否已做</InputLabel>
                <Select value={form.completed} onChange={e => setForm({ ...form, completed: e.target.value })} label="是否已做">
                  <MenuItem value="N">未做</MenuItem>
                  <MenuItem value="Y">已做</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel>当前环节</InputLabel>
                <Select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} label="当前环节">
                  {stages.map(s => <MenuItem key={s.id} value={s.value}>{s.value}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="开具时间" type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })}
                size="small" InputLabelProps={{ shrink: true }} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <TextField label="开具人" value={form.issued_by} onChange={e => setForm({ ...form, issued_by: e.target.value })}
                size="small" />
              <TextField label="认领人" value={form.claimed_by} onChange={e => setForm({ ...form, claimed_by: e.target.value })}
                size="small" />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <TextField label="证明数量" type="number" value={form.cert_count} onChange={e => setForm({ ...form, cert_count: parseInt(e.target.value) || 0 })}
                size="small" />
              <TextField label="适配数量" type="number" value={form.adapt_count} onChange={e => setForm({ ...form, adapt_count: parseInt(e.target.value) || 0 })}
                size="small" />
            </Box>
            <TextField label="适配人" value={form.adapted_by} onChange={e => setForm({ ...form, adapted_by: e.target.value })}
              size="small" />
            <TextField label="备注" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })}
              size="small" multiline minRows={2} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.project}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent><Typography>确定要删除 {deleteTarget?.project} 的兼容证明记录吗？</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
