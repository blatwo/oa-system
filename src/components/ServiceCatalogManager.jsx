import { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import { getServiceCatalog, createServiceItem, updateServiceItem, deleteServiceItem } from '../db/services';

const LEVEL_LABELS = ['', '服务大类', '服务分类', '服务子项'];
const LEVEL_BG = { 1: '#2e7d32', 2: '#1565c0', 3: '#ef6c00' };

export default function ServiceCatalogManager() {
  const [items, setItems] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', level: 1, parent_id: 0 });
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try { setItems(await getServiceCatalog()); } catch (e) { /* */ }
  };
  useEffect(() => { load(); }, []);

  const tree = useMemo(() => {
    const l1 = items.filter(i => i.level === 1).sort((a, b) => a.sort_order - b.sort_order);
    return l1.map(l1Item => ({
      ...l1Item,
      children: items.filter(i => i.level === 2 && i.parent_id === l1Item.id).sort((a, b) => a.sort_order - b.sort_order).map(l2Item => ({
        ...l2Item,
        children: items.filter(i => i.level === 3 && i.parent_id === l2Item.id).sort((a, b) => a.sort_order - b.sort_order),
      })),
    }));
  }, [items]);

  const handleOpen = (item, parentId = 0, level = 1) => {
    if (item) {
      setEditing(item);
      setForm({ name: item.name, description: item.description || '', level: item.level, parent_id: item.parent_id });
    } else {
      setEditing(null);
      setForm({ name: '', description: '', level, parent_id: parentId });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateServiceItem(editing.id, form.name, 0, form.description);
        setMsg({ text: '已更新', severity: 'success' });
      } else {
        await createServiceItem(form.parent_id, form.level, form.name, form.description);
        setMsg({ text: '已添加', severity: 'success' });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteServiceItem(deleteTarget.id);
      setMsg({ text: '已删除（含子级）', severity: 'success' });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MiscellaneousServicesIcon color="primary" /> 服务目录
        </Typography>
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => handleOpen(null, 0, 1)}>
          新增大类
        </Button>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      {!items.length && <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">暂无服务分类</Typography></Paper>}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除「<strong>{deleteTarget?.name}</strong>」吗？
            {deleteTarget?.level === 1 && ' 将同时删除其下所有分类和子项！'}
            {deleteTarget?.level === 2 && ' 将同时删除其下所有子项！'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>

      {tree.map(l1 => (
        <Paper key={l1.id} variant="outlined" sx={{ mb: 2.5, overflow: 'hidden', borderRadius: 2 }}>
          {/* Level 1 header */}
          <Box sx={{ px: 2.5, py: 1.5, bgcolor: LEVEL_BG[1], color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>{l1.name}</Typography>
              {l1.description && (
                <Typography variant="caption" sx={{ opacity: 0.85, mt: 0.3, display: 'block' }}>{l1.description}</Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              <Tooltip title="新增分类">
                <IconButton size="small" sx={{ color: 'white' }} onClick={() => handleOpen(null, l1.id, 2)}><AddIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="编辑">
                <IconButton size="small" sx={{ color: 'white' }} onClick={() => handleOpen(l1)}><EditIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="删除（含子级）">
                <IconButton size="small" sx={{ color: 'white' }} onClick={() => setDeleteTarget(l1)}><DeleteIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>
          </Box>

          {l1.children.map(l2 => (
            <Box key={l2.id}>
              {/* Level 2 row */}
              <Box sx={{ px: 2.5, py: 1, ml: 3, bgcolor: '#e8eaf6', borderBottom: '1px solid #c5cae9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} color={LEVEL_BG[2]}>{l2.name}</Typography>
                  {l2.description && (
                    <Typography variant="caption" color="text.secondary">{l2.description}</Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  <Tooltip title="新增子项">
                    <IconButton size="small" onClick={() => handleOpen(null, l2.id, 3)}><AddIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="编辑">
                    <IconButton size="small" onClick={() => handleOpen(l2)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="删除（含子级）">
                    <IconButton size="small" onClick={() => setDeleteTarget(l2)}><DeleteIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Level 3 — table-style */}
              {l2.children.length > 0 && (
                <Box sx={{ ml: 6, pl: 2, pr: 2, py: 0.5 }}>
                  {l2.children.map(l3 => (
                    <Box key={l3.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1, py: 0.4,
                      borderBottom: '1px dashed #e0e0e0',
                      '&:last-child': { borderBottom: 'none' }
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 100, color: LEVEL_BG[3] }}>
                        {l3.name}
                      </Typography>
                      {l3.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                          {l3.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', ml: 'auto' }}>
                        <Tooltip title="编辑">
                          <IconButton size="small" onClick={() => handleOpen(l3)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                        </Tooltip>
                        <Tooltip title="删除">
                          <IconButton size="small" onClick={() => setDeleteTarget(l3)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Paper>
      ))}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? `编辑${LEVEL_LABELS[form.level]}` : `新增${LEVEL_LABELS[form.level]}`}</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="名称" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            size="small" fullWidth sx={{ mt: 1 }} />
          <TextField label="说明" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            size="small" fullWidth multiline minRows={2}
            placeholder="简短说明该分类的含义和适用范围..."
            sx={{ mt: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
