import { useState, useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Chip,
} from '@mui/material';
import { useWorkContext } from '../context/WorkContext';

/** BSC color map for visual distinction */
const BSC_COLORS = {
  '常规': 'default',
  '文章1': 'info',
  '文章2': 'info',
  '兼容证明': 'success',
  '培训': 'warning',
  'REVIEW': 'secondary',
};

/**
 * Project Statistics component.
 * Groups work records by project, sums hours, and shows percentage distribution.
 * Supports date range filtering.
 */
export default function ProjectStats() {
  const { state } = useWorkContext();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  /** Compute project stats from filtered records */
  const { projectStats, totalHours } = useMemo(() => {
    const filtered = state.records.filter((r) => {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });

    const projectMap = {};
    filtered.forEach((r) => {
      const project = r.project || '(未指定项目)';
      if (!projectMap[project]) {
        projectMap[project] = {
          project,
          hours: 0,
          count: 0,
          bscTypes: new Set(),
        };
      }
      projectMap[project].hours += Number(r.hours) || 0;
      projectMap[project].count += 1;
      if (r.bsc) projectMap[project].bscTypes.add(r.bsc);
    });

    const stats = Object.values(projectMap).sort((a, b) => b.hours - a.hours);
    const total = stats.reduce((sum, s) => sum + s.hours, 0);

    return { projectStats: stats, totalHours: total };
  }, [state.records, dateFrom, dateTo]);

  return (
    <Box>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700' }}>
          项目工时统计
        </Typography>

        {/* Date filter */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
          <TextField
            label="开始日期"
            type="date"
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="结束日期"
            type="date"
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
        </Box>

        {/* Summary Cards */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 3,
            flexWrap: 'wrap',
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              flex: 1,
              minWidth: 180,
              textAlign: 'center',
              backgroundColor: 'primary.50',
              borderColor: 'primary.200',
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.700' }}>
              {totalHours.toFixed(1)}
            </Typography>
            <Typography variant="body2" color="text.secondary">总工时 (小时)</Typography>
          </Paper>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              flex: 1,
              minWidth: 180,
              textAlign: 'center',
              backgroundColor: 'success.50',
              borderColor: 'success.200',
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.700' }}>
              {projectStats.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">项目数量</Typography>
          </Paper>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              flex: 1,
              minWidth: 180,
              textAlign: 'center',
              backgroundColor: 'warning.50',
              borderColor: 'warning.200',
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.700' }}>
              {projectStats.length > 0 ? (totalHours / projectStats.length).toFixed(1) : '0'}
            </Typography>
            <Typography variant="body2" color="text.secondary">平均工时/项目</Typography>
          </Paper>
        </Box>

        {/* Project Stats Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>项目名称</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">BSC</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">记录数</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">工时 (h)</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">占比</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>工时分布</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                projectStats.map((stat) => {
                  const percentage = totalHours > 0 ? (stat.hours / totalHours) * 100 : 0;
                  return (
                    <TableRow key={stat.project} hover>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 350 }}>
                          {stat.project}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {[...stat.bscTypes].map((bsc) => (
                            <Chip
                              key={bsc}
                              label={bsc}
                              size="small"
                              color={BSC_COLORS[bsc] || 'default'}
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="center">{stat.count}</TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={600}>
                          {stat.hours.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {percentage.toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={percentage}
                            sx={{
                              flexGrow: 1,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                backgroundColor:
                                  percentage > 30
                                    ? 'primary.600'
                                    : percentage > 15
                                      ? 'info.main'
                                      : 'success.main',
                              },
                            }}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
