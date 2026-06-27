import { useState, useEffect } from 'react';
import {
  Paper, Typography, TextField, Button, Box, IconButton, Chip, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Card, CardContent,
  CardActions, Checkbox, FormControlLabel, LinearProgress, Tooltip, Divider, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TuneIcon from '@mui/icons-material/Tune';
import {
  getWbsItems, createWbsItem, updateWbsItem, deleteWbsItem,
  getWbsScenarios, createWbsScenario, updateWbsScenario, deleteWbsScenario,
} from '../db/wbs';

const EMPTY_ITEM = { name: '', description: '', deadline: '', weight: 0, recommend: '', notes: '', sort_order: 0 };
const EMPTY_SCENARIO = { name: '', description: '', sort_order: 0, items: [] };

export default function WbsManager() {
  const [tabIndex, setTabIndex] = useState(0);
  const [items, setItems] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [msg, setMsg] = useState(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [deleteScenarioTarget, setDeleteScenarioTarget] = useState(null);

  // Item dialog
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);

  // Scenario dialog
  const [scenarioDialog, setScenarioDialog] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [scenarioForm, setScenarioForm] = useState(EMPTY_SCENARIO);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDesc, setScenarioDesc] = useState('');
  const [checkedItems, setCheckedItems] = useState({}); // {itemId: {checked, customWeight}}

  const loadAll = async () => {
    try {
      setItems(await getWbsItems());
      setScenarios(await getWbsScenarios());
    } catch (e) { /* */ }
  };
  useEffect(() => { loadAll(); }, []);

  // --- Item handlers ---
  const handleOpenItem = (item) => {
    setEditingItem(item || null);
    setItemForm(item ? { ...item } : { ...EMPTY_ITEM, sort_order: items.length + 1 });
    setItemDialog(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) { setMsg({ text: '名称不能为空', severity: 'warning' }); return; }
    try {
      if (editingItem) { await updateWbsItem(editingItem.id, itemForm); }
      else { await createWbsItem(itemForm); }
      setItemDialog(false); await loadAll();
      setMsg({ text: editingItem ? '已更新' : '已新增', severity: 'success' });
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return;
    await deleteWbsItem(deleteItemTarget.id); await loadAll();
    setMsg({ text: '已删除（关联场景同步清除）', severity: 'success' });
    setDeleteItemTarget(null);
  };

  // --- Scenario handlers ---
  const handleOpenScenario = (sc) => {
    setEditingScenario(sc || null);
    setScenarioName(sc ? sc.name : '');
    setScenarioDesc(sc ? sc.description : '');
    setScenarioForm(sc ? { ...sc } : { ...EMPTY_SCENARIO, sort_order: scenarios.length + 1 });
    // Build checked items map
    const map = {};
    if (sc) {
      sc.items.forEach(i => { map[i.item_id || i.id] = { checked: true, customWeight: i.custom_weight || i.weight || 0 }; });
    }
    setCheckedItems(map);
    setScenarioDialog(true);
  };

  const toggleCheck = (item) => {
    const map = { ...checkedItems };
    if (map[item.id]) {
      delete map[item.id];
    } else {
      map[item.id] = { checked: true, customWeight: item.weight || 0 };
    }
    setCheckedItems(map);
  };

  const updateCustomWeight = (itemId, val) => {
    const map = { ...checkedItems };
    if (map[itemId]) {
      map[itemId] = { ...map[itemId], customWeight: parseInt(val) || 0 };
    }
    setCheckedItems(map);
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) { setMsg({ text: '方案名不能为空', severity: 'warning' }); return; }
    try {
      const sitems = Object.entries(checkedItems)
        .filter(([_, v]) => v.checked)
        .map(([itemId, v]) => ({ item_id: parseInt(itemId), custom_weight: v.customWeight }));
      const data = { name: scenarioName, description: scenarioDesc, sort_order: editingScenario ? editingScenario.sort_order : scenarios.length + 1, items: sitems };
      if (editingScenario) { await updateWbsScenario(editingScenario.id, data); }
      else { await createWbsScenario(data); }
      setScenarioDialog(false); await loadAll();
      setMsg({ text: editingScenario ? '方案已更新' : '方案已创建', severity: 'success' });
    } catch (e) { setMsg({ text: e.message, severity: 'error' }); }
  };

  const handleDeleteScenario = async () => {
    if (!deleteScenarioTarget) return;
    await deleteWbsScenario(deleteScenarioTarget.id); await loadAll();
    setMsg({ text: '方案已删除', severity: 'success' });
    setDeleteScenarioTarget(null);
  };

  const totalWeight = items.reduce((s, i) => s + (i.weight || 0), 0);

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountTreeIcon color="primary" /> 里程碑管理
        </Typography>
        <Box>
          {tabIndex === 0 && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenItem(null)}>
              新增里程碑
            </Button>
          )}
          {tabIndex === 1 && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenScenario(null)}>
              新建方案
            </Button>
          )}
        </Box>
      </Box>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="交付指标" />
        <Tab icon={<TuneIcon />} iconPosition="start" label={`裁剪方案 (${scenarios.length})`} />
      </Tabs>

      {/* ========== TAB 0: 任务清单 ========== */}
      {tabIndex === 0 && (
        <>
          {!items.length ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">暂无交付指标，点击"新增里程碑"开始</Typography>
            </Paper>
          ) : (
            <Paper variant="outlined">
              {items.map((item, idx) => (
                <Box key={item.id}>
                  <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Weight bar */}
                    <Box sx={{ width: 50, textAlign: 'center', flexShrink: 0 }}>
                      <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>{item.weight || 0}%</Typography>
                    </Box>

                    {/* Progress bar visual */}
                    <Box sx={{ position: 'relative', height: 8, width: 60, flexShrink: 0 }}>
                      <LinearProgress variant="determinate" value={item.weight || 0}
                        sx={{ height: 8, borderRadius: 4, backgroundColor: 'grey.100' }} />
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                        {item.recommend && (
                          <Chip label="推荐" size="small" color="success" variant="outlined" />
                        )}
                        {item.deadline && (
                          <Chip label={item.deadline} size="small" variant="outlined" color="warning" />
                        )}
                      </Box>
                      {item.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                          {item.description}
                        </Typography>
                      )}
                      {item.notes && (
                        <Typography variant="caption" color="text.disabled">{item.notes}</Typography>
                      )}
                    </Box>

                    {/* Actions */}
                    <Box sx={{ flexShrink: 0 }}>
                      <IconButton size="small" onClick={() => handleOpenItem(item)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteItemTarget(item)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  </Box>
                  {idx < items.length - 1 && <Divider />}
                </Box>
              ))}
            </Paper>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            共 {items.length} 项，权重总计 {totalWeight}% {totalWeight !== 100 && <Chip label="建议调整至100%" size="small" color="warning" variant="outlined" sx={{ ml: 1 }} />}
          </Typography>

          {/* Item Edit Dialog */}
          <Dialog open={itemDialog} onClose={() => setItemDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{editingItem ? '编辑里程碑' : '新增里程碑'}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField label="权重 %" value={itemForm.weight || ''} type="number" size="small" sx={{ width: 100 }}
                    onChange={e => setItemForm({ ...itemForm, weight: parseInt(e.target.value) || 0 })} />
                  <TextField label="排序" value={itemForm.sort_order || ''} type="number" size="small" sx={{ width: 80 }}
                    onChange={e => setItemForm({ ...itemForm, sort_order: parseInt(e.target.value) || 0 })} />
                  <TextField label="时间节点" value={itemForm.deadline || ''} size="small" sx={{ flex: 1 }}
                    onChange={e => setItemForm({ ...itemForm, deadline: e.target.value })} placeholder="如：合同签订前" />
                </Box>
                <TextField label="里程碑名称" value={itemForm.name} size="small" fullWidth required
                  onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
                <TextField label="说明" value={itemForm.description} size="small" fullWidth multiline minRows={3}
                  onChange={e => setItemForm({ ...itemForm, description: e.target.value })} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField label="推荐标记" value={itemForm.recommend || ''} size="small" fullWidth
                    onChange={e => setItemForm({ ...itemForm, recommend: e.target.value })} />
                  <TextField label="备注" value={itemForm.notes || ''} size="small" fullWidth
                    onChange={e => setItemForm({ ...itemForm, notes: e.target.value })} />
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setItemDialog(false)}>取消</Button>
              <Button variant="contained" onClick={handleSaveItem} disabled={!itemForm.name.trim()}>保存</Button>
            </DialogActions>
          </Dialog>

          {/* Item Delete Confirmation Dialog */}
          <Dialog open={!!deleteItemTarget} onClose={() => setDeleteItemTarget(null)} maxWidth="xs" fullWidth>
            <DialogTitle>确认删除</DialogTitle>
            <DialogContent>
              <Typography>确定要删除「<strong>{deleteItemTarget?.name || ''}</strong>」吗？此操作不可撤销。</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteItemTarget(null)}>取消</Button>
              <Button variant="contained" color="error" onClick={handleDeleteItem}>确认删除</Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {/* ========== TAB 1: 场景裁剪 ========== */}
      {tabIndex === 1 && (
        <>
          {!scenarios.length && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">暂无裁剪方案，点击"新建方案"创建</Typography>
            </Paper>
          )}

          <Grid container spacing={2}>
            {scenarios.map(sc => (
              <Grid item xs={12} md={6} key={sc.id}>
                <Card variant="outlined">
                  <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>{sc.name}</Typography>
                      <Chip label={`${sc.total_weight || 0}%`} color="primary" size="small" />
                    </Box>
                    {sc.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{sc.description}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {sc.items?.length || 0} 项任务
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      {sc.items?.map(it => (
                        <Box key={it.id || it.item_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3 }}>
                          <Chip label={`${it.custom_weight || it.weight || 0}%`} size="small" color="primary" variant="outlined" sx={{ minWidth: 50 }} />
                          <Typography variant="body2" noWrap>{it.name}</Typography>
                          {it.recommend && <Chip label="推" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                    <IconButton size="small" onClick={() => handleOpenScenario(sc)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteScenarioTarget(sc)}><DeleteIcon fontSize="small" /></IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Scenario Edit Dialog */}
          <Dialog open={scenarioDialog} onClose={() => setScenarioDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{editingScenario ? '编辑方案' : '新建裁剪方案'}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <TextField label="方案名称" value={scenarioName} size="small" fullWidth required
                  onChange={e => setScenarioName(e.target.value)} placeholder="如：精简版 / 标准版 / 完整版 / 招投标版" />
                <TextField label="方案说明" value={scenarioDesc} size="small" fullWidth multiline minRows={2}
                  onChange={e => setScenarioDesc(e.target.value)} placeholder="描述此裁剪方案适用的场景..." />
                <Divider />
                <Typography variant="subtitle2">勾选需要包含的任务，可调整权重：</Typography>
                {items.map(item => {
                  const ci = checkedItems[item.id];
                  return (
                    <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <FormControlLabel
                        control={<Checkbox checked={!!ci?.checked} onChange={() => toggleCheck(item)} size="small" />}
                        label={<Typography variant="body2" sx={{ fontWeight: ci?.checked ? 600 : 400 }}>{item.name}</Typography>}
                        sx={{ flex: 1, m: 0 }}
                      />
                      {ci?.checked && (
                        <TextField value={ci.customWeight || item.weight || 0} type="number" size="small"
                          onChange={e => updateCustomWeight(item.id, e.target.value)}
                          sx={{ width: 70 }} InputProps={{ endAdornment: <Typography variant="caption">%</Typography> }} />
                      )}
                    </Box>
                  );
                })}
                {checkedItems && Object.keys(checkedItems).length > 0 && (
                  <Typography variant="caption" color="primary">
                    已选 {Object.keys(checkedItems).length} 项，
                    权重合计 {Object.values(checkedItems).reduce((s, v) => s + (v.customWeight || 0), 0)}%
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setScenarioDialog(false)}>取消</Button>
              <Button variant="contained" onClick={handleSaveScenario} disabled={!scenarioName.trim()}>保存</Button>
            </DialogActions>
          </Dialog>

          {/* Scenario Delete Confirmation Dialog */}
          <Dialog open={!!deleteScenarioTarget} onClose={() => setDeleteScenarioTarget(null)} maxWidth="xs" fullWidth>
            <DialogTitle>确认删除</DialogTitle>
            <DialogContent>
              <Typography>确定要删除「<strong>{deleteScenarioTarget?.name || ''}</strong>」吗？此操作不可撤销。</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteScenarioTarget(null)}>取消</Button>
              <Button variant="contained" color="error" onClick={handleDeleteScenario}>确认删除</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
}