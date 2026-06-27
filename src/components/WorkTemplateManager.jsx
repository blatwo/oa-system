import { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, Box, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Tooltip, Alert, Chip, Autocomplete,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../db/templates';
import { getDictByCategory } from '../db/dictionaries';
import { getAllProjects } from '../db/projects';
import { getCatalog } from '../db/products';
import { getServiceCatalog } from '../db/services';

const FIELD_LABELS = {
  project: '项目', env: '环境', stage: '阶段',
  product1: '产品1', product2: '产品2', product3: '产品3',
  service1: '服务1', service2: '服务2', service3: '服务3',
  method: '方式', status: '状态', importance: '重要度',
  urgency: '紧急度', difficulty: '难度', bsc: 'BSC',
  content: '内容', remark: '备注',
};

const DICT_CATEGORIES = { env: '环境', stage: '阶段', method: '方式', status: '状态', importance: '重要', urgency: '紧急', difficulty: '难易', bsc: 'BSC' };

const EMPTY = {
  name: '', project: '', env: '', stage: '',
  product1: '', product2: '', product3: '',
  service1: '', service2: '', service3: '',
  method: '', status: '进行中', importance: '重要',
  urgency: '不紧急', difficulty: '一般', bsc: '',
  content: '', remark: '', hours: 0, sort_order: 0,
};

export default function WorkTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [msg, setMsg] = useState(null);

  // Dictionary options
  const [dictOptions, setDictOptions] = useState({});
  const [projectNames, setProjectNames] = useState([]);
  const [catalogAll, setCatalogAll] = useState([]);
  const [serviceAll, setServiceAll] = useState([]);

  const load = async () => { try { setTemplates(await getTemplates()); } catch { /* */ } };

  useEffect(() => {
    load();
    (async () => {
      const catMap = DICT_CATEGORIES;
      const results = {};
      for (const [key, name] of Object.entries(catMap)) {
        try { results[key] = (await getDictByCategory(name)).map(d => d.value || d); } catch { results[key] = []; }
      }
      setDictOptions(results);
    })();
    (async () => { try { const p = await getAllProjects(); setProjectNames(p.map(x => x.name)); } catch { /* */ } })();
    (async () => { try { setCatalogAll(await getCatalog()); } catch { /* */ } })();
    (async () => { try { setServiceAll(await getServiceCatalog()); } catch { /* */ } })();
  }, []);

  // Cascading catalog
  const catL1 = useMemo(() => [...new Set(catalogAll.filter(i => i.level === 1).map(i => i.name))], [catalogAll]);
  const catL2 = useMemo(() => { const l1 = catalogAll.find(i => i.level === 1 && i.name === form.product1); return l1 ? catalogAll.filter(i => i.level === 2 && i.parent_id === l1.id).map(i => i.name) : []; }, [catalogAll, form.product1]);
  const catL3 = useMemo(() => { const l1 = catalogAll.find(i => i.level === 1 && i.name === form.product1); if (!l1) return []; const l2 = catalogAll.find(i => i.level === 2 && i.name === form.product2 && i.parent_id === l1.id); return l2 ? catalogAll.filter(i => i.level === 3 && i.parent_id === l2.id).map(i => i.name) : []; }, [catalogAll, form.product1, form.product2]);

  const svcL1 = useMemo(() => [...new Set(serviceAll.filter(i => i.level === 1).map(i => i.name))], [serviceAll]);
  const svcL2 = useMemo(() => { const l1 = serviceAll.find(i => i.level === 1 && i.name === form.service1); return l1 ? serviceAll.filter(i => i.level === 2 && i.parent_id === l1.id).map(i => i.name) : []; }, [serviceAll, form.service1]);
  const svcL3 = useMemo(() => { const l1 = serviceAll.find(i => i.level === 1 && i.name === form.service1); if (!l1) return []; const l2 = serviceAll.find(i => i.level === 2 && i.name === form.service2 && i.parent_id === l1.id); return l2 ? serviceAll.filter(i => i.level === 3 && i.parent_id === l2.id).map(i => i.name) : []; }, [serviceAll, form.service1, form.service2]);

  const handleAdd = () => { setEditing(null); setForm({ ...EMPTY, sort_order: templates.length + 1 }); setDialogOpen(true); };
  const handleEdit = (row) => { setEditing(row); setForm({ ...row }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setMsg({ text: '模板名称不能为空', severity: 'warning' }); return; }
    try {
      if (editing) { await updateTemplate(editing.id, form); setMsg({ text: '已更新', severity: 'success' }); }
      else { await createTemplate(form); setMsg({ text: '已新增', severity: 'success' }); }
      setDialogOpen(false); await load();
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; await deleteTemplate(deleteTarget.id); setMsg({ text: '已删除', severity: 'success' }); await load(); setDeleteTarget(null);
  };

  const filledFields = (t) => {
    const f = []; for (const [k, v] of Object.entries(t)) { if (v && FIELD_LABELS[k]) f.push(FIELD_LABELS[k]); }
    return f.slice(0, 5);
  };

  const columns = [
    { field: 'name', headerName: '模板名称', flex: 2, minWidth: 150, resizable: true,
      renderCell: (p) => (<Typography variant="body2" sx={{ fontWeight: 600 }}><DescriptionIcon sx={{ fontSize: 14, mr: 0.5, color: 'primary.light', verticalAlign: 'middle' }} />{p.value}</Typography>),
    },
    { field: 'preview', headerName: '预填字段', flex: 3, minWidth: 200, resizable: true, sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {filledFields(p.row).map(f => <Chip key={f} label={f} size="small" variant="outlined" sx={{ fontSize: 11 }} />)}
          {p.row.hours > 0 && <Chip label={`${p.row.hours}h`} size="small" color="primary" variant="outlined" sx={{ fontSize: 11 }} />}
        </Box>
      ),
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

  // Dict-based select
  const dictSelect = (key, label) => (
    <TextField select label={label} value={form[key] || ''} size="small" sx={{ minWidth: 110 }}
      onChange={e => setForm({ ...form, [key]: e.target.value })}>
      <MenuItem value="">—</MenuItem>
      {(dictOptions[key] || []).map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
    </TextField>
  );

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={600}>工作模板管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>新增模板</Button>
      </Box>
      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        创建模板后，在「录入工作」页面选择模板，可自动填充表单字段。所有选项均与字典、产品目录等保持一致。
      </Typography>
      <Paper variant="outlined">
        <Box sx={{ height: 500, width: '100%' }}>
          <DataGrid rows={templates} columns={columns} pageSize={25} rowsPerPageOptions={[25, 50]} disableSelectionOnClick
            sx={{ border: 0, '& .MuiDataGrid-cell': { fontSize: '0.85rem' }, '& .MuiDataGrid-columnHeaders': { backgroundColor: '#e8f5e9', fontWeight: 600 } }} />
        </Box>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '编辑模板' : '新增模板'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            {/* Template name */}
            <TextField label="模板名称 *" value={form.name} size="small" fullWidth required autoFocus
              onChange={e => setForm({ ...form, name: e.target.value })} />

            {/* Dictionary-based selects */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Autocomplete size="small" options={projectNames} freeSolo
                value={form.project || null}
                onChange={(_, v) => setForm({ ...form, project: v || '' })}
                renderInput={(params) => <TextField {...params} label="项目" />}
                sx={{ minWidth: 200 }} />
              {dictSelect('env', '环境')}
              {dictSelect('stage', '阶段')}
              {dictSelect('method', '方式')}
              {dictSelect('status', '状态')}
              {dictSelect('importance', '重要度')}
              {dictSelect('urgency', '紧急度')}
              {dictSelect('difficulty', '难度')}
              {dictSelect('bsc', 'BSC')}
              <TextField label="工时(h)" value={form.hours || ''} type="number" size="small" sx={{ width: 80 }}
                onChange={e => setForm({ ...form, hours: Number(e.target.value) })} />
              <TextField label="排序" value={form.sort_order || ''} type="number" size="small" sx={{ width: 80 }}
                onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </Box>

            {/* Product catalog cascading */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField select label="产品1" value={form.product1 || ''} size="small" sx={{ minWidth: 140 }}
                onChange={e => setForm({ ...form, product1: e.target.value, product2: '', product3: '' })}>
                <MenuItem value="">—</MenuItem>{catL1.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
              <TextField select label="产品2" value={form.product2 || ''} size="small" sx={{ minWidth: 140 }}
                onChange={e => setForm({ ...form, product2: e.target.value, product3: '' })} disabled={!catL2.length}>
                <MenuItem value="">—</MenuItem>{catL2.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
              <TextField select label="产品3" value={form.product3 || ''} size="small" sx={{ minWidth: 140 }}
                onChange={e => setForm({ ...form, product3: e.target.value })} disabled={!catL3.length}>
                <MenuItem value="">—</MenuItem>{catL3.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Box>

            {/* Service catalog cascading */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField select label="服务1" value={form.service1 || ''} size="small" sx={{ minWidth: 140 }}
                onChange={e => setForm({ ...form, service1: e.target.value, service2: '', service3: '' })}>
                <MenuItem value="">—</MenuItem>{svcL1.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
              <TextField select label="服务2" value={form.service2 || ''} size="small" sx={{ minWidth: 140 }}
                onChange={e => setForm({ ...form, service2: e.target.value, service3: '' })} disabled={!svcL2.length}>
                <MenuItem value="">—</MenuItem>{svcL2.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
              <TextField select label="服务3" value={form.service3 || ''} size="small" sx={{ minWidth: 140 }}
                onChange={e => setForm({ ...form, service3: e.target.value })} disabled={!svcL3.length}>
                <MenuItem value="">—</MenuItem>{svcL3.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Box>

            <TextField label="工作内容" value={form.content || ''} size="small" fullWidth multiline minRows={3}
              onChange={e => setForm({ ...form, content: e.target.value })} />
            <TextField label="备注" value={form.remark || ''} size="small" fullWidth multiline minRows={2}
              onChange={e => setForm({ ...form, remark: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent><Typography>确定要删除模板「<strong>{deleteTarget?.name || ''}</strong>」吗？</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
