import { useState, useEffect } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton, Chip, Card, CardContent,
  CardActions, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControl, InputLabel, Select, MenuItem, Grid, Badge, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TuneIcon from '@mui/icons-material/Tune';
import { getReleases, createRelease, updateRelease, deleteRelease } from '../db/releases';
import { getCatalog } from '../db/products';

const STATUS_OPTIONS = ['在售', '预售', '热销', '停产', '下架'];
const STATUS_COLORS = { 在售: 'success', 预售: 'info', 热销: 'error', 停产: 'default', 下架: 'warning' };
const EMPTY = { catalog_id: 0, product_path: '', version: '', ip_name: '', ip_type: '', ip_number: '', release_date: '', description: '', sales_count: 0, adapt_count: 0, status: '在售', features: '', rank_score: 0 };

export default function ProductMarketplace() {
  const [products, setProducts] = useState([]);
  const [catalogAll, setCatalogAll] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sortBy, setSortBy] = useState('rank');

  const load = async () => {
    try {
      const [p, c] = await Promise.all([getReleases(), getCatalog()]);
      setProducts(p); setCatalogAll(c);
    } catch (e) { /* */ }
  };
  useEffect(() => { load(); }, []);

  // Product line path options
  const pathOptions = [];
  const l1Items = catalogAll.filter(i => i.level === 1);
  for (const l1 of l1Items) {
    const l2Items = catalogAll.filter(i => i.level === 2 && i.parent_id === l1.id);
    for (const l2 of l2Items) {
      pathOptions.push({ path: `${l1.name} / ${l2.name}`, l2Id: l2.id });
    }
  }

  const handleOpen = (r) => {
    if (r) {
      setEditing(r);
      setForm({ catalog_id: r.catalog_id, product_path: r.product_path, version: r.version, ip_name: r.ip_name || '', ip_type: r.ip_type || '', ip_number: r.ip_number || '', release_date: r.release_date || '', description: r.description || '', sales_count: r.sales_count || 0, adapt_count: r.adapt_count || 0, status: r.status || '在售', features: r.features || '', rank_score: r.rank_score || 0 });
    } else { setEditing(null); setForm(EMPTY); }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) await updateRelease(editing.id, form);
      else await createRelease(form);
      setDialogOpen(false); await load();
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const handleDelete = async () => {
    try { await deleteRelease(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  // Sort products
  const sorted = [...products].sort((a, b) => {
    if (sortBy === 'rank') return (b.rank_score || 0) - (a.rank_score || 0);
    if (sortBy === 'sales') return (b.sales_count || 0) - (a.sales_count || 0);
    if (sortBy === 'adapt') return (b.adapt_count || 0) - (a.adapt_count || 0);
    return 0;
  });

  const totalSales = products.reduce((s, p) => s + (p.sales_count || 0), 0);
  const totalAdapt = products.reduce((s, p) => s + (p.adapt_count || 0), 0);
  const onSale = products.filter(p => p.status === '在售' || p.status === '热销').length;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorefrontIcon color="primary" /> 产品超市
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>排序</InputLabel>
            <Select value={sortBy} onChange={e => setSortBy(e.target.value)} label="排序">
              <MenuItem value="rank"><TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />综合排名</MenuItem>
              <MenuItem value="sales">按销量</MenuItem>
              <MenuItem value="adapt">按适配量</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>上架产品</Button>
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* Top stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 3 }}>
        <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderTop: '3px solid #2e7d32' }}>
          <Typography variant="h5" fontWeight={700} color="success.main">{onSale}</Typography>
          <Typography variant="body2" color="text.secondary">在售产品</Typography>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderTop: '3px solid #1565c0' }}>
          <Typography variant="h5" fontWeight={700} color="primary.main">{totalSales}</Typography>
          <Typography variant="body2" color="text.secondary">总销量</Typography>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderTop: '3px solid #ed6c02' }}>
          <Typography variant="h5" fontWeight={700} color="warning.main">{totalAdapt}</Typography>
          <Typography variant="body2" color="text.secondary">总适配</Typography>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderTop: '3px solid #757575' }}>
          <Typography variant="h5" fontWeight={700}>{products.length}</Typography>
          <Typography variant="body2" color="text.secondary">产品总数</Typography>
        </Paper>
      </Box>

      {/* Product cards */}
      <Grid container spacing={2}>
        {sorted.map((p, idx) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={p.id}>
            <Card variant="outlined" sx={{
              height: '100%', display: 'flex', flexDirection: 'column',
              borderTop: `3px solid ${p.status === '热销' ? '#d32f2f' : p.status === '在售' ? '#2e7d32' : p.status === '预售' ? '#0288d1' : '#9e9e9e'}`,
              opacity: p.status === '下架' || p.status === '停产' ? 0.7 : 1,
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: 6 },
            }}>
              <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {p.product_path || p.version}
                    </Typography>
                    {p.product_path && p.version && (
                      <Typography variant="body2" color="text.secondary">{p.version}</Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    {idx < 3 && sortBy === 'rank' && (
                      <Chip label={`#${idx + 1}`} size="small" color={idx === 0 ? 'error' : idx === 1 ? 'warning' : 'default'} sx={{ height: 20, fontSize: '0.7rem' }} />
                    )}
                    <Chip label={p.status} size="small" color={STATUS_COLORS[p.status] || 'default'} variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />
                  </Box>
                </Box>

                {/* Features */}
                {p.features && (
                  <Typography variant="body2" color="primary.main" sx={{ mb: 1, fontWeight: 500, fontSize: '0.8rem' }}>
                    {p.features}
                  </Typography>
                )}

                {/* Metrics row */}
                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="primary.main">{p.sales_count || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">销量</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="warning.main">{p.adapt_count || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">适配</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <TuneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="caption" display="block" color="text.secondary">
                      {p.rank_score || 0}分
                    </Typography>
                  </Box>
                </Box>

                {/* IP info */}
                {(p.ip_name || p.ip_number) && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {p.ip_type && <Chip label={p.ip_type} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />}
                    {p.ip_name && <Chip label={p.ip_name} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />}
                  </Box>
                )}

                {p.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.78rem' }}>
                    {p.description.length > 60 ? p.description.slice(0, 60) + '...' : p.description}
                  </Typography>
                )}
              </CardContent>

              <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                <IconButton size="small" onClick={() => handleOpen(p)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => setDeleteTarget(p)}><DeleteIcon fontSize="small" /></IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {!products.length && (
        <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">暂无产品，点击"上架产品"开始</Typography></Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '编辑产品' : '上架新产品'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <FormControl size="small">
                <InputLabel>产品线</InputLabel>
                <Select value={form.product_path} onChange={e => {
                  const opt = pathOptions.find(o => o.path === e.target.value);
                  setForm({ ...form, product_path: e.target.value, catalog_id: opt ? opt.l2Id : 0 });
                }} label="产品线">
                  {pathOptions.map(o => <MenuItem key={o.path} value={o.path}>{o.path}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="版本/型号" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })}
                size="small" placeholder="如：V9.1.0" />
            </Box>
            <TextField label="产品亮点" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })}
              size="small" placeholder="如：支持Oracle兼容、分布式部署、7x24高可用..." fullWidth />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <TextField label="销量" type="number" value={form.sales_count} onChange={e => setForm({ ...form, sales_count: parseInt(e.target.value) || 0 })}
                size="small" />
              <TextField label="适配量" type="number" value={form.adapt_count} onChange={e => setForm({ ...form, adapt_count: parseInt(e.target.value) || 0 })}
                size="small" />
              <TextField label="综合评分" type="number" value={form.rank_score} onChange={e => setForm({ ...form, rank_score: parseInt(e.target.value) || 0 })}
                size="small" />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <FormControl size="small">
                <InputLabel>状态</InputLabel>
                <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} label="状态">
                  {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="发布日期" type="date" value={form.release_date} onChange={e => setForm({ ...form, release_date: e.target.value })}
                size="small" InputLabelProps={{ shrink: true }} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <FormControl size="small">
                <InputLabel>知识产权类型</InputLabel>
                <Select value={form.ip_type} onChange={e => setForm({ ...form, ip_type: e.target.value })} label="知识产权类型">
                  {['', '软件著作权', '专利', '商标', '兼容证明', '评测报告'].map(t => <MenuItem key={t} value={t}>{t || '无'}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="知识产权名称" value={form.ip_name} onChange={e => setForm({ ...form, ip_name: e.target.value })}
                size="small" />
              <TextField label="证书编号" value={form.ip_number} onChange={e => setForm({ ...form, ip_number: e.target.value })}
                size="small" />
            </Box>
            <TextField label="描述" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              size="small" multiline minRows={2} placeholder="产品详细说明..." fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.version.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>确认下架</DialogTitle>
        <DialogContent><Typography>确定要删除「{deleteTarget?.product_path} {deleteTarget?.version}」吗？</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
