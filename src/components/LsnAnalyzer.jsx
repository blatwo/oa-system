import { useState, useMemo } from 'react';
import {
  Paper, Typography, Box, TextField, Button, Grid, Divider, Chip,
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import StorageIcon from '@mui/icons-material/Storage';

const WAL_SEGMENT_SIZE = 16 * 1024 * 1024; // 16 MB = 0x1000000

/**
 * Parse LSN string like "FF/E2D1DF80" into high32 and low32.
 */
function parseLsn(lsn) {
  const parts = lsn.trim().split('/');
  if (parts.length !== 2) return null;
  const high = parseInt(parts[0], 16);
  const low = parseInt(parts[1], 16);
  if (isNaN(high) || isNaN(low)) return null;
  return { high, low };
}

function pad8(hex) {
  return hex.toUpperCase().padStart(8, '0');
}

function formatBytes(bytes) {
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(2)} TB`;
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

export default function LsnAnalyzer() {
  const [lsnStr, setLsnStr] = useState('FF/E2D1DF80');
  const [timeline, setTimeline] = useState('9');

  const result = useMemo(() => {
    const parsed = parseLsn(lsnStr);
    if (!parsed) return null;
    const { high, low } = parsed;
    const tl = parseInt(timeline, 10) || 1;

    // Full 64-bit value
    const full64 = BigInt(high) * 4294967296n + BigInt(low);
    const fullHex = '0x' + pad8(high.toString(16)) + pad8(low.toString(16));

    // Total bytes as BigInt for precise calculation
    const totalBytes = Number(full64); // safe up to ~9 PB

    // Segment calculation
    const segmentNum = Math.floor(low / WAL_SEGMENT_SIZE);
    const offsetInSegment = low % WAL_SEGMENT_SIZE;

    // WAL filename
    const walFile = pad8(tl.toString(16)) + pad8(high.toString(16)) + pad8(segmentNum.toString(16));

    // Segment group (high32 represents groups of 4GB)
    const groupNum = high;
    const groupBytes = groupNum * 4 * 1024 * 1024 * 1024;

    // Timeline
    const failovers = tl - 1;

    return {
      high, low, full64, fullHex, totalBytes,
      segmentNum, offsetInSegment,
      walFile, tl, failovers,
      groupNum, groupBytes,
    };
  }, [lsnStr, timeline]);

  const error = !parseLsn(lsnStr);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, color: 'primary.700', display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalculateIcon /> WAL LSN 分析工具
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        解析 PostgreSQL LSN 值，还原完整 64 位地址、物理 WAL 文件名、segment 偏移量等
      </Typography>

      {/* Input */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              label="LSN 值"
              value={lsnStr}
              onChange={e => setLsnStr(e.target.value)}
              size="small" fullWidth
              placeholder="例如 FF/E2D1DF80"
              helperText="格式：高32位/低32位（十六进制）"
              error={error}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="时间线 ID"
              value={timeline}
              onChange={e => setTimeline(e.target.value)}
              size="small" fullWidth
              type="number"
              placeholder="默认 1"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">
              WAL Segment 大小：16 MB（固定）
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', mb: 3 }}>
          <Typography color="text.secondary">请输入合法的 LSN 值，格式如 FF/E2D1DF80</Typography>
        </Paper>
      )}

      {result && (
        <>
          {/* Summary */}
          <Paper sx={{ p: 2.5, mb: 3, background: 'linear-gradient(135deg, #e3f2fd 0%, #e8eaf6 100%)' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              📊 解析摘要
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
              <Chip label={`累计 WAL 写入 ≈ ${formatBytes(result.totalBytes)}`} color="primary" />
              <Chip label={`时间线 ${result.tl}（${result.failovers} 次 failover）`} color="secondary" />
              <Chip label={`Segment 组 #${result.groupNum}`} variant="outlined" />
            </Box>
          </Paper>

          {/* Detail table */}
          <Paper variant="outlined" sx={{ mb: 3 }}>
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" fontWeight={600}>🔍 数值结构</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">高 32 位（hex）</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>0x{pad8(result.high.toString(16))}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">低 32 位（hex）</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>0x{pad8(result.low.toString(16))}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">完整 64 位</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{result.fullHex}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">十进制</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{result.full64.toLocaleString()}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Physical file */}
          <Paper variant="outlined" sx={{ mb: 3 }}>
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" fontWeight={600}><StorageIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} /> 物理文件映射</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">WAL 文件名</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={700} fontSize="1.1rem" color="primary.main">
                    {result.walFile}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    时间线
                    <Chip label={pad8(result.tl.toString(16))} size="small" sx={{ mx: 0.5, fontFamily: 'monospace' }} />
                    — 高32位分组
                    <Chip label={pad8(result.high.toString(16))} size="small" sx={{ mx: 0.5, fontFamily: 'monospace' }} />
                    — Segment编号
                    <Chip label={pad8(result.segmentNum.toString(16))} size="small" sx={{ mx: 0.5, fontFamily: 'monospace' }} />
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">Segment 号</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{result.segmentNum}（0x{result.segmentNum.toString(16).toUpperCase()}）</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">文件内偏移</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>0x{pad8(result.offsetInSegment.toString(16))}（{formatBytes(result.offsetInSegment)}）</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">文件大小</Typography>
                  <Typography variant="body2" fontFamily="monospace">16 MB (固定)</Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Timeline */}
          <Paper variant="outlined">
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" fontWeight={600}>⏱️ 时间线 & Segment 组</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">当前时间线</Typography>
                  <Typography variant="body2" fontWeight={600}>{result.tl}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">历经 failover</Typography>
                  <Typography variant="body2" fontWeight={600}>{result.failovers} 次</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">WAL 逻辑分组</Typography>
                  <Typography variant="body2" fontWeight={600}>第 {result.groupNum} 组（每组 4 GB）</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    累计写入 {result.groupNum} × 4 GB = {formatBytes(result.groupBytes)}，
                    与总 LSN 位置 {formatBytes(result.totalBytes)} 吻合
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
}
