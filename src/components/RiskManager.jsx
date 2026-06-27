import { useState, useEffect } from 'react';
import {
  Paper, Typography, TextField, Button, Box,
  Card, CardContent, CardActions, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { getRisks, createRisk, updateRisk, deleteRisk } from '../db/risks';
import { getAllProjects } from '../db/projects';

const RISK_TYPES = ['技术风险', '商务风险', '进度风险', '合规风险', '人员风险', '其他'];
const RISK_LEVELS = ['高', '中', '低'];
const RISK_STATUSES = ['待处理', '处理中', '已关闭'];

const levelColors = { '高': 'error', '中': 'warning', '低': 'success' };
const statusColors = { '待处理': 'error', '处理中': 'info', '已关闭': 'default' };

const EMPTY_FORM = {
  project_name: '',
  risk_type: '技术风险',
  risk_level: '中',
  description: '',
  impact: '',
  mitigation: '',
  status: '待处理',
  owner: '',
};

export default function RiskManager() {
  const [risks, setRisks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filterProject, setFilterProject] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadRisks = async () => {
    try { setRisks(await getRisks(filterProject)); } catch (e) { /* */ }
  };

  useEffect(() => {
    getAllProjects().then(p => setProjects(p)).catch(() => {});
  }, []);

  useEffect(() => { loadRisks(); }, [filterProject]);

  const handleOpen = (r) => {
    setEditing(r || null);
    setForm(r ? {
      project_name: r.project_name,
      risk_type: r.risk_type,
      risk_level: r.risk_level,
      description: r.description,
      impact: r.impact,
      mitigation: r.mitigation,
      status: r.status,
      owner: r.owner,
    } : EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateRisk(editing.id, form);
        setMsg({ text: '风险已更新', severity: 'success' });
      } else {
        await createRisk(form);
        setMsg({ text: '风险已创建', severity: 'success' });
      }
      setDialogOpen(false);
      await loadRisks();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRisk(deleteTarget.id);
      setMsg({ text: '已删除', severity: 'success' });
      setDeleteTarget(null);
      await loadRisks();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" /> 风险管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>按项目筛选</InputLabel>
            <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} label="按项目筛选">
              <MenuItem value="">全部项目</MenuItem>
              {projects.map(p => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>
            新建风险
          </Button>
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {!risks.length && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{filterProject ? '该项目暂无风险记录' : '暂无风险记录，点击"新建风险"开始'}</Typography>
        </Paper>
      )}

      {risks.map(r => (
        <Card key={r.id} variant="outlined" sx={{ mb: 2, borderLeft: 4, borderLeftColor: `${levelColors[r.risk_level] || 'grey'}.main` }}>
          <CardContent sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Chip label={r.project_name} color="primary" size="small" sx={{ fontWeight: 600 }} />
              <Chip label={r.risk_type} variant="outlined" size="small" />
              <Chip label={r.risk_level} color={levelColors[r.risk_level] || 'default'} size="small" />
              <Chip label={r.status} color={statusColors[r.status] || 'default'} size="small" />
              {r.owner && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  责任人: {r.owner}
                </Typography>
              )}
            </Box>
            {r.description && (
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                {r.description}
              </Typography>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
              {r.impact && (
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">影响</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.impact}</Typography>
                </Box>
              )}
              {r.mitigation && (
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">应对措施</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.mitigation}</Typography>
                </Box>
              )}
            </Box>
          </CardContent>
          <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
            <IconButton size="small" onClick={() => handleOpen(r)}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => setDeleteTarget(r)}><DeleteIcon fontSize="small" /></IconButton>
          </CardActions>
        </Card>
      ))}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '编辑风险' : '新建风险'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {!editing && (
              <FormControl size="small" fullWidth required>
                <InputLabel>关联项目</InputLabel>
                <Select value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} label="关联项目">
                  {projects.map(p => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>风险类型</InputLabel>
                <Select value={form.risk_type} onChange={e => setForm({ ...form, risk_type: e.target.value })} label="风险类型">
                  {RISK_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>风险等级</InputLabel>
                <Select value={form.risk_level} onChange={e => setForm({ ...form, risk_level: e.target.value })} label="风险等级">
                  {RISK_LEVELS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>状态</InputLabel>
                <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} label="状态">
                  {RISK_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <TextField label="风险描述" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              multiline minRows={2} maxRows={4} size="small" fullWidth placeholder="描述风险的具体内容..." />
            <TextField label="影响" value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })}
              multiline minRows={2} maxRows={4} size="small" fullWidth placeholder="风险发生时会产生什么影响..." />
            <TextField label="应对措施" value={form.mitigation} onChange={e => setForm({ ...form, mitigation: e.target.value })}
              multiline minRows={3} maxRows={6} size="small" fullWidth placeholder="如何预防和应对这个风险..." />
            <TextField label="责任人" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })}
              size="small" fullWidth placeholder="负责跟踪此风险的人员..." />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.project_name}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除「<strong>{deleteTarget?.description || deleteTarget?.id || ''}</strong>」吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}