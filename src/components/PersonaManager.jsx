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
import PersonIcon from '@mui/icons-material/Person';
import { getPersonas, createPersona, updatePersona, deletePersona } from '../db/personas';
import { getAllProjects } from '../db/projects';

const EMPTY_FORM = {
  project_name: '',
  business_profile: '',
  technical_profile: '',
  pain_points: '',
  key_personnel: '',
  expectations: '',
  notes: '',
};

const SECTIONS = [
  { key: 'business_profile', label: '商务面貌', placeholder: '客户的商务特征，如：价格敏感、决策链长、关系型、招标采购...' },
  { key: 'technical_profile', label: '技术面貌', placeholder: '客户的技术水平，如：有专职DBA、熟悉Oracle、技术能力中等...' },
  { key: 'pain_points', label: '痛点', placeholder: '客户的核心痛点，如：迁移风险大、性能不稳定、厂商锁定担忧...' },
  { key: 'key_personnel', label: '关键人员', placeholder: '对接的关键角色，如：张三-信息中心主任/决策者，李四-DBA/技术接口...' },
  { key: 'expectations', label: '期望', placeholder: '客户的期望，如：希望平滑迁移、需要7x24支持、关注国产化合规...' },
  { key: 'notes', label: '备注', placeholder: '其他补充信息...' },
];

export default function PersonaManager() {
  const [personas, setPersonas] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filterProject, setFilterProject] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadPersonas = async () => {
    try { setPersonas(await getPersonas(filterProject)); } catch (e) { /* */ }
  };

  useEffect(() => {
    getAllProjects().then(p => setProjects(p)).catch(() => {});
  }, []);

  useEffect(() => { loadPersonas(); }, [filterProject]);

  const handleOpen = (p) => {
    setEditing(p || null);
    setForm(p ? {
      project_name: p.project_name,
      business_profile: p.business_profile,
      technical_profile: p.technical_profile,
      pain_points: p.pain_points,
      key_personnel: p.key_personnel,
      expectations: p.expectations,
      notes: p.notes,
    } : EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updatePersona(editing.id, form);
        setMsg({ text: '画像已更新', severity: 'success' });
      } else {
        await createPersona(form);
        setMsg({ text: '画像已创建', severity: 'success' });
      }
      setDialogOpen(false);
      await loadPersonas();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePersona(deleteTarget.id);
      setMsg({ text: '已删除', severity: 'success' });
      setDeleteTarget(null);
      await loadPersonas();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon color="primary" /> 用户画像
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
            新建画像
          </Button>
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {!personas.length && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{filterProject ? '该项目暂无画像' : '暂无画像，点击"新建画像"开始'}</Typography>
        </Paper>
      )}

      {personas.map(p => (
        <Card key={p.id} variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <Chip label={p.project_name} color="primary" size="small" sx={{ fontWeight: 600, mr: 1 }} />
              <Typography variant="caption" color="text.secondary">
                更新: {p.updated_at || p.created_at}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
              {SECTIONS.map(s => (
                <Box key={s.key}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">{s.label}</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.2 }}>
                    {p[s.key] || <Typography component="span" variant="caption" color="text.disabled">未填写</Typography>}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
          <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
            <IconButton size="small" onClick={() => handleOpen(p)}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => setDeleteTarget(p)}><DeleteIcon fontSize="small" /></IconButton>
          </CardActions>
        </Card>
      ))}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '编辑画像' : '新建用户画像'}</DialogTitle>
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
            {SECTIONS.map(s => (
              <TextField key={s.key} label={s.label} value={form[s.key]} onChange={e => setForm({ ...form, [s.key]: e.target.value })}
                multiline minRows={2} maxRows={5} size="small" fullWidth placeholder={s.placeholder} />
            ))}
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
          <Typography>确定要删除「<strong>{deleteTarget?.project_name || ''}</strong>」吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}