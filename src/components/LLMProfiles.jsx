import { useState, useEffect, useCallback } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton,
  List, ListItem, ListItemButton, ListItemText, ListItemIcon,
  CircularProgress, Alert, Divider, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CableIcon from '@mui/icons-material/Cable';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getProfiles, createProfile, updateProfile, deleteProfile, setDefaultProfile, testConnectionDirect, listModelsFromApi } from '../db/settings';

const EMPTY = { name: '', endpoint: '', api_key: '', model: '' };

export default function LLMProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [modelMenu, setModelMenu] = useState(null);
  const [modelList, setModelList] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const load = async () => {
    try {
      const list = await getProfiles();
      setProfiles(list);
      if (!selectedId && list.length > 0) {
        const first = list[0];
        setSelectedId(first.id);
        setForm({ name: first.name, endpoint: first.endpoint, api_key: first.api_key, model: first.model });
      }
    } catch (e) { /* */ }
  };

  useEffect(() => { load(); }, []);

  const selected = profiles.find(p => p.id === selectedId);

  const handleSelect = (p) => {
    setSelectedId(p.id);
    setForm({ name: p.name, endpoint: p.endpoint, api_key: p.api_key, model: p.model });
    setTestResult(null);
    setMsg(null);
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(EMPTY);
    setTestResult(null);
    setMsg(null);
  };

  const doSave = async () => {
    try {
      if (selectedId) {
        await updateProfile(selectedId, form.name, form.endpoint, form.api_key, form.model);
        setMsg({ text: '已保存', severity: 'success' });
      } else {
        const created = await createProfile(form.name, form.endpoint, form.api_key, form.model);
        setSelectedId(created.id);
        setMsg({ text: '已创建并保存', severity: 'success' });
      }
      await load();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteProfile(selectedId);
      setMsg({ text: '已删除', severity: 'success' });
      setSelectedId(null);
      setForm(EMPTY);
      await load();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  // Test connection using form values directly
  const handleTest = async () => {
    if (!form.endpoint) {
      setMsg({ text: '请先填写 API 端点', severity: 'warning' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const data = await testConnectionDirect(form.endpoint, form.api_key, form.model);
      setTestResult({ ok: data.ok, message: data.message || (data.ok ? '连接成功' : '连接失败') });
    } catch (e) {
      setTestResult({ ok: false, message: '连接失败: ' + e.message });
    } finally {
      setTesting(false);
    }
  };

  // Fetch available models from the endpoint
  const handleFetchModels = async (e) => {
    setModelMenu(e.currentTarget);
    if (!form.endpoint) {
      setMsg({ text: '请先填写 API 端点', severity: 'warning' });
      return;
    }
    setLoadingModels(true);
    try {
      const data = await listModelsFromApi(form.endpoint.replace(/\/chat\/completions$/, ''), form.api_key);
      let list = [];
      if (data.ok && data.models) {
        list = data.models;
      }
      // Always include current model value
      if (form.model) {
        const exists = list.some(m => m.id === form.model);
        if (!exists) list.unshift({ id: form.model });
      }
      setModelList(list);
      if (!data.ok || !data.models) {
        setMsg({ text: data.message || '无法获取模型列表', severity: 'warning' });
      }
    } catch (e) {
      setModelList([]);
      setMsg({ text: '获取模型列表失败', severity: 'error' });
    } finally {
      setLoadingModels(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 140px)' }}>
      {/* Left Panel: Profile List */}
      <Paper variant="outlined" sx={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={600}>AI 助手</Typography>
        </Box>
        <List dense sx={{ overflow: 'auto', flexGrow: 1 }}>
          {profiles.map(p => (
            <ListItem key={p.id} disablePadding secondaryAction={
              <IconButton edge="end" size="small" onClick={async () => { await deleteProfile(p.id); load(); if (p.id === selectedId) { setSelectedId(null); setForm(EMPTY); } }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            }>
              <ListItemButton selected={p.id === selectedId} onClick={() => handleSelect(p)} sx={{ pr: 5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <SmartToyIcon fontSize="small" color={p.id === selectedId ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText primary={p.name} secondary={`${p.model}${p.is_default === 1 ? ' · 默认' : ''}`} primaryTypographyProps={{ fontSize: '0.875rem' }} secondaryTypographyProps={{ fontSize: '0.7rem' }} />
                {p.is_default === 1 && <StarIcon sx={{ fontSize: 16, color: 'warning.main', ml: 0.5 }} />}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button fullWidth size="small" startIcon={<AddIcon />} onClick={handleNew} color={!selectedId ? 'primary' : 'inherit'} variant={!selectedId ? 'contained' : 'text'}>
            新建助手
          </Button>
        </Box>
      </Paper>

      {/* Right Panel: Form */}
      <Paper variant="outlined" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3, overflow: 'auto' }}>
        {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
          {selectedId ? '编辑助手' : '新建助手'}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 520 }}>
          <TextField label="名称" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            size="small" placeholder="如：DeepSeek、通义千问" fullWidth />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="模型标识" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
              size="small" placeholder="输入或点模型列表选择" sx={{ flexGrow: 1 }} />
            <Button variant="outlined" size="small" onClick={handleFetchModels} endIcon={loadingModels ? <CircularProgress size={14} /> : <ExpandMoreIcon />}
              sx={{ flexShrink: 0 }}>
              模型列表
            </Button>
          </Box>
          <TextField label="API 端点" value={form.endpoint} onChange={e => setForm({ ...form, endpoint: e.target.value })}
            size="small" placeholder="https://api.deepseek.com/v1/chat/completions" fullWidth />
          <TextField label="API Key" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })}
            size="small" type="password" placeholder="sk-..." fullWidth />
        </Box>

        <Menu anchorEl={modelMenu} open={Boolean(modelMenu)} onClose={() => setModelMenu(null)}>
          {modelList.map(m => (
            <MenuItem key={m.id || m} onClick={() => { setForm({ ...form, model: m.id || m }); setModelMenu(null); }}>
              {m.id || m}
            </MenuItem>
          ))}
          {modelList.length === 0 && !loadingModels && (
            <MenuItem disabled>无可用模型</MenuItem>
          )}
        </Menu>

        <Divider sx={{ my: 2, maxWidth: 520 }} />

        <Box sx={{ maxWidth: 520 }}>
          {testResult && (
            <Alert severity={testResult.ok ? 'success' : 'error'} variant="outlined" sx={{ mb: 1.5 }}>
              {testResult.message}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={testing ? <CircularProgress size={16} /> : <CableIcon />}
              onClick={handleTest} disabled={testing || !form.endpoint}>
              测试连接
            </Button>
            <Button variant="contained" onClick={doSave} disabled={!form.name || !form.endpoint}>
              保存
            </Button>
            {selectedId && !selected?.is_default && (
              <Button variant="outlined" color="warning" startIcon={<StarIcon />}
                onClick={async () => { await setDefaultProfile(selectedId); setMsg({ text: '已设为默认模型', severity: 'success' }); await load(); window.dispatchEvent(new Event('defaultProfileChanged')); }}>
                设为默认
              </Button>
            )}
            {selectedId && (
              <Button variant="outlined" color="error" onClick={handleDelete}>
                删除
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
