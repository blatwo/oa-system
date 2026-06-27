import { useState, useEffect } from 'react';
import {
  Paper, Typography, Box, Button, TextField, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tooltip,
  Collapse, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RuleIcon from '@mui/icons-material/Rule';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { getCriteria, createCriteria, updateCriteria, deleteCriteria } from '../db/priority';
import { getQ2Goals, createQ2Goal, updateQ2Goal, deleteQ2Goal } from '../db/q2goals';

const EMPTY = { reference_no: 0, name: '', options: '', important: '', not_important: '', urgent: '', not_urgent: '', sort_order: 0 };
const GOAL_EMPTY = { title: '', description: '', weekly_schedule: '', active: 1, sort_order: 0 };

const QUADRANTS = [
  {
    key: 'Q1', title: '重要且紧急', subtitle: '客户故障 · 生产宕机 · 阻塞性 bug',
    color: '#fce4ec', borderColor: '#e57373', chipColor: 'error',
    examples: '客户生产环境宕机、数据丢失、迁移重大阻塞、项目交付 deadline、紧急安全漏洞',
    strategy: '被动救火，不得不立即响应 — 事后复盘，建立预案减少下次发生',
  },
  {
    key: 'Q2', title: '重要但不紧急', subtitle: '技能提升 · 知识沉淀 · 流程优化',
    color: '#e3f2fd', borderColor: '#42a5f5', chipColor: 'info',
    examples: '学习 PG 高可用/性能调优、写技术文档/BSC 文章、整理 IMA 知识库、搭建测试环境、开发 OA 工具、考取认证',
    strategy: '★ 高效能核心 — 把 80% 精力投入这里。固定时间做固定事，主动布局决定技术深度',
    star: true,
  },
  {
    key: 'Q3', title: '紧急但不重要', subtitle: '群消息打断 · 临时咨询 · 重复工单',
    color: '#fff3e0', borderColor: '#ff9800', chipColor: 'warning',
    examples: '群里的简单咨询（别人能答的）、被临时拉去帮看与己无关的环境、重复性安装部署工单',
    strategy: '看似在忙，实则没积累 — 批量处理或委托他人，保护你的深度工作时间',
  },
  {
    key: 'Q4', title: '不紧急不重要', subtitle: '摸鱼 · 刷手机 · 无目的浏览',
    color: '#f5f5f5', borderColor: '#bdbdbd', chipColor: 'default',
    examples: '刷短视频、无目的逛技术论坛、反复刷新群消息、发呆',
    strategy: '纯消耗，无价值 — 累了就正经休息，别用碎片娱乐填充',
  },
];

export default function PriorityCriteria() {
  // Original evaluation criteria
  const [items, setItems] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showCriteria, setShowCriteria] = useState(false);

  // Q2 goals
  const [goals, setGoals] = useState([]);
  const [goalDialog, setGoalDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState(GOAL_EMPTY);
  const [goalDeleteTarget, setGoalDeleteTarget] = useState(null);

  const load = async () => { try { setItems(await getCriteria()); } catch (e) { /* */ } };
  const loadGoals = async () => { try { setGoals(await getQ2Goals()); } catch (e) { /* */ } };
  useEffect(() => { load(); loadGoals(); }, []);

  // ---- Evaluation criteria handlers (original) ----
  const handleOpen = (item) => {
    setEditing(item || null);
    setForm(item ? { ...item } : { ...EMPTY, sort_order: items.length + 1 });
    setDialogOpen(true);
  };
  const handleSave = async () => {
    if (!form.name.trim()) { setMsg({ text: '名称不能为空', severity: 'warning' }); return; }
    try {
      if (editing) { await updateCriteria(editing.id, form); setMsg({ text: '已更新', severity: 'success' }); }
      else { await createCriteria(form); setMsg({ text: '已新增', severity: 'success' }); }
      setDialogOpen(false); await load();
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCriteria(deleteTarget.id); setMsg({ text: '已删除', severity: 'success' }); await load();
    setDeleteTarget(null);
  };
  const tag = (v, label, color) => v ? (
    <Tooltip title={v}><Chip icon={<CheckIcon />} label={label} size="small" color={color} variant="outlined" /></Tooltip>
  ) : null;

  // ---- Q2 goal handlers ----
  const handleGoalOpen = (goal) => {
    setEditingGoal(goal || null);
    setGoalForm(goal ? { ...goal } : { ...GOAL_EMPTY, sort_order: goals.length + 1 });
    setGoalDialog(true);
  };
  const handleGoalSave = async () => {
    if (!goalForm.title.trim()) { setMsg({ text: '目标不能为空', severity: 'warning' }); return; }
    try {
      if (editingGoal) { await updateQ2Goal(editingGoal.id, goalForm); setMsg({ text: '目标已更新', severity: 'success' }); }
      else { await createQ2Goal(goalForm); setMsg({ text: '目标已新增', severity: 'success' }); }
      setGoalDialog(false); await loadGoals();
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };
  const handleGoalDelete = async () => {
    if (!goalDeleteTarget) return;
    await deleteQ2Goal(goalDeleteTarget.id); setMsg({ text: '已删除', severity: 'success' }); await loadGoals();
    setGoalDeleteTarget(null);
  };

  const activeGoals = goals.filter(g => g.active);
  const inactiveGoals = goals.filter(g => !g.active);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RuleIcon color="primary" /> 四象限优先级管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">高效能人士的七个习惯 · 艾森豪威尔矩阵</Typography>
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* ====== Four-Quadrant Matrix ====== */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 1.5,
          mb: 3,
          '& > *:first-of-type': { borderTopLeftRadius: 12 },
          '& > *:nth-of-type(2)': { borderTopRightRadius: 12 },
          '& > *:nth-of-type(3)': { borderBottomLeftRadius: 12 },
          '& > *:nth-of-type(4)': { borderBottomRightRadius: 12 },
        }}
      >
        {QUADRANTS.map(q => (
          <Paper
            key={q.key}
            variant="outlined"
            sx={{
              p: 2.5,
              backgroundColor: q.color,
              borderColor: q.borderColor,
              borderWidth: q.star ? 2.5 : 1.5,
              position: 'relative',
              minHeight: 130,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip label={q.key} size="small" color={q.chipColor} sx={{ fontWeight: 700 }} />
              <Typography variant="subtitle1" fontWeight={700}>
                {q.title}
                {q.star && <StarIcon sx={{ fontSize: 18, ml: 0.5, color: '#1565c0', verticalAlign: 'middle' }} />}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {q.subtitle}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary' }}>
              📌 {q.examples}
            </Typography>
            <Typography variant="caption" sx={{ fontStyle: 'italic', color: q.star ? '#1565c0' : 'text.secondary', fontWeight: q.star ? 600 : 400 }}>
              {q.strategy}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Legend row: Urgency / Importance axis labels */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, position: 'relative' }}>
        <Typography variant="caption" color="text.secondary" align="center">
          「紧急」程度从左到右递减　|　「重要」程度从上到下递减
        </Typography>
      </Box>

      {/* ====== Q2 Goals Section ====== */}
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        ⭐ 我的 Q2 目标（重要但不紧急 · 半年到一年内最多 3 件）
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        高效能人士的核心习惯：固定时间做固定事，做四休三/五休二都行，关键是到点就做，别再重复决策，干就完了。
      </Typography>

      {/* Active goals */}
      {activeGoals.map((goal) => (
        <Paper key={goal.id} variant="outlined" sx={{ p: 2, mb: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <StarIcon sx={{ color: '#1565c0' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>{goal.title}</Typography>
            {goal.description && (
              <Typography variant="body2" color="text.secondary">{goal.description}</Typography>
            )}
          </Box>
          {goal.weekly_schedule && (
            <Chip label={goal.weekly_schedule} size="small" color="primary" variant="outlined" />
          )}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={() => handleGoalOpen(goal)}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => setGoalDeleteTarget(goal)}><DeleteIcon fontSize="small" /></IconButton>
          </Box>
        </Paper>
      ))}

      {/* New goal button */}
      <Box sx={{ mb: 3 }}>
        <Button size="small" startIcon={<AddIcon />} variant="outlined"
          onClick={() => handleGoalOpen(null)}
          disabled={activeGoals.length >= 3}>
          {activeGoals.length >= 3 ? '最多 3 个 Q2 目标' : '新增 Q2 目标'}
        </Button>
        {inactiveGoals.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
            已归档 {inactiveGoals.length} 个目标
          </Typography>
        )}
      </Box>

      {/* ====== Original Evaluation Criteria (collapsible) ====== */}
      <Button
        variant="text" size="small"
        onClick={() => setShowCriteria(!showCriteria)}
        sx={{ mb: 1, color: 'text.secondary' }}
        endIcon={showCriteria ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
      >
        任务优先级评估维度（共 {items.length} 条）
      </Button>

      <Collapse in={showCriteria}>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              项目/工单来临时，用这些维度判断「重要」还是「紧急」
            </Typography>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>新增准则</Button>
          </Box>

          {!items.length ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">暂无评估准则</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600, width: 50 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>评估维度</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>选项</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">重要</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">不重要</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">紧急</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">不紧急</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{item.reference_no || idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{item.name}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{item.options || '-'}</Typography></TableCell>
                      <TableCell align="center">{tag(item.important, '重要', 'error')}</TableCell>
                      <TableCell align="center">{tag(item.not_important, '不重要', 'default')}</TableCell>
                      <TableCell align="center">{tag(item.urgent, '紧急', 'warning')}</TableCell>
                      <TableCell align="center">{tag(item.not_urgent, '不紧急', 'default')}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleOpen(item)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => setDeleteTarget(item)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Collapse>

      {/* ---- Evaluation Criteria Dialog ---- */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '编辑准则' : '新增准则'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="序号" value={form.reference_no || ''} type="number" size="small" sx={{ width: 80 }}
                onChange={e => setForm({ ...form, reference_no: Number(e.target.value) })} />
              <TextField label="排序" value={form.sort_order || ''} type="number" size="small" sx={{ width: 80 }}
                onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </Box>
            <TextField label="评估维度名称" value={form.name} size="small" fullWidth required
              onChange={e => setForm({ ...form, name: e.target.value })} />
            <TextField label="选项" value={form.options} size="small" fullWidth multiline minRows={3}
              onChange={e => setForm({ ...form, options: e.target.value })} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="重要标记" value={form.important} size="small" fullWidth
                onChange={e => setForm({ ...form, important: e.target.value })} />
              <TextField label="紧急标记" value={form.urgent} size="small" fullWidth
                onChange={e => setForm({ ...form, urgent: e.target.value })} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="不重要标记" value={form.not_important} size="small" fullWidth
                onChange={e => setForm({ ...form, not_important: e.target.value })} />
              <TextField label="不紧急标记" value={form.not_urgent} size="small" fullWidth
                onChange={e => setForm({ ...form, not_urgent: e.target.value })} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* ---- Criteria Delete Dialog ---- */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除「<strong>{deleteTarget?.name || ''}</strong>」吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>

      {/* ---- Q2 Goal Dialog ---- */}
      <Dialog open={goalDialog} onClose={() => setGoalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGoal ? '编辑 Q2 目标' : '新增 Q2 目标'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="目标" value={goalForm.title} size="small" fullWidth required autoFocus
              onChange={e => setGoalForm({ ...goalForm, title: e.target.value })}
              placeholder="如：考取 PostgreSQL 认证" />
            <TextField label="具体描述" value={goalForm.description} size="small" fullWidth multiline minRows={2}
              onChange={e => setGoalForm({ ...goalForm, description: e.target.value })}
              placeholder="细化目标，让它更具体可执行" />
            <TextField label="执行节奏" value={goalForm.weekly_schedule} size="small" fullWidth
              onChange={e => setGoalForm({ ...goalForm, weekly_schedule: e.target.value })}
              placeholder="如：做四休三 / 每周三晚上 / 每天早上 30 分钟" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoalDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleGoalSave} disabled={!goalForm.title.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* ---- Q2 Goal Delete Dialog ---- */}
      <Dialog open={!!goalDeleteTarget} onClose={() => setGoalDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除目标「<strong>{goalDeleteTarget?.title || ''}</strong>」吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoalDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleGoalDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
