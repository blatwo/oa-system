import { useState, useMemo, useEffect } from 'react';
import {
  Paper, Typography, Box, List, ListItem, ListItemIcon, ListItemText,
  ListItemSecondaryAction, IconButton, Checkbox, Chip, Divider,
  Tooltip, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useWorkContext } from '../context/WorkContext';
import { getAllProjects } from '../db/projects';

export default function TodoList() {
  const { state, updateRecord, deleteRecord } = useWorkContext();
  const [projectFilter, setProjectFilter] = useState('');
  const [projects, setProjects] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    getAllProjects().then(p => setProjects(p.map(x => x.name))).catch(() => {});
  }, []);

  const todoRecords = useMemo(() => {
    return state.records
      .filter((r) => {
        if (!r.todo || r.todo.trim() === '') return false;
        if (projectFilter && r.project !== projectFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [state.records, projectFilter]);

  // Per-project backlog indicators
  const projectMetrics = useMemo(() => {
    const map = {};
    for (const r of todoRecords) {
      if (!r.project) continue;
      if (!map[r.project]) map[r.project] = { open: 0, inProgress: 0 };
      if (!r.todoDone) map[r.project].open++;
      if (r.status === '进行中') map[r.project].inProgress++;
    }
    return map;
  }, [todoRecords]);

  const handleMarkDone = (record) => {
    updateRecord({ ...record, todoDone: true });
  };

  const handleMarkUndone = (record) => {
    updateRecord({ ...record, todoDone: false });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRecord(deleteTarget.id);
    setDeleteTarget(null);
  };

  const activeTodos = todoRecords.filter((r) => !r.todoDone);
  const doneTodos = todoRecords.filter((r) => r.todoDone);

  const renderTodoItem = (record, isDone) => {
    const pm = projectMetrics[record.project];
    const backlog = pm && pm.open >= 5;
    return (
      <ListItem
        key={record.id}
        sx={{
          py: 1.5, opacity: isDone ? 0.6 : 1,
          backgroundColor: isDone ? 'grey.50' : 'inherit',
          borderRadius: 1, mb: 0.5,
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Checkbox
            checked={isDone}
            onChange={() => (isDone ? handleMarkUndone(record) : handleMarkDone(record))}
            color={isDone ? 'default' : 'success'}
          />
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="body1" sx={{
              fontWeight: isDone ? 400 : 500,
              textDecoration: isDone ? 'line-through' : 'none',
            }}>
              {record.todo}
            </Typography>
          }
          secondary={
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, alignItems: 'center' }}>
              <Chip label={record.project?.slice(0, 25) || '未知项目'} size="small" color="primary" variant="outlined" />
              <Typography variant="caption" color="text.secondary">{record.date}</Typography>
              {record.importance === '重要' && (
                <Chip label="重要" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
              )}
              {record.urgency === '紧急' && (
                <Chip label="紧急" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
              )}
              {backlog && !isDone && (
                <Chip icon={<DeleteIcon sx={{ fontSize: 14 }} />} label="积压" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
              )}
            </Box>
          }
        />
        <ListItemSecondaryAction>
          <Tooltip title="删除">
            <IconButton edge="end" size="small" onClick={() => setDeleteTarget(record)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <Box>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700' }}>
          待办事项
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>项目筛选</InputLabel>
            <Select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} label="项目筛选">
              <MenuItem value="">全部项目</MenuItem>
              {projects.map(p => (
                <MenuItem key={p} value={p}>
                  {p} {projectMetrics[p] && `(${projectMetrics[p].open})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            共 {todoRecords.length} 条，未完成 {activeTodos.length}，已完成 {doneTodos.length}
          </Typography>
        </Box>

        {activeTodos.length === 0 && doneTodos.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">暂无待办事项</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              在录入工作时填写"待办事项"字段即可在此查看
            </Typography>
          </Box>
        ) : (
          <>
            {activeTodos.length > 0 && (
              <>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: 'warning.dark' }}>
                  未完成 ({activeTodos.length})
                </Typography>
                <List dense disablePadding>
                  {activeTodos.map((record) => renderTodoItem(record, false))}
                </List>
              </>
            )}
            {doneTodos.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: 'success.dark' }}>
                  已完成 ({doneTodos.length})
                </Typography>
                <List dense disablePadding>
                  {doneTodos.map((record) => renderTodoItem(record, true))}
                </List>
              </>
            )}
          </>
        )}
      </Paper>
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除「<strong>{deleteTarget?.todo || deleteTarget?.id || ''}</strong>」吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}