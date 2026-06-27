import { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, TextField, MenuItem, Button, Grid,
  Alert, Snackbar, Box, Autocomplete, InputAdornment,
  Divider, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RateReviewIcon from '@mui/icons-material/RateReview';
import dayjs from 'dayjs';
import { useWorkContext } from '../context/WorkContext';
import { validateRecord } from '../utils/storage';
import { getDictByCategory } from '../db/dictionaries';
import { getAllProjects } from '../db/projects';
import { autoClassify, autoVerify, getDefaultProfile } from '../db/settings';
import { getCatalog } from '../db/products';
import { getServiceCatalog } from '../db/services';
import { getTemplates } from '../db/templates';

/** Default values for a new empty record */
function getDefaultForm() {
  return {
    date: dayjs().format('YYYY-MM-DD'),
    project: '',
    env: '开发测试',
    stage: '运维支持',
    product1: '数据库',
    product2: '',
    product3: '',
    service1: '运维支持',
    service2: '',
    service3: '',
    method: '远程',
    status: '进行中',
    importance: '重要',
    urgency: '不紧急',
    difficulty: '一般',
    bsc: '常规',
    hours: '',
    content: '',
    remark: '',
    todo: '',
  };
}

/**
 * Work record entry form component.
 * Supports both creating new records and editing existing ones.
 * Uses a two-column grid layout for efficient space usage.
 * Select/Autocomplete options are loaded from the SQLite dictionary table.
 */
export default function WorkForm() {
  const { state, addRecord, updateRecord, setEditing } = useWorkContext();

  const [form, setForm] = useState(getDefaultForm());
  const [errors, setErrors] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [classifying, setClassifying] = useState(false);
  const [listening, setListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [profileId, setProfileId] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verifyDialog, setVerifyDialog] = useState(false);
  const [verifyResults, setVerifyResults] = useState([]);

  /** Load dictionary options + project list asynchronously from API */
  const [dictOptions, setDictOptions] = useState({
    env: [], stage: [], service1: [],
    service2: [], method: [], status: [], importance: [], urgency: [],
    difficulty: [], bsc: [],
  });
  const [projectOptions, setProjectOptions] = useState([]);
  const [catalogAll, setCatalogAll] = useState([]);
  const [serviceAll, setServiceAll] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    async function loadDicts() {
      // Map form key -> dict category name (Chinese, matching dict_categories)
      const catMap = {
        env: '环境', stage: '阶段', method: '方式', status: '状态',
        importance: '重要', urgency: '紧急', difficulty: '难易', bsc: 'BSC',
      };
      const results = {};
      for (const [key, name] of Object.entries(catMap)) {
        results[key] = await getDictByCategory(name);
      }
      setDictOptions(results);
    }
    async function loadProjects() {
      try {
        const projects = await getAllProjects();
        setProjectOptions(projects.map(p => p.name));
      } catch (err) { console.error('Failed to load projects:', err); }
    }
    async function loadProfileId() {
      try {
        const d = await getDefaultProfile();
        if (d?.id) setProfileId(d.id);
      } catch (err) { /* */ }
    }
    async function loadCatalog() {
      try { setCatalogAll(await getCatalog()); } catch (err) { /* */ }
    }
    async function loadServices() {
      try { setServiceAll(await getServiceCatalog()); } catch (err) { /* */ }
    }
    async function loadTemplates() {
      try { setTemplates(await getTemplates()); } catch (err) { /* */ }
    }
    loadDicts();
    loadProjects();
    loadProfileId();
    loadCatalog();
    loadServices();
    loadTemplates();
  }, []);

  // Cascading product catalog levels
  const catalogL1 = useMemo(() => [...new Set(catalogAll.filter(i => i.level === 1).map(i => i.name))], [catalogAll]);
  const catalogL2 = useMemo(() => {
    if (!form.product1) return [];
    const l1 = catalogAll.find(i => i.level === 1 && i.name === form.product1);
    if (!l1) return [];
    return catalogAll.filter(i => i.level === 2 && i.parent_id === l1.id).map(i => i.name);
  }, [catalogAll, form.product1]);
  const catalogL3 = useMemo(() => {
    if (!form.product1 || !form.product2) return [];
    const l1 = catalogAll.find(i => i.level === 1 && i.name === form.product1);
    if (!l1) return [];
    const l2 = catalogAll.find(i => i.level === 2 && i.name === form.product2 && i.parent_id === l1.id);
    if (!l2) return [];
    return catalogAll.filter(i => i.level === 3 && i.parent_id === l2.id).map(i => i.name);
  }, [catalogAll, form.product1, form.product2]);

  // Cascading service catalog levels
  const svcL1 = useMemo(() => [...new Set(serviceAll.filter(i => i.level === 1).map(i => i.name))], [serviceAll]);
  const svcL2 = useMemo(() => {
    if (!form.service1) return [];
    const l1 = serviceAll.find(i => i.level === 1 && i.name === form.service1);
    return l1 ? serviceAll.filter(i => i.level === 2 && i.parent_id === l1.id).map(i => i.name) : [];
  }, [serviceAll, form.service1]);
  const svcL3 = useMemo(() => {
    if (!form.service1 || !form.service2) return [];
    const l1 = serviceAll.find(i => i.level === 1 && i.name === form.service1);
    if (!l1) return [];
    const l2 = serviceAll.find(i => i.level === 2 && i.name === form.service2 && i.parent_id === l1.id);
    return l2 ? serviceAll.filter(i => i.level === 3 && i.parent_id === l2.id).map(i => i.name) : [];
  }, [serviceAll, form.service1, form.service2]);

  /** When editing, populate form with existing record data */
  useEffect(() => {
    if (state.editingRecord) {
      setForm({
        date: state.editingRecord.date || dayjs().format('YYYY-MM-DD'),
        project: state.editingRecord.project || '',
        env: state.editingRecord.env || '开发测试',
        stage: state.editingRecord.stage || '运维支持',
        product1: state.editingRecord.product1 || '数据库',
        product2: state.editingRecord.product2 || '',
        product3: state.editingRecord.product3 || '',
        service1: state.editingRecord.service1 || '运维支持',
        service2: state.editingRecord.service2 || '',
        service3: state.editingRecord.service3 || '',
        method: state.editingRecord.method || '远程',
        status: state.editingRecord.status || '进行中',
        importance: state.editingRecord.importance || '重要',
        urgency: state.editingRecord.urgency || '不紧急',
        difficulty: state.editingRecord.difficulty || '一般',
        bsc: state.editingRecord.bsc || '常规',
        hours: state.editingRecord.hours != null ? String(state.editingRecord.hours) : '',
        content: state.editingRecord.content || '',
        remark: state.editingRecord.remark || '',
        todo: state.editingRecord.todo || '',
      });
    }
  }, [state.editingRecord]);

  /** Update form field value */
  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /** Handle hours input with step validation */
  const handleHoursChange = (event) => {
    const value = event.target.value;
    if (value === '' || /^(\d+\.?\d*|\d*\.?\d+)$/.test(value)) {
      setForm((prev) => ({ ...prev, hours: value }));
      if (errors.hours) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.hours;
          return next;
        });
      }
    }
  };

  /** Validate and submit form */
  const handleSubmit = () => {
    const record = {
      ...form,
      hours: form.hours === '' ? 0 : Number(form.hours),
    };
    const { valid, errors: validationErrors } = validateRecord(record);

    if (!valid) {
      const errMap = {};
      validationErrors.forEach((e) => {
        if (e.includes('日期')) errMap.date = e;
        if (e.includes('项目')) errMap.project = e;
        if (e.includes('工时')) errMap.hours = e;
      });
      setErrors(errMap);
      return;
    }

    if (state.editingRecord) {
      updateRecord({ ...record, id: state.editingRecord.id });
      setSnackbar({ open: true, message: '记录更新成功！', severity: 'success' });
      setEditing(null);
      setForm(getDefaultForm());
    } else {
      addRecord(record);
      setSnackbar({ open: true, message: '记录添加成功！', severity: 'success' });
      // Keep date and project for convenience
      setForm((prev) => ({
        ...getDefaultForm(),
        date: prev.date,
        project: prev.project,
      }));
    }
  };

  /** Reset form to defaults */
  const handleReset = () => {
    if (state.editingRecord) {
      setEditing(null);
    }
    setForm(getDefaultForm());
    setErrors({});
  };

  /** Cancel editing mode */
  const handleCancelEdit = () => {
    setEditing(null);
    setForm(getDefaultForm());
    setErrors({});
  };

  /** AI auto-classify based on work content */
  const handleAutoClassify = async () => {
    if (!form.content.trim()) {
      setSnackbar({ open: true, message: '请先填写工作内容', severity: 'warning' });
      return;
    }
    if (!profileId) {
      setSnackbar({ open: true, message: '请先在LLM模型管理中配置模型', severity: 'warning' });
      return;
    }
    setClassifying(true);
    try {
      const res = await autoClassify(form.content, profileId);
      if (res.ok && res.classified) {
        const c = res.classified;
        setForm(prev => ({
          ...prev,
          env: c.env || prev.env,
          stage: c.stage || prev.stage,
          product1: c.product1 || prev.product1,
          product2: c.product2 || prev.product2,
          product3: c.product3 || prev.product3,
          service1: c.service1 || prev.service1,
          service2: c.service2 || prev.service2,
          service3: c.service3 || prev.service3,
          method: c.method || prev.method,
          bsc: c.bsc || prev.bsc,
          importance: c.importance || prev.importance,
          urgency: c.urgency || prev.urgency,
          difficulty: c.difficulty || prev.difficulty,
        }));
        setSnackbar({ open: true, message: '智能分类完成！', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: res.message || '分类失败', severity: 'warning' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: '分类失败: ' + e.message, severity: 'error' });
    } finally {
      setClassifying(false);
    }
  };

  /** AI content completeness verification — 质疑功能 */
  const handleAutoVerify = async () => {
    if (!form.content.trim()) {
      setSnackbar({ open: true, message: '请先填写工作内容', severity: 'warning' });
      return;
    }
    if (!profileId) {
      setSnackbar({ open: true, message: '请先在LLM模型管理中配置模型', severity: 'warning' });
      return;
    }
    setVerifying(true);
    try {
      const res = await autoVerify(form.content, profileId);
      if (res.ok) {
        setVerifyResults(res.questions || []);
        setVerifyDialog(true);
      } else {
        setSnackbar({ open: true, message: res.message || '分析失败', severity: 'warning' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: '质疑分析失败: ' + e.message, severity: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  /** Voice input via browser SpeechRecognition API */
  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSnackbar({ open: true, message: '浏览器不支持语音识别，请使用 Chrome 或 Edge', severity: 'warning' });
      return;
    }
    if (listening) {
      recognition?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'zh-CN';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setForm(prev => ({ ...prev, content: prev.content + transcript }));
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error !== 'aborted') {
        setSnackbar({ open: true, message: '语音识别错误: ' + e.error, severity: 'warning' });
      }
    };
    rec.onend = () => setListening(false);
    rec.start();
    setRecognition(rec);
    setListening(true);
    setSnackbar({ open: true, message: '正在聆听...点击麦克风停止', severity: 'info' });
  };

  /** Apply a template to pre-fill form fields */
  const handleApplyTemplate = (tplName) => {
    const tpl = templates.find(t => t.name === tplName);
    if (!tpl) return;
    setSelectedTemplate(tplName);
    setForm(prev => ({
      ...prev,
      project: tpl.project || prev.project,
      env: tpl.env || prev.env,
      stage: tpl.stage || prev.stage,
      product1: tpl.product1 || prev.product1,
      product2: tpl.product2 || prev.product2,
      product3: tpl.product3 || prev.product3,
      service1: tpl.service1 || prev.service1,
      service2: tpl.service2 || prev.service2,
      service3: tpl.service3 || prev.service3,
      method: tpl.method || prev.method,
      status: tpl.status || prev.status,
      importance: tpl.importance || prev.importance,
      urgency: tpl.urgency || prev.urgency,
      difficulty: tpl.difficulty || prev.difficulty,
      bsc: tpl.bsc || prev.bsc,
      content: tpl.content || prev.content,
      remark: tpl.remark || prev.remark,
      hours: tpl.hours > 0 ? String(tpl.hours) : prev.hours,
    }));
  };

  const isEditing = !!state.editingRecord;

  return (
    <Box>
      <Paper
        elevation={2}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 2,
          maxWidth: 1100,
          mx: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: 'primary.700',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {isEditing ? '编辑工作记录' : '录入工作记录'}
            {isEditing && (
              <Typography component="span" variant="body2" color="text.secondary">
                (正在编辑: {state.editingRecord.project?.length > 30
                  ? state.editingRecord.project.slice(0, 30) + '...'
                  : state.editingRecord.project})
              </Typography>
            )}
          </Typography>

          {/* Template selector — top-right, only when not editing */}
          {!isEditing && templates.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                select
                label="从模板快速填充"
                value={selectedTemplate}
                onChange={e => handleApplyTemplate(e.target.value)}
                size="small"
                sx={{ minWidth: 220 }}
              >
                <MenuItem value=""><em>（选择模板）</em></MenuItem>
                {templates.map(t => (
                  <MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>
                ))}
              </TextField>
              {selectedTemplate && (
                <Button size="small" onClick={() => { setSelectedTemplate(''); setForm(getDefaultForm()); }}>
                  清除
                </Button>
              )}
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={2.5}>
          {/* Row 1: 日期 | 项目 */}
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="日期"
              type="date"
              value={form.date}
              onChange={handleChange('date')}
              fullWidth
              required
              size="small"
              error={!!errors.date}
              helperText={errors.date}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'aria-label': '工作日期' }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={8}>
            <Autocomplete
              options={projectOptions}
              value={form.project || null}
              onChange={(_, newValue) => {
                setForm((prev) => ({ ...prev, project: newValue || '' }));
                if (errors.project) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.project;
                    return next;
                  });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="项目"
                  required
                  size="small"
                  error={!!errors.project}
                  helperText={errors.project || '请从项目列表中选择'}
                  inputProps={{ ...params.inputProps, 'aria-label': '项目名称' }}
                />
              )}
            />
          </Grid>

          {/* Row 2: 环境 | 阶段 | 方式 */}
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select
              label="环境"
              value={form.env}
              onChange={handleChange('env')}
              fullWidth
              size="small"
            >
              {dictOptions.env.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select
              label="阶段"
              value={form.stage}
              onChange={handleChange('stage')}
              fullWidth
              size="small"
            >
              {dictOptions.stage.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select
              label="方式"
              value={form.method}
              onChange={handleChange('method')}
              fullWidth
              size="small"
            >
              {dictOptions.method.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Row 3: 产品大类 | 产品系列 | 产品版本 */}
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="产品Ⅰ"
              value={form.product1}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, product1: e.target.value, product2: '', product3: '' }));
              }}
              fullWidth
              size="small"
            >
              {catalogL1.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="产品Ⅱ"
              value={form.product2}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, product2: e.target.value, product3: '' }));
              }}
              fullWidth
              size="small"
              disabled={!form.product1}
            >
              {catalogL2.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="产品Ⅲ"
              value={form.product3 || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, product3: e.target.value }))}
              fullWidth
              size="small"
              disabled={!form.product2}
            >
              {catalogL3.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          {/* Row 4: 服务大类 | 服务分类 | 服务子项 */}
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select
              label="服务Ⅰ"
              value={form.service1}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, service1: e.target.value, service2: '', service3: '' }));
              }}
              fullWidth
              size="small"
            >
              {svcL1.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select
              label="服务Ⅱ"
              value={form.service2}
              onChange={(e) => setForm((prev) => ({ ...prev, service2: e.target.value, service3: '' }))}
              fullWidth
              size="small"
              disabled={!form.service1}
            >
              {svcL2.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select
              label="服务Ⅲ"
              value={form.service3 || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, service3: e.target.value }))}
              fullWidth
              size="small"
              disabled={!form.service2}
            >
              {svcL3.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Row 4: 状态 | 重要 | 紧急 | 难易 */}
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="状态"
              value={form.status}
              onChange={handleChange('status')}
              fullWidth
              size="small"
            >
              {dictOptions.status.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="重要"
              value={form.importance}
              onChange={handleChange('importance')}
              fullWidth
              size="small"
            >
              {dictOptions.importance.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="紧急"
              value={form.urgency}
              onChange={handleChange('urgency')}
              fullWidth
              size="small"
            >
              {dictOptions.urgency.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="难易"
              value={form.difficulty}
              onChange={handleChange('difficulty')}
              fullWidth
              size="small"
            >
              {dictOptions.difficulty.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Row 5: BSC | 工时 */}
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="BSC"
              value={form.bsc}
              onChange={handleChange('bsc')}
              fullWidth
              size="small"
            >
              {dictOptions.bsc.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="工时"
              value={form.hours}
              onChange={handleHoursChange}
              fullWidth
              required
              size="small"
              type="text"
              inputMode="decimal"
              error={!!errors.hours}
              helperText={errors.hours || '0.5 ~ 24 小时'}
              InputProps={{
                endAdornment: <InputAdornment position="end">小时</InputAdornment>,
              }}
              inputProps={{ 'aria-label': '投入工时', step: 0.5, min: 0.5, max: 24 }}
            />
          </Grid>

          {/* Row 6: 内容 (full width) */}
          <Grid item xs={12}>
            <Box sx={{ position: 'relative' }}>
              <TextField
                label="工作内容"
                value={form.content}
                onChange={handleChange('content')}
                fullWidth
                multiline
                minRows={3}
                maxRows={6}
                size="small"
                placeholder="详细描述本次工作的内容……写完点右侧✨智能分类，再用🔍质疑检查完整性"
              />
              <Box sx={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 1 }}>
                <Button variant="outlined" size="small"
                  onClick={handleVoice}
                  color={listening ? 'error' : 'primary'}
                  startIcon={listening ? <MicOffIcon /> : <MicIcon />}
                  sx={{ borderRadius: 4 }}
                >
                  {listening ? '停止' : '语音录入'}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAutoClassify}
                  disabled={classifying || !form.content.trim()}
                  startIcon={classifying ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                  sx={{ borderRadius: 4 }}
                >
                  {classifying ? '分类中' : '智能分类'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="warning"
                  onClick={handleAutoVerify}
                  disabled={verifying || !form.content.trim()}
                  startIcon={verifying ? <CircularProgress size={14} color="inherit" /> : <RateReviewIcon />}
                  sx={{ borderRadius: 4, borderColor: 'warning.main' }}
                >
                  {verifying ? '分析中' : '质疑'}
                </Button>
              </Box>
            </Box>
          </Grid>

          {/* Row 7: 备注 | 待办 */}
          <Grid item xs={12} md={6}>
            <TextField
              label="备注"
              value={form.remark}
              onChange={handleChange('remark')}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              size="small"
              placeholder="补充说明（可选）"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="待办事项"
              value={form.todo}
              onChange={handleChange('todo')}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              size="small"
              placeholder="后续待办事项（可选）"
            />
          </Grid>

          {/* Submit buttons */}
          <Grid item xs={12}>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {isEditing && (
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={handleCancelEdit}
                >
                  取消编辑
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleReset}
              >
                重置表单
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSubmit}
                sx={{
                  px: 4,
                  background: 'linear-gradient(135deg, #1565c0, #1e88e5)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0d47a1, #1565c0)',
                  },
                }}
              >
                {isEditing ? '更新记录' : '提交记录'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 质疑分析结果弹窗 */}
      <Dialog
        open={verifyDialog}
        onClose={() => setVerifyDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RateReviewIcon color="warning" />
          内容完整性质疑分析
          {verifyResults.length > 0 && (
            <Chip
              label={`发现 ${verifyResults.length} 个问题`}
              color="warning"
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </DialogTitle>
        <DialogContent dividers>
          {verifyResults.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" color="success.main">内容完整度良好</Typography>
              <Typography variant="body2" color="text.secondary">
                未发现明显的信息缺失问题，建议提交前再次确认关键信息是否完整。
              </Typography>
            </Box>
          ) : (
            <List dense>
              {verifyResults.map((item, idx) => (
                <ListItem key={idx} alignItems="flex-start" sx={{
                  bgcolor: item.severity === 'warning' ? 'error.50' : 'warning.50',
                  borderRadius: 1,
                  mb: 1,
                  border: '1px solid',
                  borderColor: item.severity === 'warning' ? 'error.200' : 'warning.200',
                }}>
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    {item.severity === 'warning' ? (
                      <WarningAmberIcon color="error" fontSize="small" />
                    ) : (
                      <TipsAndUpdatesIcon color="warning" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={600} color="text.primary">
                        [{item.severity === 'warning' ? '建议修改' : '建议补充'}] {item.issue}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        💡 {item.suggestion}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyDialog(false)} variant="contained">
            知道了
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
