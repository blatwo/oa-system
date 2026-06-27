import { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, TextField, Button, Box, Card, CardContent, CardActions,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControl, InputLabel, Select, MenuItem, Grid, Accordion, AccordionSummary,
  AccordionDetails, Tabs, Tab, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, LinearProgress, Divider, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DnsIcon from '@mui/icons-material/Dns';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import CpuIcon from '@mui/icons-material/DeveloperBoard';
import CloudIcon from '@mui/icons-material/Cloud';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import { getServers, createServer, updateServer, deleteServer, createDisk, updateDisk, deleteDisk } from '../db/servers';
import { getAllProjects } from '../db/projects';

const DEPLOY_ARCHS = ['单机', '流复制', '高可用', '高可用+读写分离', 'DCS'];
const DISK_TYPES = ['SSD', 'HDD', 'NVMe'];

export default function ServerManager() {
  const [servers, setServers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filterProject, setFilterProject] = useState('');
  const [search, setSearch] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const loadServers = async () => {
    try { setServers(await getServers(filterProject)); } catch (e) { /* */ }
  };

  useEffect(() => { getAllProjects().then(p => setProjects(p)).catch(() => {}); }, []);
  useEffect(() => { loadServers(); }, [filterProject]);

  const filtered = useMemo(() => {
    if (!search.trim()) return servers;
    const q = search.toLowerCase();
    return servers.filter(s =>
      s.project_name?.toLowerCase().includes(q) ||
      s.resource_id?.toLowerCase().includes(q) ||
      s.node_name?.toLowerCase().includes(q) ||
      s.hostname?.toLowerCase().includes(q) ||
      s.ip?.toLowerCase().includes(q) ||
      s.purpose?.toLowerCase().includes(q)
    );
  }, [servers, search]);

  // --- Smart Analysis ---
  const analysis = useMemo(() => {
    const items = filtered;
    const total = items.length;
    if (total === 0) return null;

    // Count by OS
    const osCount = {};
    items.forEach(s => { const k = s.os_version?.split('\n')[0] || '未知'; osCount[k] = (osCount[k] || 0) + 1; });

    // Count by deploy arch
    const archCount = {};
    items.forEach(s => { const k = s.deploy_arch || '未知'; archCount[k] = (archCount[k] || 0) + 1; });

    // Count by CPU arch
    const cpuArchCount = {};
    items.forEach(s => { const k = s.cpu_arch || '未知'; cpuArchCount[k] = (cpuArchCount[k] || 0) + 1; });

    // Small memory risk (< 8GB)
    const smallMem = items.filter(s => {
      const m = parseInt(s.memory_total);
      return m && m < 8;
    });

    // No HA risk (single machine, no stream/HA)
    const noHA = items.filter(s => {
      const arch = (s.deploy_arch || '').toLowerCase();
      return arch === '单机' || arch === 'single' || (!arch.includes('流') && !arch.includes('高可用') && !arch.includes('dcs'));
    });

    // License expiring within 3 months
    const expiring = items.filter(s => {
      if (!s.license_expiry || s.license_expiry === '-') return false;
      try {
        const d = new Date(s.license_expiry);
        const now = new Date();
        const m3 = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
        return d <= m3 && d >= now;
      } catch { return false; }
    });

    // Perf comparison: find top 3 by disk performance
    const withPerf = items.filter(s => s.disks?.some(d => d.disk_write_3k));
    const perfSorted = [...withPerf].sort((a, b) => {
      const ap = a.disks?.find(d => d.disk_write_3k);
      const bp = b.disks?.find(d => d.disk_write_3k);
      const av = parseFloat(ap?.disk_write_3k) || 0;
      const bv = parseFloat(bp?.disk_write_3k) || 0;
      return bv - av;
    });

    return { total, osCount, archCount, cpuArchCount, smallMem, noHA, expiring, perfSorted };
  }, [filtered]);

  // --- Form handling ---
  const EMPTY_SERVER = {
    project_name: '', resource_id: '', node_name: '', eu: '', isv: '', purpose: '',
    deploy_arch: '', master_slave: '', install_date: '', dbid: '',
    server_vendor: '', vm_vendor: '', cloud_vendor: '',
    nic_name: '', ip: '', mac: '', nic_uuid: '', fip: '', vip: '', eip: '',
    cpu_vendor: '', cpu_model: '', cpu_arch: '', logical_cpus: '', threads_per_core: '',
    physical_cores: '', sockets: '', numa_nodes: '', max_freq: '', min_freq: '',
    l1d: '', l1i: '', l2: '', l3: '', byte_order: '', virtualization: '', hypervisor_vendor: '', virtualization_type: '',
    memory_total: '', memory_avail: '', swap: '',
    os_version: '', os_id: '', hostname: '', os_user: '', os_password: '', locale: '',
    db_version: '', license_expiry: '', extensions: '',
    ha_type: '', ha_scope: '', ha_last_tl: '', read_write_split: '', ha_port: '',
    backup_time: '', backup_retention: '', backup_script: '',
    max_connections: '', shared_buffer: '', effective_cache_size: '', maintenance_work_mem: '',
    checkpoint_completion_target: '', wal_buffers: '', default_statistics_target: '',
    random_page_cost: '', effective_io_concurrency: '', work_mem: '', huge_pages: '',
    min_wal_size: '', max_wal_size: '', max_worker_processes: '', max_parallel_workers_per_gather: '',
    max_parallel_workers: '', max_parallel_maintenance_workers: '', install_package: '',
  };
  const EMPTY_DISK = {
    disk_purpose: '', device: '', disk_type: '', lvm: '', logical_volume: '',
    filesystem: '', size: '', mount_point: '', disk_uuid: '', data_dir: '',
    disk_write_3k: '', random_read_3k: '', large_write_8m: '', seq_read: '', seq_write: '',
    pgbench_latency: '', pgbench_with_conn: '', pgbench_without_conn: '',
    pgbench200_latency: '', pgbench200_with_conn: '', pgbench200_without_conn: '',
  };

  const handleOpen = (server) => {
    if (server) {
      setEditing(server);
      const disks = server.disks || [];
      setForm({ ...server, _disks: disks.length > 0 ? [...disks] : [{ ...EMPTY_DISK }] });
    } else {
      setEditing(null);
      setForm({ ...EMPTY_SERVER, _disks: [{ ...EMPTY_DISK }] });
    }
    setDialogOpen(true);
  };

  const updateDiskInForm = (idx, field, value) => {
    const disks = [...(form._disks || [])];
    disks[idx] = { ...disks[idx], [field]: value };
    setForm({ ...form, _disks: disks });
  };

  const addDiskRow = () => {
    setForm({ ...form, _disks: [...(form._disks || []), { ...EMPTY_DISK }] });
  };

  const removeDiskRow = (idx) => {
    const disks = form._disks.filter((_, i) => i !== idx);
    setForm({ ...form, _disks: disks });
  };

  const handleSave = async () => {
    try {
      const { _disks, ...serverData } = form;
      let serverId;
      if (editing) {
        await updateServer(editing.id, serverData);
        serverId = editing.id;
        // Delete old disks and recreate
        for (const d of (editing.disks || [])) {
          await deleteDisk(d.id).catch(() => {});
        }
      } else {
        const result = await createServer(serverData);
        serverId = result.id;
      }
      // Create disks
      for (const d of (_disks || [])) {
        if (d.device || d.size || d.mount_point) {
          await createDisk({ ...d, server_id: serverId });
        }
      }
      setDialogOpen(false);
      setMsg({ text: editing ? '服务器已更新' : '服务器已创建', severity: 'success' });
      await loadServers();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  const handleDelete = async (server) => {
    try {
      await deleteServer(server.id);
      setMsg({ text: '已删除', severity: 'success' });
      await loadServers();
    } catch (e) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  // --- Render helpers ---
  const riskChip = (cond, label) => cond
    ? <Chip icon={<WarningAmberIcon />} label={label} size="small" color="warning" variant="outlined" />
    : <Chip icon={<CheckCircleIcon />} label={label} size="small" color="success" variant="outlined" />;

  const fmtPerf = (v) => v ? v : '-';

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DnsIcon color="primary" /> 服务器管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>按项目筛选</InputLabel>
            <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} label="按项目筛选">
              <MenuItem value="">全部项目 ({servers.length})</MenuItem>
              {projects.map(p => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" placeholder="搜索服务器/节点/IP..." value={search}
            onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>
            录入服务器
          </Button>
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* Tabs */}
      <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`服务器列表 (${filtered.length})`} />
        <Tab icon={<AnalyticsIcon />} iconPosition="start" label="智能分析" />
      </Tabs>

      {/* Tab 0: Server List */}
      {tabIndex === 0 && (
        <>
          {!filtered.length && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {filterProject ? '该项目暂无服务器' : '暂无服务器数据，点击"录入服务器"开始'}
              </Typography>
            </Paper>
          )}

          {filtered.map(server => {
            const isExpanded = expandedId === server.id;
            const disks = server.disks || [];
            const dataDisk = disks.find(d => d.disk_purpose?.includes('数据') || d.device?.includes('vdb'));
            const sysDisk = disks.find(d => d.disk_purpose?.includes('系统') || d.device?.includes('vda'));
            const hasPerf = dataDisk?.disk_write_3k;
            const isSmallMem = parseInt(server.memory_total) > 0 && parseInt(server.memory_total) < 8;
            const isSingleArch = !(server.deploy_arch || '').includes('流') && !(server.deploy_arch || '').includes('高可用') && !(server.deploy_arch || '').includes('DCS');

            return (
              <Card key={server.id} variant="outlined" sx={{ mb: 1.5, borderLeft: 4, borderLeftColor: isSingleArch ? 'warning.main' : 'primary.main' }}>
                <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
                  {/* Top row: project + node + status chips */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Chip label={server.project_name?.substring(0, 40)} color="primary" size="small" sx={{ fontWeight: 600, maxWidth: 400 }} />
                    {server.resource_id && (
                      <Chip label={server.resource_id} variant="outlined" size="small" />
                    )}
                    {server.deploy_arch && (
                      <Chip label={server.deploy_arch} size="small" color={isSingleArch ? 'warning' : 'info'} variant="outlined" />
                    )}
                    {server.master_slave && (
                      <Chip label={server.master_slave} size="small" variant="outlined"
                        sx={{ color: server.master_slave.includes('主') ? 'success.main' : 'text.secondary' }} />
                    )}
                  </Box>

                  {/* Key specs row */}
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                    {server.cpu_model && (
                      <Tooltip title={`${server.logical_cpus || '?'}核 ${server.cpu_arch || ''}`}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CpuIcon fontSize="small" color="action" />
                          <Typography variant="caption">{server.cpu_model} {server.logical_cpus && `${server.logical_cpus}C`}</Typography>
                        </Box>
                      </Tooltip>
                    )}
                    {server.memory_total && (
                      <Tooltip title={`可用: ${server.memory_avail || '-'} | Swap: ${server.swap || '-'}`}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <MemoryIcon fontSize="small" color={isSmallMem ? 'warning' : 'action'} />
                          <Typography variant="caption" color={isSmallMem ? 'warning.main' : 'text.secondary'}>
                            {server.memory_total}GB
                          </Typography>
                        </Box>
                      </Tooltip>
                    )}
                    {dataDisk && (
                      <Tooltip title={`${dataDisk.disk_type || ''} ${dataDisk.filesystem || ''}`}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <StorageIcon fontSize="small" color="action" />
                          <Typography variant="caption">{dataDisk.size} {dataDisk.mount_point}</Typography>
                        </Box>
                      </Tooltip>
                    )}
                    {server.os_version && (
                      <Tooltip title={server.os_version}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CloudIcon fontSize="small" color="action" />
                          <Typography variant="caption" noWrap sx={{ maxWidth: 150 }}>{server.os_version?.split('\n')[0]}</Typography>
                        </Box>
                      </Tooltip>
                    )}
                    {server.ip && (
                      <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace' }}>{server.ip?.split('/')[0]}</Typography>
                    )}
                  </Box>

                  {/* Perf summary */}
                  {hasPerf && (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
                      <Tooltip title="3KB 落盘写">
                        <Chip icon={<SpeedIcon />} label={`写 ${fmtPerf(dataDisk.disk_write_3k)}`} size="small" variant="outlined" />
                      </Tooltip>
                      <Tooltip title="3KB 随机读">
                        <Chip label={`读 ${fmtPerf(dataDisk.random_read_3k)}`} size="small" variant="outlined" />
                      </Tooltip>
                      {dataDisk.pgbench_latency && (
                        <Tooltip title="pgbench 延迟">
                          <Chip label={`pgbench ${dataDisk.pgbench_latency}ms`} size="small" variant="outlined" color="info" />
                        </Tooltip>
                      )}
                      {dataDisk.pgbench200_latency && (
                        <Tooltip title="200并发 120s">
                          <Chip label={`200c ${dataDisk.pgbench200_latency}ms`} size="small" variant="outlined" color="info" />
                        </Tooltip>
                      )}
                    </Box>
                  )}
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', pt: 0, px: 2, pb: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {riskChip(!isSmallMem, '内存充足')}
                    {isSmallMem && riskChip(true, '内存偏小')}
                    {server.deploy_arch && !isSingleArch && riskChip(true, '高可用')}
                    {server.backup_script && server.backup_script !== '-' && riskChip(true, '有备份')}
                    {server.db_version && server.db_version !== '-' && riskChip(true, server.db_version)}
                  </Box>
                  <Box>
                    <Button size="small" onClick={() => setExpandedId(isExpanded ? null : server.id)}>
                      {isExpanded ? '收起' : '详情'}
                    </Button>
                    <IconButton size="small" onClick={() => handleOpen(server)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(server)}><DeleteIcon fontSize="small" /></IconButton>
                  </Box>
                </CardActions>

                {/* Expandable detail */}
                {isExpanded && (
                  <Box sx={{ px: 2, pb: 2 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    <Grid container spacing={1.5}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">EU</Typography>
                        <Typography variant="body2">{server.eu || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">ISV</Typography>
                        <Typography variant="body2">{server.isv || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">主机名</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{server.hostname || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">安装时间</Typography>
                        <Typography variant="body2">{server.install_date?.substring(0, 10) || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">DB版本</Typography>
                        <Typography variant="body2">{server.db_version || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">授权到期</Typography>
                        <Typography variant="body2">{server.license_expiry?.substring(0, 10) || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">HA类型</Typography>
                        <Typography variant="body2">{server.ha_type || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">厂商</Typography>
                        <Typography variant="body2">{[server.server_vendor, server.vm_vendor, server.cloud_vendor].filter(Boolean).join(' / ') || '-'}</Typography>
                      </Grid>
                      {server.purpose && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">用途</Typography>
                          <Typography variant="body2">{server.purpose}</Typography>
                        </Grid>
                      )}
                      {/* DB params */}
                      {server.shared_buffer && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">优化参数</Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                            {['shared_buffer', 'effective_cache_size', 'max_connections', 'work_mem', 'wal_buffers', 'random_page_cost'].map(k => {
                              if (!server[k]) return null;
                              return <Chip key={k} label={`${k}=${server[k]}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />;
                            })}
                          </Box>
                        </Grid>
                      )}
                    </Grid>

                    {/* Disks table */}
                    {disks.length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>磁盘信息</Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>用途</TableCell>
                                <TableCell>设备</TableCell>
                                <TableCell>类型</TableCell>
                                <TableCell>大小</TableCell>
                                <TableCell>挂载点</TableCell>
                                <TableCell>落盘写</TableCell>
                                <TableCell>随机读</TableCell>
                                <TableCell>pgbench延迟</TableCell>
                                <TableCell>200c延迟</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {disks.map((d, i) => (
                                <TableRow key={i}>
                                  <TableCell>{d.disk_purpose || '-'}</TableCell>
                                  <TableCell sx={{ fontFamily: 'monospace' }}>{d.device || '-'}</TableCell>
                                  <TableCell>
                                    <Chip label={d.disk_type || '-'} size="small"
                                      color={d.disk_type === 'SSD' ? 'info' : d.disk_type === 'NVMe' ? 'success' : 'default'} />
                                  </TableCell>
                                  <TableCell>{d.size || '-'}</TableCell>
                                  <TableCell sx={{ fontFamily: 'monospace' }}>{d.mount_point || '-'}</TableCell>
                                  <TableCell>{fmtPerf(d.disk_write_3k)}</TableCell>
                                  <TableCell>{fmtPerf(d.random_read_3k)}</TableCell>
                                  <TableCell>{d.pgbench_latency ? `${d.pgbench_latency}ms` : '-'}</TableCell>
                                  <TableCell>{d.pgbench200_latency ? `${d.pgbench200_latency}ms` : '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    )}
                  </Box>
                )}
              </Card>
            );
          })}
        </>
      )}

      {/* Tab 1: Smart Analysis */}
      {tabIndex === 1 && analysis && (
        <Box>
          {/* Summary cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', borderTop: 3, borderColor: 'primary.main' }}>
                <Typography variant="h4" color="primary">{analysis.total}</Typography>
                <Typography variant="caption" color="text.secondary">服务器总数</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', borderTop: 3, borderColor: 'warning.main' }}>
                <Typography variant="h4" color="warning.main">{analysis.smallMem.length}</Typography>
                <Typography variant="caption" color="text.secondary">内存&lt;8GB</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', borderTop: 3, borderColor: 'error.main' }}>
                <Typography variant="h4" color="error.main">{analysis.noHA.length}</Typography>
                <Typography variant="caption" color="text.secondary">无高可用</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', borderTop: 3, borderColor: 'error.light' }}>
                <Typography variant="h4" color="error.light">{analysis.expiring.length}</Typography>
                <Typography variant="caption" color="text.secondary">授权即将到期</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            {/* OS distribution */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>操作系统分布</Typography>
                {Object.entries(analysis.osCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <Box key={k} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography variant="caption" noWrap sx={{ maxWidth: 300 }}>{k}</Typography>
                      <Typography variant="caption">{v}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={(v / analysis.total) * 100}
                      sx={{ height: 6, borderRadius: 3 }} />
                  </Box>
                ))}
              </Paper>
            </Grid>

            {/* Deploy arch distribution */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>部署架构分布</Typography>
                {Object.entries(analysis.archCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <Box key={k} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography variant="caption">{k}</Typography>
                      <Typography variant="caption">{v}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={(v / analysis.total) * 100}
                      color={k.includes('单机') || k === '单机' ? 'warning' : 'primary'}
                      sx={{ height: 6, borderRadius: 3 }} />
                  </Box>
                ))}
              </Paper>
            </Grid>

            {/* Risk flags */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="warning.main">
                  <WarningAmberIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  风险预警
                </Typography>
                {analysis.smallMem.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 1 }}>{analysis.smallMem.length} 台服务器内存不足 8GB：
                    {analysis.smallMem.slice(0, 3).map(s => `${s.resource_id || s.hostname}(${s.memory_total}G)`).join(', ')}
                    {analysis.smallMem.length > 3 && `等${analysis.smallMem.length}台`}
                  </Alert>
                )}
                {analysis.noHA.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 1 }}>{analysis.noHA.length} 台为单机部署，无高可用保障：
                    {analysis.noHA.slice(0, 3).map(s => s.resource_id || s.node_name).filter(Boolean).join(', ') || '(节点名未填写)'}
                  </Alert>
                )}
                {analysis.expiring.length > 0 && (
                  <Alert severity="error" sx={{ mb: 1 }}>{analysis.expiring.length} 台授权即将到期（3个月内）：
                    {analysis.expiring.slice(0, 3).map(s => `${s.resource_id || s.hostname}(${s.license_expiry?.substring(0, 10)})`).join(', ')}
                  </Alert>
                )}
                {analysis.smallMem.length === 0 && analysis.noHA.length === 0 && analysis.expiring.length === 0 && (
                  <Alert severity="success">未发现明显风险项，整体状态良好。</Alert>
                )}
              </Paper>
            </Grid>

            {/* Top performers */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="info.main">
                  <SpeedIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  磁盘性能 Top 5（落盘写）
                </Typography>
                {analysis.perfSorted.slice(0, 5).map((s, i) => {
                  const d = s.disks?.find(dd => dd.disk_write_3k);
                  return (
                    <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: i < 4 ? '1px solid' : 0, borderColor: 'divider' }}>
                      <Typography variant="caption" noWrap sx={{ maxWidth: 280 }}>{s.project_name?.substring(0, 30)} / {s.resource_id}</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {d?.disk_write_3k || '-'} | {d?.random_read_3k || '-'}
                      </Typography>
                    </Box>
                  );
                })}
                {analysis.perfSorted.length === 0 && (
                  <Typography variant="caption" color="text.secondary">暂无性能测试数据</Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Dialog: Add/Edit Server */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{editing ? '编辑服务器' : '录入服务器'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Basic info */}
            <Typography variant="subtitle2" color="primary">基本信息</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <Autocomplete freeSolo size="small" options={projects.map(p => p.name)} value={form.project_name || ''}
                  onChange={(_, v) => setForm({ ...form, project_name: v || '' })}
                  onInputChange={(_, v) => setForm({ ...form, project_name: v })}
                  renderInput={(params) => <TextField {...params} label="项目" required />} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="资源序号" value={form.resource_id || ''} onChange={e => setForm({ ...form, resource_id: e.target.value })} size="small" fullWidth placeholder="G1-S1" />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="标识码" value={form.node_name || ''} onChange={e => setForm({ ...form, node_name: e.target.value })} size="small" fullWidth />
              </Grid>
              <Grid item xs={6} sm={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>部署架构</InputLabel>
                  <Select value={form.deploy_arch || ''} onChange={e => setForm({ ...form, deploy_arch: e.target.value })} label="部署架构">
                    {DEPLOY_ARCHS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="主备" value={form.master_slave || ''} onChange={e => setForm({ ...form, master_slave: e.target.value })} size="small" fullWidth />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField label="用途" value={form.purpose || ''} onChange={e => setForm({ ...form, purpose: e.target.value })} size="small" fullWidth />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="安装时间" type="date" value={form.install_date?.substring(0, 10) || ''}
                  onChange={e => setForm({ ...form, install_date: e.target.value })} size="small" fullWidth InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField label="EU" value={form.eu || ''} onChange={e => setForm({ ...form, eu: e.target.value })} size="small" fullWidth />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField label="ISV" value={form.isv || ''} onChange={e => setForm({ ...form, isv: e.target.value })} size="small" fullWidth />
              </Grid>
            </Grid>

            {/* CPU + Memory */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">CPU / 内存 / 系统</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1.5}>
                  <Grid item xs={6} sm={3}><TextField label="CPU型号" value={form.cpu_model || ''} onChange={e => setForm({ ...form, cpu_model: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="架构" value={form.cpu_arch || ''} onChange={e => setForm({ ...form, cpu_arch: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={4} sm={2}><TextField label="逻辑核" value={form.logical_cpus || ''} onChange={e => setForm({ ...form, logical_cpus: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={4} sm={2}><TextField label="物理核" value={form.physical_cores || ''} onChange={e => setForm({ ...form, physical_cores: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={4} sm={2}><TextField label="NUMA" value={form.numa_nodes || ''} onChange={e => setForm({ ...form, numa_nodes: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="内存" value={form.memory_total || ''} onChange={e => setForm({ ...form, memory_total: e.target.value })} size="small" fullWidth placeholder="GB" /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="SWAP" value={form.swap || ''} onChange={e => setForm({ ...form, swap: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={12}>
                    <TextField label="OS版本" value={form.os_version || ''} onChange={e => setForm({ ...form, os_version: e.target.value })} size="small" fullWidth multiline minRows={2} />
                  </Grid>
                  <Grid item xs={6} sm={3}><TextField label="主机名" value={form.hostname || ''} onChange={e => setForm({ ...form, hostname: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="用户" value={form.os_user || ''} onChange={e => setForm({ ...form, os_user: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="密码" value={form.os_password || ''} onChange={e => setForm({ ...form, os_password: e.target.value })} size="small" fullWidth type="password" /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="locale" value={form.locale || ''} onChange={e => setForm({ ...form, locale: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={4}><TextField label="服务器厂商" value={form.server_vendor || ''} onChange={e => setForm({ ...form, server_vendor: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={4}><TextField label="虚拟机厂商" value={form.vm_vendor || ''} onChange={e => setForm({ ...form, vm_vendor: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={4}><TextField label="云厂商" value={form.cloud_vendor || ''} onChange={e => setForm({ ...form, cloud_vendor: e.target.value })} size="small" fullWidth /></Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Network */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">网络</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1.5}>
                  <Grid item xs={6} sm={3}><TextField label="网卡" value={form.nic_name || ''} onChange={e => setForm({ ...form, nic_name: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="IP" value={form.ip || ''} onChange={e => setForm({ ...form, ip: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="MAC" value={form.mac || ''} onChange={e => setForm({ ...form, mac: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="FIP" value={form.fip || ''} onChange={e => setForm({ ...form, fip: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="VIP" value={form.vip || ''} onChange={e => setForm({ ...form, vip: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="EIP" value={form.eip || ''} onChange={e => setForm({ ...form, eip: e.target.value })} size="small" fullWidth /></Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* DB + HA */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">数据库 / 高可用 / 备份</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1.5}>
                  <Grid item xs={6} sm={3}><TextField label="DB版本" value={form.db_version || ''} onChange={e => setForm({ ...form, db_version: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="授权到期" type="date" value={form.license_expiry?.substring(0, 10) || ''} onChange={e => setForm({ ...form, license_expiry: e.target.value })} size="small" fullWidth InputLabelProps={{ shrink: true }} /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="扩展" value={form.extensions || ''} onChange={e => setForm({ ...form, extensions: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="HA类型" value={form.ha_type || ''} onChange={e => setForm({ ...form, ha_type: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="HA scope" value={form.ha_scope || ''} onChange={e => setForm({ ...form, ha_scope: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="读写分离" value={form.read_write_split || ''} onChange={e => setForm({ ...form, read_write_split: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="备份时间" value={form.backup_time || ''} onChange={e => setForm({ ...form, backup_time: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="备份保留" value={form.backup_retention || ''} onChange={e => setForm({ ...form, backup_retention: e.target.value })} size="small" fullWidth /></Grid>
                  <Grid item xs={12}><TextField label="备份脚本" value={form.backup_script || ''} onChange={e => setForm({ ...form, backup_script: e.target.value })} size="small" fullWidth /></Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* DB params */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">数据库优化参数</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1.5}>
                  {['max_connections','shared_buffer','effective_cache_size','maintenance_work_mem','checkpoint_completion_target','wal_buffers','default_statistics_target','random_page_cost','effective_io_concurrency','work_mem','huge_pages','min_wal_size','max_wal_size','max_worker_processes','max_parallel_workers_per_gather','max_parallel_workers','max_parallel_maintenance_workers'].map(k => (
                    <Grid item xs={6} sm={3} key={k}>
                      <TextField label={k} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} size="small" fullWidth />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Disks */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" color="primary">磁盘</Typography>
              <Button size="small" onClick={addDiskRow} startIcon={<AddIcon />}>添加磁盘</Button>
            </Box>
            {(form._disks || []).map((disk, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 1.5, position: 'relative' }}>
                <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
                  <IconButton size="small" onClick={() => removeDiskRow(idx)}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
                <Grid container spacing={1.5}>
                  <Grid item xs={6} sm={2}>
                    <TextField label="用途" value={disk.disk_purpose || ''} onChange={e => updateDiskInForm(idx, 'disk_purpose', e.target.value)} size="small" fullWidth />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField label="设备" value={disk.device || ''} onChange={e => updateDiskInForm(idx, 'device', e.target.value)} size="small" fullWidth />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <FormControl size="small" fullWidth><InputLabel>类型</InputLabel>
                      <Select value={disk.disk_type || ''} onChange={e => updateDiskInForm(idx, 'disk_type', e.target.value)} label="类型">
                        {DISK_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={2}><TextField label="大小" value={disk.size || ''} onChange={e => updateDiskInForm(idx, 'size', e.target.value)} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={2}><TextField label="挂载点" value={disk.mount_point || ''} onChange={e => updateDiskInForm(idx, 'mount_point', e.target.value)} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={2}><TextField label="文件系统" value={disk.filesystem || ''} onChange={e => updateDiskInForm(idx, 'filesystem', e.target.value)} size="small" fullWidth /></Grid>
                  <Grid item xs={12}><TextField label="数据目录" value={disk.data_dir || ''} onChange={e => updateDiskInForm(idx, 'data_dir', e.target.value)} size="small" fullWidth /></Grid>
                  {/* Performance */}
                  <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary">性能测试</Typography></Divider></Grid>
                  <Grid item xs={6} sm={3}><TextField label="落盘写(3KB)" value={disk.disk_write_3k || ''} onChange={e => updateDiskInForm(idx, 'disk_write_3k', e.target.value)} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="随机读(3KB)" value={disk.random_read_3k || ''} onChange={e => updateDiskInForm(idx, 'random_read_3k', e.target.value)} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="大块写(8MB)" value={disk.large_write_8m || ''} onChange={e => updateDiskInForm(idx, 'large_write_8m', e.target.value)} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="pgbench延迟" value={disk.pgbench_latency || ''} onChange={e => updateDiskInForm(idx, 'pgbench_latency', e.target.value)} size="small" fullWidth /></Grid>
                  <Grid item xs={6} sm={3}><TextField label="200c延迟" value={disk.pgbench200_latency || ''} onChange={e => updateDiskInForm(idx, 'pgbench200_latency', e.target.value)} size="small" fullWidth /></Grid>
                </Grid>
              </Paper>
            ))}

            {/* Install package */}
            <TextField label="安装包" value={form.install_package || ''} onChange={e => setForm({ ...form, install_package: e.target.value })} size="small" fullWidth multiline minRows={2} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.project_name}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
