import { useState, useEffect } from 'react';
import {
  Paper, Typography, Box, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem,
  Tooltip, Alert, Chip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import { getScripts, createScript, updateScript, deleteScript } from '../db/scripts';

const CATEGORIES = ['基本话术', '技术支持', '项目推进', '其他'];

export default function ScriptManager() {
  const [scripts, setScripts] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    script: '', description: '', category: '基本话术', sort_order: 0,
  });

  const load = async () => {
    try {
      const list = await getScripts(filterCategory);
      setScripts(list);
    } catch (e) {
      setMsg({ text: '加载失败', severity: 'error' });
    }
  };
  useEffect(() => { load(); }, [filterCategory]);

  const handleAdd = () => {
    setEditing(null);
    setForm({ script: '', description: '', category: '基本话术', sort_order: 0 });
    setDialogOpen(true);
  };

  const handleEdit = (row) => {
    setEditing(row);
    setForm({
      script: row.script || '',
      description: row.description || '',
      category: row.category || '基本话术',
      sort_order: row.sort_order || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateScript(editing.id, form);
        setMsg({ text: '已更新', severity: 'success' });
      } else {
        await createScript(form);
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
      await deleteScript(deleteTarget.id);
      setMsg({ text: '已删除', severity: 'success' });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setMsg({ text: '删除失败', severity: 'error' });
    }
  };

  const columns = [
    { field: 'id', headerName: '#', width: 50, resizable: false, align: 'center', headerAlign: 'center' },
    { field: 'script', headerName: '话术', flex: 3, minWidth: 280, resizable: true,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ whiteSpace: 'normal', lineHeight: 1.4, py: 0.5 }}>
          <RecordVoiceOverIcon sx={{ fontSize: 14, mr: 0.5, color: 'primary.light', verticalAlign: 'middle' }} />
          {p.value}
        </Typography>
      ),
    },
    { field: 'description', headerName: '说明', flex: 2, minWidth: 200, resizable: true,
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'normal', lineHeight: 1.4, py: 0.5 }}>
          {p.value || '-'}
        </Typography>
      ),
    },
    { field: 'category', headerName: '分类', width: 90, resizable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => p.value ? <Chip label={p.value} size="small" variant="outlined" /> : null,
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
        <Typography variant="h6" fontWeight={600}>话术库</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>新增话术</Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField select label="分类" size="small" value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">全部分类</MenuItem>
          {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <Typography variant="body2" color="text.secondary">共 {scripts.length} 条</Typography>
      </Paper>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* DataGrid */}
      <Paper variant="outlined">
        <Box sx={{ height: 550, width: '100%' }}>
          <DataGrid
            rows={scripts}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[25, 50, 100]}
            disableSelectionOnClick
            getRowHeight={() => 'auto'}
            sx={{
              border: 0,
              '& .MuiDataGrid-cell': { fontSize: '0.85rem', py: 1 },
              '& .MuiDataGrid-columnHeaders': { backgroundColor: '#f3e5f5', fontWeight: 600 },
            }}
          />
        </Box>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '编辑话术' : '新增话术'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <TextField label="话术内容" value={form.script} onChange={e => setForm({ ...form, script: e.target.value })}
              size="small" autoFocus required multiline minRows={2} fullWidth />
            <TextField label="说明" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              size="small" multiline minRows={2} fullWidth />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField select label="分类" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })} size="small" sx={{ minWidth: 120 }}>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <TextField label="排序" value={form.sort_order}
                onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} size="small" type="number" sx={{ width: 80 }} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.script.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除「<strong>{deleteTarget?.script?.slice(0, 30) || ''}…</strong>」吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
