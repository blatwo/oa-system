import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Paper, Typography, TextField, Button, Box, CircularProgress,
  Card, CardContent, Select, MenuItem, FormControl, InputLabel,
  ToggleButtonGroup, ToggleButton, Alert,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { getProfiles, analyzeData } from '../db/settings';
import { getAllProjects } from '../db/projects';

const ANALYSIS_MODES = [
  { value: 'project_summary', label: '项目总结', desc: '分析项目概况、工时分布、进展与风险' },
  { value: 'issue_analysis', label: '问题分析', desc: '识别问题模式、高频问题、最佳实践' },
  { value: 'free_question', label: '自由提问', desc: '基于数据库内容，自由问答' },
];

export default function AIAnalysis() {
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState(0);

  const [mode, setMode] = useState('project_summary');
  const [project, setProject] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [question, setQuestion] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const loadProfiles = async () => {
    try {
      const list = await getProfiles();
      setProfiles(list);
      if (list.length > 0 && !profileId) setProfileId(list[0].id);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    loadProfiles();
    getAllProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => { if (profiles.length && !profileId) setProfileId(profiles[0].id); }, [profiles]);

  const handleAnalyze = async () => {
    setLoading(true);
    setResult('');
    setError('');
    try {
      const res = await analyzeData(mode, profileId, project, dateFrom, dateTo, question, customPrompt);
      setResult(res.reply);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const activeProfile = profiles.find(p => p.id === profileId);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon color="primary" /> AI 智能分析
      </Typography>

      {/* Analysis Controls */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>选择模型</InputLabel>
              <Select value={profileId || ''} onChange={e => setProfileId(e.target.value)} label="选择模型">
                {profiles.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.name} <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>({p.model})</Typography></MenuItem>
                ))}
              </Select>
            </FormControl>
            {!profiles.length && (
              <Typography variant="caption" color="text.secondary">
                暂无模型，请先在「LLM 模型管理」中添加
              </Typography>
            )}
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>分析模式</Typography>
          <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)}
            size="small" sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
            {ANALYSIS_MODES.map(m => (
              <ToggleButton key={m.value} value={m.value} sx={{ textAlign: 'left', px: 2, py: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{m.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{m.desc}</Typography>
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <TextField label="提示词（自定义要求）" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
            size="small" fullWidth multiline minRows={2} maxRows={6}
            placeholder="例如：输出格式用表格、只关注P0问题、用中文回答、重点分析工时超标的项目..."
            sx={{ mb: 2 }} />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: mode === 'free_question' ? 2 : 0 }}>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>项目（可选）</InputLabel>
              <Select value={project} onChange={e => setProject(e.target.value)} label="项目（可选）">
                <MenuItem value="">全部项目</MenuItem>
                {projects.map(p => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="开始日期" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
            <TextField label="结束日期" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          </Box>

          {mode === 'free_question' && (
            <TextField label="你的问题" value={question} onChange={e => setQuestion(e.target.value)}
              size="small" fullWidth multiline rows={2} placeholder="例如：这些项目中哪个工时最高？"
              sx={{ mb: 2 }} />
          )}

          <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
            onClick={handleAnalyze} disabled={loading || !profiles.length}>
            {loading ? '分析中...' : '开始分析'}
          </Button>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result && (
        <Paper sx={{ p: 3, lineHeight: 1.8, '& h2': { mt: 3, mb: 1 }, '& h3': { mt: 2, mb: 0.5 }, '& ul, & ol': { pl: 3 }, '& li': { mb: 0.5 }, '& p': { mb: 1 }, '& code': { bgcolor: '#f5f5f5', px: 0.5, py: 0.2, borderRadius: 0.5, fontSize: '0.9em' }, '& pre': { bgcolor: '#f5f5f5', p: 2, borderRadius: 1, overflow: 'auto' }, '& table': { borderCollapse: 'collapse', width: '100%' }, '& th, & td': { border: '1px solid #ddd', px: 1.5, py: 1, textAlign: 'left' }, '& th': { bgcolor: '#f0f0f0' } }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
        </Paper>
      )}
    </Box>
  );
}
