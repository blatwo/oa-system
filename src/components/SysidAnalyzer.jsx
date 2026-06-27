import { useState, useMemo } from 'react';
import {
  Paper, Typography, Box, TextField, Button, Grid, Divider, Chip, Alert, Link,
} from '@mui/material';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DnsIcon from '@mui/icons-material/Dns';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

/**
 * Decode a PostgreSQL Database System Identifier (uint64) into its components:
 *   bits 63-32: Unix timestamp (seconds) of initdb
 *   bits 31-12: Microseconds portion
 *   bits 11-0:  PID of initdb process (low 12 bits)
 */
function decodeSysid(sysidNum) {
  if (sysidNum < 0n || sysidNum > 0xFFFFFFFFFFFFFFFFn) return null;

  const tsSec = Number(sysidNum >> 32n);
  const tsUsec = Number((sysidNum >> 12n) & 0xFFFFFn);
  const pidLow = Number(sysidNum & 0xFFFn);

  const high32 = Number((sysidNum >> 32n) & 0xFFFFFFFFn);
  const mid20 = Number((sysidNum >> 12n) & 0xFFFFFn);
  const low12 = Number(sysidNum & 0xFFFn);

  const hex64 = '0x' + sysidNum.toString(16).toUpperCase().padStart(16, '0');

  // UTC timestamp to human-readable
  let utcDate = null;
  if (tsSec > 0) {
    utcDate = new Date(tsSec * 1000);
  }

  return {
    sysidNum, tsSec, tsUsec, pidLow,
    high32, mid20, low12, hex64, utcDate,
  };
}

function formatHex(n, width) {
  return '0x' + n.toString(16).toUpperCase().padStart(width, '0');
}

function formatUTC(date) {
  if (!date || isNaN(date.getTime())) return '—';
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z/, ' UTC');
}

export default function SysidAnalyzer() {
  const [sysidStr, setSysidStr] = useState('7234856912340148227');
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    const trimmed = sysidStr.trim();
    if (!trimmed) return { error: '请输入系统标识符' };
    if (!/^\d+$/.test(trimmed)) return { error: '请输入合法的正整数' };
    try {
      const n = BigInt(trimmed);
      if (n > 0xFFFFFFFFFFFFFFFFn) return { error: '超出 uint64 范围（0 ~ 18446744073709551615）' };
      return { data: decodeSysid(n) };
    } catch {
      return { error: '无法解析该数值' };
    }
  }, [sysidStr]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const result = parsed.data;

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      {/* Header */}
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, color: 'primary.700', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FingerprintIcon /> Database System Identifier 分析工具
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        解析 PostgreSQL 在 <code style={{ backgroundColor: '#e8eaf6', padding: '1px 6px', borderRadius: 4, fontSize: '0.82rem' }}>initdb</code> 时生成的 64 位系统标识符，
        还原 initdb 执行时间、初始化 PID 等信息
      </Typography>

      {/* Input */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={7}>
            <TextField
              label="Database System Identifier"
              value={sysidStr}
              onChange={e => setSysidStr(e.target.value)}
              size="small" fullWidth
              placeholder="例如 7234856912340148227"
              helperText={
                <span>
                  获取方式：<code>pg_controldata $PGDATA | grep "system identifier"</code>
                  {' '}或{' '}<code>SELECT system_identifier FROM pg_control_system();</code>
                </span>
              }
              error={!!parsed.error}
              InputProps={{
                endAdornment: (
                  <Button
                    size="small"
                    onClick={() => handleCopy(sysidStr)}
                    sx={{ minWidth: 36, px: 1 }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </Button>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              取值范围：0 ~ 18,446,744,073,709,551,615 (uint64)
            </Typography>
            <Button
              size="small" variant="outlined"
              onClick={() => setSysidStr('7234856912340148227')}
              sx={{ mt: 0.5 }}
            >
              加载示例
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error */}
      {parsed.error && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', mb: 3 }}>
          <Typography color="text.secondary">{parsed.error}</Typography>
        </Paper>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Card */}
          <Paper sx={{ p: 2.5, mb: 3, background: 'linear-gradient(135deg, #e8eaf6 0%, #e3f2fd 100%)' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              解码摘要
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
              <Chip
                icon={<AccessTimeIcon />}
                label={`initdb 时间: ${formatUTC(result.utcDate)}`}
                color="primary"
              />
              <Chip
                label={`PID（低 12 位）: ${result.pidLow} (0x${result.pidLow.toString(16).toUpperCase()})`}
                color="secondary"
              />
              <Chip
                label={`微秒部分: ${result.tsUsec.toLocaleString()}`}
                variant="outlined"
              />
            </Box>
          </Paper>

          {/* Bit Layout Diagram */}
          <Paper variant="outlined" sx={{ mb: 3 }}>
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                64 位结构分解
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              {/* Visual bit layout */}
              <Box
                sx={{
                  display: 'flex', borderRadius: 2, overflow: 'hidden', mb: 2,
                  border: '2px solid #e0e0e0', fontFamily: 'monospace', fontSize: '0.8rem',
                }}
              >
                <Box sx={{ flex: '32', backgroundColor: '#bbdefb', p: 1.5, textAlign: 'center', borderRight: '2px solid #fff' }}>
                  <Typography variant="caption" fontWeight={700} display="block">高 32 位</Typography>
                  <Typography variant="caption" display="block">Unix 时间戳（秒）</Typography>
                  <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                    {formatHex(result.high32, 8)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    = {result.tsSec.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ flex: '20', backgroundColor: '#c8e6c9', p: 1.5, textAlign: 'center', borderRight: '2px solid #fff' }}>
                  <Typography variant="caption" fontWeight={700} display="block">中 20 位</Typography>
                  <Typography variant="caption" display="block">微秒</Typography>
                  <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                    {formatHex(result.mid20, 5)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    = {result.tsUsec.toLocaleString()} us
                  </Typography>
                </Box>
                <Box sx={{ flex: '12', backgroundColor: '#fff3e0', p: 1.5, textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight={700} display="block">低 12 位</Typography>
                  <Typography variant="caption" display="block">PID</Typography>
                  <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                    {formatHex(result.low12, 3)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    = {result.pidLow}
                  </Typography>
                </Box>
              </Box>

              {/* Detail grid */}
              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">完整 64 位（hex）</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                      {result.hex64}
                    </Typography>
                    <ContentCopyIcon
                      sx={{ fontSize: 14, cursor: 'pointer', color: 'action.active' }}
                      onClick={() => handleCopy(result.hex64)}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">十进制</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                    {result.sysidNum.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">时间戳（秒）</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                    {result.tsSec.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">PID（仅低 12 位）</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                    {result.pidLow} (0x{result.pidLow.toString(16).toUpperCase().padStart(3, '0')})
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Decoding Formulas */}
          <Paper variant="outlined" sx={{ mb: 3 }}>
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" fontWeight={600}>解码公式</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fafafa' }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px', borderBottom: '2px solid #e0e0e0' }}>字段</th>
                    <th style={{ textAlign: 'left', padding: '6px 12px', borderBottom: '2px solid #e0e0e0' }}>位域</th>
                    <th style={{ textAlign: 'left', padding: '6px 12px', borderBottom: '2px solid #e0e0e0' }}>公式</th>
                    <th style={{ textAlign: 'left', padding: '6px 12px', borderBottom: '2px solid #e0e0e0' }}>结果</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0' }}>
                      <strong>initdb 时间戳（秒）</strong>
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      bits 63-32
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      sysid &gt;&gt; 32
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      {result.tsSec.toLocaleString()} → {formatUTC(result.utcDate)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0' }}>
                      <strong>微秒部分</strong>
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      bits 31-12
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      (sysid &gt;&gt; 12) &amp; 0xFFFFF
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      {result.tsUsec.toLocaleString()} us
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0' }}>
                      <strong>PID 低 12 位</strong>
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      bits 11-0
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      sysid &amp; 0xFFF
                    </td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace' }}>
                      {result.pidLow}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Box>
          </Paper>

          {/* Practical Use Cases */}
          <Paper variant="outlined" sx={{ mb: 3 }}>
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DnsIcon fontSize="small" /> 实际用途
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      1. Patroni / 流复制集群身份验证
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Patroni 用 system identifier 验证节点是否属于同一集群。主备切换后对比每个节点的 sysid，
                      若不一致则视为集群污染（误 initdb 或误接入他集群），拒绝该节点加入。
                    </Typography>
                    <Typography variant="caption" fontFamily="monospace" color="primary.main" sx={{ display: 'block', mt: 1 }}>
                      etcdctl get /service/&lt;cluster&gt;/initialize
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      2. pg_upgrade 后更新 DCS
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      pg_upgrade 会重新执行 initdb，产生新的 system identifier。Patroni 的
                      /initialize 键存储的是旧值，必须删除该键或 patronictl remove，否则集群无法正常启动。
                    </Typography>
                    <Typography variant="caption" fontFamily="monospace" color="primary.main" sx={{ display: 'block', mt: 1 }}>
                      etcdctl del /service/&lt;cluster&gt;/initialize
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      3. 时间推断（运维 / 取证）
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      当数据目录的 pg_controlfile 或文件系统时间戳被破坏时，可从 system identifier
                      的高 32 位逆推 initdb 执行时间，用于确认实例创建时间或判断备份产物归属。
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      4. 主备配对验证
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      流复制要求从库的 system_identifier 与主库完全一致（从库继承主库 pg_control）。
                      sysid 不同则流复制握手阶段被拒绝。
                    </Typography>
                    <Typography variant="caption" fontFamily="monospace" color="primary.main" sx={{ display: 'block', mt: 1 }}>
                      pg_controldata $PGDATA | grep "system identifier"
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Warning */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} color="warning.main" gutterBottom>
              ⚠️ 注意事项
            </Typography>
            <Typography variant="body2" color="text.secondary">
              PID 部分仅取低 12 位（范围 0–4095），<strong>无法还原完整 PID</strong>。
              如果 initdb 进程的 PID 大于 4095，低位信息会重叠，逆推出的 PID 只有参考价值，不能作为精确依据。
            </Typography>
          </Paper>
        </>
      )}
    </Box>
  );
}
