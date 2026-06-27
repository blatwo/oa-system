import { useState, useEffect } from 'react';
import {
  Paper, Typography, Box, Card, CardContent, Chip,
  LinearProgress, Alert, Grid,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { getBacklog } from '../db/backlog';

const COLORS = {
  error: '#d32f2f',
  warning: '#ed6c02',
  success: '#2e7d32',
};

export default function BacklogTracker() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBacklog().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><LinearProgress /></Box>;

  const severe = data.filter(d => d.level === '严重积压');
  const warning = data.filter(d => d.level === '有积压');
  const normal = data.filter(d => d.level === '正常');

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700', display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon /> 工作积压状态
      </Typography>

      {/* Summary */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper elevation={2} sx={{ p: 2, flex: 1, minWidth: 140, textAlign: 'center', borderLeft: `4px solid ${COLORS.error}` }}>
          <Typography variant="h4" fontWeight={700} color={COLORS.error}>{severe.length}</Typography>
          <Typography variant="body2" color="text.secondary">严重积压</Typography>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, flex: 1, minWidth: 140, textAlign: 'center', borderLeft: `4px solid ${COLORS.warning}` }}>
          <Typography variant="h4" fontWeight={700} color={COLORS.warning}>{warning.length}</Typography>
          <Typography variant="body2" color="text.secondary">有积压</Typography>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, flex: 1, minWidth: 140, textAlign: 'center', borderLeft: `4px solid ${COLORS.success}` }}>
          <Typography variant="h4" fontWeight={700} color={COLORS.success}>{normal.length}</Typography>
          <Typography variant="body2" color="text.secondary">正常</Typography>
        </Paper>
      </Box>

      {!data.length && (
        <Alert severity="info">暂无工作记录数据，录入工作后将自动计算积压状态。</Alert>
      )}

      {/* Project cards */}
      <Grid container spacing={2}>
        {data.map(d => (
          <Grid item xs={12} sm={6} key={d.project}>
            <Card variant="outlined" sx={{ borderLeft: `4px solid ${COLORS[d.color]}` }}>
              <CardContent sx={{ pb: '12px !important' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ maxWidth: '70%' }}>
                    {d.project.length > 30 ? d.project.slice(0, 30) + '...' : d.project}
                  </Typography>
                  <Chip
                    icon={d.level === '严重积压' ? <ErrorIcon /> : d.level === '有积压' ? <WarningAmberIcon /> : <CheckCircleIcon />}
                    label={d.level}
                    size="small"
                    color={d.color}
                    variant="filled"
                  />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">进行中</Typography>
                    <Typography variant="body2" fontWeight={600} color={d.in_progress > 0 ? COLORS.warning : 'text.primary'}>{d.in_progress}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">未完成待办</Typography>
                    <Typography variant="body2" fontWeight={600}>{d.open_todos}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">近两周工时</Typography>
                    <Typography variant="body2" fontWeight={600}>{d.recent_hours}h</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">最后活跃</Typography>
                    <Typography variant="body2" fontWeight={600}>{d.last_date || '-'}</Typography>
                  </Box>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(d.score * 12.5, 100)}
                  color={d.color}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
