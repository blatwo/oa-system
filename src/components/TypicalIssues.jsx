import { useState, useEffect } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Card, CardContent, CardActions, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BugReportIcon from '@mui/icons-material/BugReport';
import { getIssues, createIssue, updateIssue, deleteIssue } from '../db/issues';

const SCENARIO_COLORS = { '生产': 'error', '开发测试': 'info', '合规性检查': 'warning', '生产环境': 'error' };
const EMPTY = { reference_no: 0, title: '', product1: '', product2: '', scenario: '', impact: '', found_by: '', category: '', service1: '', service2: '', service3: '', sort_order: 0 };

export default function TypicalIssues() {
  const [items, setItems] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [filterScenario, setFilterScenario] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => { try { setItems(await getIssues()); } catch (e) { /* */ } };
  useEffect(() => { load(); }, []);

  const filtered = filterScenario
    ? items.filter(i => i.scenario === filterScenario)
    : items;

  const handleOpen = (item) => {
    setEditing(item || null);
    setForm(item ? { ...item } : { ...EMPTY, sort_order: items.length + 1 });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setMsg({ text: '标题不能为空', severity: 'warning' }); return; }
    try {
      if (editing) { await updateIssue(editing.id, form); setMsg({ text: '已更新', severity: 'success' }); }
      else { await createIssue(form); setMsg({ text: '已新增', severity: 'success' }); }
      setDialogOpen(false); await load();
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteIssue(deleteTarget.id); setMsg({ text: '已删除', severity: 'success' }); await load();
    setDeleteTarget(null);
  };

  const fieldChip = (v, color) => v ? <Chip label={v} size="small" variant="outlined" color={color} /> : null;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReportIcon color="primary" /> 典型案例库
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>场景筛选</InputLabel>
            <Select value={filterScenario} onChange={e => setFilterScenario(e.target.value)} label="场景筛选">
              <MenuItem value="">全部 ({items.length})</MenuItem>
              <MenuItem value="生产">生产</MenuItem>
              <MenuItem value="生产环境">生产环境</MenuItem>
              <MenuItem value="开发测试">开发测试</MenuItem>
              <MenuItem value="合规性检查">合规性检查</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>新增案例</Button>
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {!filtered.length && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{filterScenario ? '该场景暂无案例' : '暂无案例，点击"新增案例"开始'}</Typography>
        </Paper>
      )}

      {filtered.map(item => (
        <Card key={item.id} variant="outlined" sx={{ mb: 1.5 }}>
          <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1, mr: 1 }}>
                <Chip label={`#${item.reference_no || item.id}`} size="small" sx={{ mr: 1, fontFamily: 'monospace' }} />
                {item.title}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {fieldChip(item.scenario, SCENARIO_COLORS[item.scenario] || 'default')}
              {fieldChip(item.product1, 'primary')}
              {fieldChip(item.product2, 'primary')}
              {fieldChip(item.category, 'secondary')}
              {fieldChip(item.impact, 'warning')}
              {fieldChip(item.found_by, 'info')}
              {fieldChip(item.service1, 'success')}
              {fieldChip(item.service2, 'success')}
              {fieldChip(item.service3, 'success')}
            </Box>
          </CardContent>
          <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
            <IconButton size="small" onClick={() => handleOpen(item)}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => setDeleteTarget(item)}><DeleteIcon fontSize="small" /></IconButton>
          </CardActions>
        </Card>
      ))}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '编辑案例' : '新增案例'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="序号" value={form.reference_no || ''} type="number" size="small" sx={{ width: 80 }}
                onChange={e => setForm({ ...form, reference_no: Number(e.target.value) })} />
              <TextField label="排序" value={form.sort_order || ''} type="number" size="small" sx={{ width: 80 }}
                onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </Box>
            <TextField label="问题描述" value={form.title} size="small" fullWidth required multiline minRows={2}
              onChange={e => setForm({ ...form, title: e.target.value })} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="产品Ⅰ" value={form.product1} size="small" fullWidth onChange={e => setForm({ ...form, product1: e.target.value })} />
              <TextField label="产品Ⅱ" value={form.product2} size="small" fullWidth onChange={e => setForm({ ...form, product2: e.target.value })} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="场景" value={form.scenario} size="small" fullWidth onChange={e => setForm({ ...form, scenario: e.target.value })} />
              <TextField label="影响程度" value={form.impact} size="small" fullWidth onChange={e => setForm({ ...form, impact: e.target.value })} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="发现人" value={form.found_by} size="small" fullWidth onChange={e => setForm({ ...form, found_by: e.target.value })} />
              <TextField label="问题分类" value={form.category} size="small" fullWidth onChange={e => setForm({ ...form, category: e.target.value })} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="服务Ⅰ" value={form.service1} size="small" fullWidth onChange={e => setForm({ ...form, service1: e.target.value })} />
              <TextField label="服务Ⅱ" value={form.service2} size="small" fullWidth onChange={e => setForm({ ...form, service2: e.target.value })} />
              <TextField label="服务Ⅲ" value={form.service3} size="small" fullWidth onChange={e => setForm({ ...form, service3: e.target.value })} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.title.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

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