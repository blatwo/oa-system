import { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  Button,
  Alert,
  Grid,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import HubIcon from '@mui/icons-material/Hub';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { apiPost } from '../db/database';

const DEFAULT_ETCD = 'http://10.0.0.1:2379,http://10.0.0.2:2379,http://10.0.0.3:2379';
const DEFAULT_PATRONI = '10.0.0.1:8008,10.0.0.2:8008,10.0.0.3:8008';

export default function PatroniEtcdDebug() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700' }}>
          Patroni / etcd 调试工具
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab icon={<HubIcon />} iconPosition="start" label="etcd Key 查询" />
            <Tab icon={<StorageIcon />} iconPosition="start" label="Patroni 集群状态" />
          </Tabs>
        </Box>

        {tab === 0 && <EtcdPanel />}
        {tab === 1 && <PatroniPanel />}
      </Paper>
    </Box>
  );
}

/* ==================== etcd Panel ==================== */

function EtcdPanel() {
  const [endpoints, setEndpoints] = useState(DEFAULT_ETCD);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [path, setPath] = useState('/service/batman');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleQuery = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await apiPost('/debug/etcd/list', {
        endpoints, username, password, path,
      });
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const totalKvs = result?.results?.reduce((s, r) => s + (r.kvs?.length || 0), 0) || 0;

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <TextField
            label="etcd Endpoints"
            value={endpoints}
            onChange={e => setEndpoints(e.target.value)}
            fullWidth size="small"
            placeholder="http://10.0.0.1:2379,http://10.0.0.2:2379"
            helperText="逗号分隔多个 endpoint（v3 API）"
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField
            label="用户名（可选）"
            value={username}
            onChange={e => setUsername(e.target.value)}
            fullWidth size="small"
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField
            label="密码（可选）"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            fullWidth size="small"
          />
        </Grid>
        <Grid item xs={12} md={10}>
          <TextField
            label="Key 路径"
            value={path}
            onChange={e => setPath(e.target.value)}
            fullWidth size="small"
            placeholder="/service/batman"
            helperText="Patroni 默认 scope 路径前缀为 /service/&lt;scope&gt;"
          />
        </Grid>
        <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            variant="contained"
            size="medium"
            fullWidth
            startIcon={<SearchIcon />}
            disabled={loading}
            onClick={handleQuery}
          >
            {loading ? '查询中…' : '查询'}
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result && (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <Chip label={`路径: ${result.path}`} size="small" color="primary" />
            <Chip label={`共 ${totalKvs} 个 key`} size="small" />
            {result.results.map((r, i) => (
              <Chip
                key={i}
                size="small"
                color={r.ok ? 'success' : 'error'}
                label={r.ok ? `${r.endpoint} (${r.count})` : `${r.endpoint} ✕`}
              />
            ))}
          </Box>

          {result.results.map((r, i) => (
            <Accordion key={i} defaultExpanded={r.ok} disableGutters sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 600 }}>
                  {r.endpoint} {r.ok ? `— ${r.count} keys` : `— 失败`}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {r.ok ? (
                  r.kvs.length === 0 ? (
                    <Typography color="text.secondary">该 endpoint 无返回 key</Typography>
                  ) : (
                    r.kvs.map((kv, j) => (
                      <Box key={j} sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main', flex: 1, wordBreak: 'break-all' }}>
                            {kv.key}
                          </Typography>
                          <Tooltip title="复制 key">
                            <IconButton size="small" onClick={() => navigator.clipboard?.writeText(kv.key)}>
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', bgcolor: 'grey.50', p: 1, borderRadius: 0.5, wordBreak: 'break-all' }}>
                          {kv.value}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          {kv.version != null && <Chip size="small" label={`ver ${kv.version}`} />}
                          {kv.mod_revision != null && <Chip size="small" label={`rev ${kv.mod_revision}`} />}
                        </Box>
                      </Box>
                    ))
                  )
                ) : (
                  <Alert severity="error">{r.error}</Alert>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}
    </Box>
  );
}

/* ==================== Patroni Panel ==================== */

function PatroniPanel() {
  const [endpoints, setEndpoints] = useState(DEFAULT_PATRONI);
  const [scope, setScope] = useState('batman');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleQuery = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await apiPost('/debug/patroni/cluster', {
        endpoints, scope,
      });
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const roleColor = {
    'master': 'success',
    'primary': 'success',
    'replica': 'info',
    'standby_leader': 'warning',
    'leader': 'warning',
  };
  const stateColor = {
    'running': 'success',
    'stopped': 'default',
    'start failed': 'error',
  };

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <TextField
            label="Patroni REST Endpoints (host:8008)"
            value={endpoints}
            onChange={e => setEndpoints(e.target.value)}
            fullWidth size="small"
            placeholder="10.0.0.1:8008,10.0.0.2:8008"
            helperText="逗号分隔，端口默认 8008"
          />
        </Grid>
        <Grid item xs={8} md={2}>
          <TextField
            label="Cluster Scope"
            value={scope}
            onChange={e => setScope(e.target.value)}
            fullWidth size="small"
          />
        </Grid>
        <Grid item xs={4} md={2} sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            variant="contained"
            size="medium"
            fullWidth
            startIcon={<SearchIcon />}
            disabled={loading}
            onClick={handleQuery}
          >
            {loading ? '查询中…' : '查询'}
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result?.results?.map((r, i) => (
        <Accordion key={i} defaultExpanded sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600 }}>
              {r.endpoint}
              {r.ok && ` — ${r.scope} (${r.members?.length || 0} members)`}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {r.ok ? (
              <>
                <Box sx={{ mb: 2 }}>
                  <Chip size="small" label={`Scope: ${r.scope}`} sx={{ mr: 1 }} />
                  {r.patroni_version && <Chip size="small" label={`Patroni ${r.patroni_version}`} color="primary" />}
                </Box>
                {r.members.map((m, j) => (
                  <Box key={j} sx={{ p: 1.5, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{m.name}</Typography>
                      {m.role && <Chip size="small" label={m.role} color={roleColor[m.role] || 'default'} />}
                      {m.state && <Chip size="small" label={m.state} color={stateColor[m.state] || 'default'} variant="outlined" />}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {m.host}:{m.port}
                      {m.lag != null && `  ·  lag: ${m.lag}MB`}
                      {m.timeline != null && `  ·  timeline: ${m.timeline}`}
                    </Typography>
                  </Box>
                ))}
              </>
            ) : (
              <Alert severity="error">{r.error}</Alert>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
