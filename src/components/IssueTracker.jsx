import { useState, useEffect } from 'react';
import {
  Paper, Typography, Box, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, TextField, MenuItem,
  Tooltip, Snackbar, Alert, Chip, Autocomplete,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getIssues, createIssue, updateIssue, deleteIssue } from '../db/issues';
import { getCatalog } from '../db/products';

const TYPES = ['bug', '特殊操作', '最佳实践'];
const SEVERITIES = ['高', '中', '低'];
const STATUSES = ['未解决', '跟进中', '已解决'];

const typeChip = {
  bug: { label: 'BUG', color: 'error' },
  '特殊操作': { label: '特殊操作', color: 'warning' },
  '最佳实践': { label: '最佳实践', color: 'success' },
};

const severityChip = {
  '高': { color: 'error' },
  '中': { color: 'warning' },
  '低': { color: 'default' },
};

const statusChip = {
  '未解决': { color: 'error' },
  '跟进中': { color: 'warning' },
  '已解决': { color: 'success' },
};

export default function IssueTracker() {
  const [issues, setIssues] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProduct, setFilterProduct] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    title: '', type: 'bug', product_id: 0, version: '',
    severity: '中', status: '未解决', description: '', solution: '', tags: '',
  });

  const loadProducts = async () => {
    try {
      const all = await getCatalog();
      // Flatten: show hierarchy as "数据库 > 企业版"
      const flat = [];
      const map = {};
      all.forEach(p => { map[p.id] = p; });
      all.forEach(p => {
        let label = p.name;
        if (p.parent_id && map[p.parent_id]) {
          label = `${map[p.parent_id].name} > ${p.name}`;
        }
        flat.push({ id: p.id, label });
      });
      setProducts(flat);
    } catch { /* */ }
  };

  const load = async () => {
    try {
      const list = await getIssues(
        filterType, filterStatus,
        filterProduct ? filterProduct.id : 0,
        filterSeverity
      );
      setIssues(list);
    } catch (e) {
      setMsg({ text: e.message || '加载失败', severity: 'error' });
    }
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { load(); }, [filterType, filterStatus, filterProduct, filterSeverity]);

  const handleAdd = () => {
    setEditing(null);
    setForm({ title: '', type: 'bug', product_id: 0, version: '', severity: '中', status: '未解决', description: '', solution: '', tags: '' });
    setDialogOpen(true);
  };

  const handleEdit = (row) => {
    setEditing(row);
    setForm({
      title: row.title || '',
      type: row.type || 'bug',
      product_id: row.product_id || 0,
      version: row.version || '',
      severity: row.severity || '中',
      status: row.status || '未解决',
      description: row.description || '',
      solution: row.solution || '',
      tags: row.tags || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateIssue(editing.id, form);
        setMsg({ text: '已更新', severity: 'success' });
      } else {
        await createIssue(form);
        setMsg({ text: '已新增', severity: 'success' });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      setMsg({ text: e.message || '保存失败', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteIssue(deleteTarget.id);
      setMsg({ text: '已删除', severity: 'success' });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setMsg({ text: e.message || '删除失败', severity: 'error' });
    }
  };

  const columns = [
    { field: 'id', headerName: '#', width: 50, resizable: false, sortable: true, align: 'center', headerAlign: 'center' },
    { field: 'title', headerName: '标题', flex: 2, minWidth: 200, resizable: true },
    { field: 'type', headerName: '类型', width: 90, resizable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => <Chip label={typeChip[p.value]?.label || p.value} color={typeChip[p.value]?.color || 'default'} size="small" />,
    },
    { field: 'product_name', headerName: '关联产品', width: 140, resizable: true, valueGetter: (params) => params.row.product_name || params.value || '-' },
    { field: 'version', headerName: '版本', width: 90, resizable: true },
    { field: 'severity', headerName: '严重度', width: 70, resizable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => <Chip label={p.value} color={severityChip[p.value]?.color || 'default'} size="small" variant="outlined" />,
    },
    { field: 'status', headerName: '状态', width: 80, resizable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => <Chip label={p.value} color={statusChip[p.value]?.color || 'default'} size="small" />,
    },
    { field: 'updated_at', headerName: '更新时间', width: 140, resizable: true,
      valueFormatter: ({ value }) => value ? value.slice(0, 16).replace('T', ' ') : '',
    },
    { field: 'actions', headerName: '操作', width: 90, resizable: false, sortable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          <Tooltip title="编辑"><IconButton size="small" color="primary" onClick={() => handleEdit(p.row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => setDeleteTarget(p.row)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={600}>问题记录表</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>新增记录</Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField select label="类型" size="small" value={filterType}
          onChange={e => setFilterType(e.target.value)} sx={{ minWidth: 110 }}>
          <MenuItem value="">全部类型</MenuItem>
          {TYPES.map(t => <MenuItem key={t} value={t}>{typeChip[t]?.label || t}</MenuItem>)}
        </TextField>
        <TextField select label="状态" size="small" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)} sx={{ minWidth: 100 }}>
          <MenuItem value="">全部状态</MenuItem>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField select label="严重度" size="small" value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)} sx={{ minWidth: 90 }}>
          <MenuItem value="">全部</MenuItem>
          {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <Autocomplete
          size="small" options={products} getOptionLabel={o => o.label}
          value={filterProduct} onChange={(e, v) => setFilterProduct(v)}
          renderInput={(params) => <TextField {...params} label="产品" sx={{ minWidth: 180 }} />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
        />
      </Paper>

      {/* Snackbar */}
      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* DataGrid */}
      <Paper variant="outlined">
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={issues}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[25, 50, 100]}
            disableSelectionOnClick
            sx={{
              border: 0,
              '& .MuiDataGrid-cell': { fontSize: '0.85rem' },
              '& .MuiDataGrid-columnHeaders': { backgroundColor: '#e3f2fd', fontWeight: 600 },
            }}
          />
        </Box>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '编辑问题记录' : '新增问题记录'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <TextField label="标题" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              size="small" autoFocus required fullWidth />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField select label="类型" value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })} size="small" sx={{ minWidth: 110 }}>
                {TYPES.map(t => <MenuItem key={t} value={t}>{typeChip[t]?.label || t}</MenuItem>)}
              </TextField>
              <TextField select label="严重度" value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value })} size="small" sx={{ minWidth: 90 }}>
                {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
              <TextField select label="状态" value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })} size="small" sx={{ minWidth: 100 }}>
                {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Autocomplete size="small" options={products} getOptionLabel={o => o.label}
                value={products.find(p => p.id === form.product_id) || null}
                onChange={(e, v) => setForm({ ...form, product_id: v ? v.id : 0 })}
                renderInput={(params) => <TextField {...params} label="关联产品" sx={{ minWidth: 220 }} />}
                isOptionEqualToValue={(o, v) => o.id === v.id}
              />
              <TextField label="版本号" value={form.version}
                onChange={e => setForm({ ...form, version: e.target.value })}
                size="small" sx={{ minWidth: 120 }} placeholder="如 V9, 4.5.10" />
              <TextField label="标签" value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                size="small" sx={{ flex: 1 }} placeholder="逗号分隔" />
            </Box>
            <TextField label="问题描述" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              size="small" multiline minRows={3} fullWidth placeholder="详细描述问题/操作步骤/场景..." />
            <TextField label="解决方案" value={form.solution} onChange={e => setForm({ ...form, solution: e.target.value })}
              size="small" multiline minRows={2} fullWidth placeholder="如有解决方案或最佳实践总结，请填写..." />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.title.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除「<strong>{deleteTarget?.title || ''}</strong>」吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
