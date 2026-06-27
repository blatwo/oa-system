import { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Card, CardContent, CardActions, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TuneIcon from '@mui/icons-material/Tune';
import { getProductPlans, createProductPlan, updateProductPlan, deleteProductPlan } from '../db/productPlans';
import { getCatalog } from '../db/products';

const STATUS_OPTIONS = ['规划中', '开发中', '已发布', '已下线'];

export default function ProductPlanManager() {
  const [plans, setPlans] = useState([]);
  const [catalogAll, setCatalogAll] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', product_l1: '', product_l2: '', product_l3: '', description: '', status: '规划中' });
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const [p, c] = await Promise.all([getProductPlans(), getCatalog()]);
      setPlans(p); setCatalogAll(c);
    } catch (e) { /* */ }
  };

  useEffect(() => { load(); }, []);

  const catalogL1 = useMemo(() => [...new Set(catalogAll.filter(i => i.level === 1).map(i => i.name))], [catalogAll]);
  const catalogL2 = useMemo(() => {
    if (!form.product_l1) return [];
    const l1 = catalogAll.find(i => i.level === 1 && i.name === form.product_l1);
    return l1 ? catalogAll.filter(i => i.level === 2 && i.parent_id === l1.id).map(i => i.name) : [];
  }, [catalogAll, form.product_l1]);
  const catalogL3 = useMemo(() => {
    if (!form.product_l1 || !form.product_l2) return [];
    const l1 = catalogAll.find(i => i.level === 1 && i.name === form.product_l1);
    if (!l1) return [];
    const l2 = catalogAll.find(i => i.level === 2 && i.name === form.product_l2 && i.parent_id === l1.id);
    return l2 ? catalogAll.filter(i => i.level === 3 && i.parent_id === l2.id).map(i => i.name) : [];
  }, [catalogAll, form.product_l1, form.product_l2]);

  const handleOpen = (p) => {
    if (p) {
      setEditing(p);
      setForm({ name: p.name, product_l1: p.product_l1, product_l2: p.product_l2, product_l3: p.product_l3, description: p.description, status: p.status });
    } else {
      setEditing(null);
      setForm({ name: '', product_l1: '', product_l2: '', product_l3: '', description: '', status: '规划中' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateProductPlan(editing.id, form);
        setMsg({ text: '已更新', severity: 'success' });
      } else {
        await createProductPlan(form);
        setMsg({ text: '已创建', severity: 'success' });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteProductPlan(deleteTarget.id); setMsg({ text: '已删除', severity: 'success' }); await load(); setDeleteTarget(null); }
    catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon color="primary" /> 产品规划
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>
          新增规划
        </Button>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {!plans.length && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">暂无产品规划，点击"新增规划"开始</Typography>
        </Paper>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {plans.map(p => (
          <Card key={p.id} variant="outlined">
            <CardContent sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>{p.name}</Typography>
                <Chip label={p.status} size="small" color={p.status === '已发布' ? 'success' : p.status === '开发中' ? 'warning' : 'default'} variant="outlined" />
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                {p.product_l1 && <Chip label={p.product_l1} size="small" color="primary" variant="outlined" />}
                {p.product_l2 && <Chip label={p.product_l2} size="small" color="info" variant="outlined" />}
                {p.product_l3 && <Chip label={p.product_l3} size="small" />}
              </Box>
              {p.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{p.description}</Typography>
              )}
            </CardContent>
            <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
              <IconButton size="small" onClick={() => handleOpen(p)}><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => setDeleteTarget(p)}><DeleteIcon fontSize="small" /></IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '编辑规划' : '新增产品规划'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="规划名称" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              size="small" placeholder="如：V9企业版迁移方案、安全版容灾方案" fullWidth autoFocus />
            <FormControl size="small" fullWidth>
              <InputLabel>产品大类 (L1)</InputLabel>
              <Select value={form.product_l1} onChange={e => setForm({ ...form, product_l1: e.target.value, product_l2: '', product_l3: '' })} label="产品大类 (L1)">
                {catalogL1.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={!form.product_l1}>
              <InputLabel>产品系列 (L2)</InputLabel>
              <Select value={form.product_l2} onChange={e => setForm({ ...form, product_l2: e.target.value, product_l3: '' })} label="产品系列 (L2)">
                {catalogL2.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={!form.product_l2}>
              <InputLabel>产品版本 (L3)</InputLabel>
              <Select value={form.product_l3} onChange={e => setForm({ ...form, product_l3: e.target.value })} label="产品版本 (L3)">
                {catalogL3.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="描述" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              size="small" multiline minRows={2} placeholder="规划说明..." fullWidth />
            <FormControl size="small" fullWidth>
              <InputLabel>状态</InputLabel>
              <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} label="状态">
                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除「<strong>{deleteTarget?.name || ''}</strong>」吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}