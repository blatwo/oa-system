import { useState, useEffect } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton, Chip, Stepper, Step, StepLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { getDictByCategory, addDictItem, updateDictItem, deleteDictItem } from '../db/dictionaries';

const CATEGORY = 'compat_stage';

export default function CompatFlow() {
  const [stages, setStages] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const items = await getDictByCategory(CATEGORY);
      setStages(items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    } catch (e) { /* */ }
  };
  useEffect(() => { load(); }, []);

  const handleOpen = (item) => {
    setEditing(item || null);
    setName(item ? item.value : '');
    setDesc(item ? (item.description || '') : '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { setMsg({ text: '环节名不能为空', severity: 'warning' }); return; }
    try {
      if (editing) {
        await updateDictItem(editing.id, name.trim(), editing.sort_order, desc.trim());
      } else {
        await addDictItem(CATEGORY, name.trim(), desc.trim());
      }
      setDialogOpen(false); await load();
      setMsg({ text: editing ? '已更新' : '已新增', severity: 'success' });
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteDictItem(deleteTarget.id); await load(); setMsg({ text: '已删除', severity: 'success' }); setDeleteTarget(null); }
    catch (e) { setMsg({ text: '兼容证明中有使用此环节的，需先清理', severity: 'warning' }); }
  };

  const handleMove = async (item, idx, dir) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= stages.length) return;
    const next = stages[nextIdx];
    await updateDictItem(item.id, item.value, next.sort_order, item.description);
    await updateDictItem(next.id, next.value, item.sort_order, next.description);
    await load();
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountTreeIcon color="primary" /> 兼容流程
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">兼容证明的流程环节定义</Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>新增环节</Button>
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* Stepper view */}
      {stages.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Stepper activeStep={-1} alternativeLabel>
            {stages.map((s, i) => (
              <Step key={s.id}>
                <StepLabel>
                  <Typography variant="body2" fontWeight={600}>{s.value}</Typography>
                  {s.description && (
                    <Typography variant="caption" color="text.secondary">{s.description}</Typography>
                  )}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
      )}

      {/* List view */}
      {!stages.length ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">暂无流程环节，点击"新增环节"开始</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          {stages.map((s, i) => (
            <Box key={s.id}>
              <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Step number */}
                <Chip label={i + 1} color="primary" size="small" sx={{ minWidth: 32, borderRadius: '50%' }} />

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={600}>{s.value}</Typography>
                  {s.description && (
                    <Typography variant="caption" color="text.secondary">{s.description}</Typography>
                  )}
                </Box>

                {/* Reorder */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" disabled={i === 0} onClick={() => handleMove(s, i, -1)}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={i === stages.length - 1} onClick={() => handleMove(s, i, 1)}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Edit/Delete */}
                <IconButton size="small" onClick={() => handleOpen(s)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => setDeleteTarget(s)}><DeleteIcon fontSize="small" /></IconButton>
              </Box>
              {i < stages.length - 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0 }}>
                  <Typography variant="caption" color="primary" sx={{ fontSize: '1.2rem' }}>↓</Typography>
                </Box>
              )}
            </Box>
          ))}
        </Paper>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        共 {stages.length} 个环节，在「兼容证明」中选择当前所处环节
      </Typography>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '编辑环节' : '新增环节'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="环节名称" value={name} size="small" fullWidth required
              onChange={e => setName(e.target.value)} placeholder="如：待启动、适配中、已开具..." />
            <TextField label="说明" value={desc} size="small" fullWidth multiline minRows={2}
              onChange={e => setDesc(e.target.value)} placeholder="说明此环节的含义和完成标准..." />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除「<strong>{deleteTarget?.value || ''}</strong>」吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}