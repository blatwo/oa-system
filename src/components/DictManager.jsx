import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import {
  getAllDicts,
  getDictCategories,
  createDictCategory,
  updateDictCategory,
  deleteDictCategory,
  getDictByCategory,
  addDictItem,
  updateDictItem,
  deleteDictItem,
} from '../db/dictionaries';
import { countRecordsByDictValue } from '../db/records';

export default function DictManager() {
  const [tabIndex, setTabIndex] = useState(0);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' | 'edit'
  const [dialogValue, setDialogValue] = useState('');
  const [dialogDesc, setDialogDesc] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catForm, setCatForm] = useState({ id: 0, code: '', name: '', sort_order: 0, description: '' });
  const [catEditing, setCatEditing] = useState(false);
  const [catSortOpen, setCatSortOpen] = useState(false);

  const currentCategory = categories[tabIndex];
  const currentCatName = currentCategory?.name || '';
  const currentCatId = currentCategory?.id || 0;

  /** Reload items for the current category */
  const loadItems = useCallback(async () => {
    try {
      const all = await getAllDicts();
      const filtered = all
        .filter((d) => d.category_id === currentCatId)
        .sort((a, b) => a.sort_order - b.sort_order);
      setItems(filtered);
    } catch (err) {
      console.error('Failed to load dicts:', err);
    }
  }, [currentCatId]);

  useEffect(() => {
    if (currentCatId) loadItems();
  }, [loadItems]);

  /** Switch tab */
  const handleTabChange = (_event, newValue) => {
    setTabIndex(newValue);
  };

  /** Open add dialog */
  const handleAdd = () => {
    setDialogMode('add');
    setDialogValue('');
    setDialogDesc('');
    setEditingItem(null);
    setDialogOpen(true);
  };

  /** Open edit dialog */
  const handleEdit = (item) => {
    setDialogMode('edit');
    setDialogValue(item.value);
    setDialogDesc(item.description || '');
    setEditingItem(item);
    setDialogOpen(true);
  };

  /** Confirm add/edit dialog */
  const handleDialogConfirm = async () => {
    if (!dialogValue.trim()) {
      setSnackbar({ open: true, message: '值不能为空', severity: 'warning' });
      return;
    }

    try {
      if (dialogMode === 'add') {
        await addDictItem(currentCatName, dialogValue.trim(), dialogDesc.trim(), currentCatId);
        setSnackbar({ open: true, message: '添加成功', severity: 'success' });
      } else if (dialogMode === 'edit' && editingItem) {
        await updateDictItem(editingItem.id, dialogValue.trim(), editingItem.sort_order, dialogDesc.trim());
        setSnackbar({ open: true, message: '修改成功', severity: 'success' });
      }
      loadItems();
    } catch (err) {
      setSnackbar({ open: true, message: '操作失败: ' + err.message, severity: 'error' });
    }

    setDialogOpen(false);
    setDialogValue('');
    setEditingItem(null);
  };

  /** Open delete confirmation, checking usage first */
  const handleDeleteClick = async (item) => {
    let count = 0;
    try { count = await countRecordsByDictValue(item.category, item.value); } catch (e) { /* */ }
    setDeleteTarget(item);
    setDeleteUsageCount(count);
    setDeleteDialogOpen(true);
  };

  /** Confirm deletion */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDictItem(deleteTarget.id);
      setSnackbar({ open: true, message: '删除成功', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '删除失败: ' + err.message, severity: 'error' });
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    setDeleteUsageCount(0);
    loadItems();
  };

  /** Move item up (decrease sort_order) */
  const handleMoveUp = async (item, index) => {
    if (index === 0) return;
    const prev = items[index - 1];
    await updateDictItem(item.id, item.value, prev.sort_order);
    await updateDictItem(prev.id, prev.value, item.sort_order);
    loadItems();
  };

  /** Move item down (increase sort_order) */
  const handleMoveDown = async (item, index) => {
    if (index === items.length - 1) return;
    const next = items[index + 1];
    await updateDictItem(item.id, item.value, next.sort_order);
    await updateDictItem(next.id, next.value, item.sort_order);
    loadItems();
  };

  // --- Category Management ---
  const loadCategories = async () => {
    const cats = await getDictCategories();
    setCategories(cats);
  };

  const openCatDialog = (cat = null) => {
    if (cat) {
      setCatForm({ id: cat.id, code: cat.code, name: cat.name, sort_order: cat.sort_order, description: cat.description || '' });
      setCatEditing(true);
    } else {
      setCatForm({ id: 0, code: '', name: '', sort_order: categories.length + 1, description: '' });
      setCatEditing(false);
    }
    setCatDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!catForm.code || !catForm.name) {
      setSnackbar({ open: true, message: '编码和名称不能为空', severity: 'warning' });
      return;
    }
    try {
      if (catEditing) {
        await updateDictCategory(catForm.id, catForm.code, catForm.name, catForm.sort_order, catForm.description);
      } else {
        await createDictCategory(catForm.code, catForm.name, catForm.sort_order, catForm.description);
      }
      setCatDialogOpen(false);
      await loadCategories();
      setSnackbar({ open: true, message: catEditing ? '修改成功' : '新增成功', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: '操作失败: ' + e.message, severity: 'error' });
    }
  };

  const handleDeleteCategory = async (cat) => {
    // Check if category has items
    const all = await getAllDicts();
    const count = all.filter(d => d.category_id === cat.id).length;
    if (count > 0) {
      setSnackbar({ open: true, message: `「${cat.name}」下有 ${count} 条数据，请先清空`, severity: 'warning' });
      return;
    }
    await deleteDictCategory(cat.id);
    await loadCategories();
    setTabIndex(0);
    setSnackbar({ open: true, message: `「${cat.name}」已删除`, severity: 'success' });
  };

  const handleCatMoveUp = async (cat, idx) => {
    if (idx === 0) return;
    const prev = categories[idx - 1];
    await updateDictCategory(cat.id, cat.code, cat.name, prev.sort_order, cat.description || '');
    await updateDictCategory(prev.id, prev.code, prev.name, cat.sort_order, prev.description || '');
    await loadCategories();
  };

  const handleCatMoveDown = async (cat, idx) => {
    if (idx === categories.length - 1) return;
    const next = categories[idx + 1];
    await updateDictCategory(cat.id, cat.code, cat.name, next.sort_order, cat.description || '');
    await updateDictCategory(next.id, next.code, next.name, cat.sort_order, next.description || '');
    await loadCategories();
  };

  // Load categories on mount
  useEffect(() => { loadCategories(); }, []);

  return (
    <Box>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700' }}>
          字典维护
        </Typography>

        {/* Category Tabs */}
        <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ flex: 1 }}
          >
            {categories.map((cat, idx) => (
              <Tab key={cat.id} label={cat.name} id={`dict-tab-${idx}`} />
            ))}
          </Tabs>
          <IconButton size="small" onClick={() => openCatDialog()} title="新增分类" sx={{ ml: 0.5 }}>
            <AddIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setCatSortOpen(true)} title="管理分类" sx={{ ml: 0.5 }}>
            <ArrowUpwardIcon fontSize="small" sx={{ transform: 'none' }} />
          </IconButton>
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {currentCatName} — {items.length} 项
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            新增
          </Button>
        </Box>

        {/* Items Table */}
        <TableContainer>
          <Table size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.50' }}>
                <TableCell sx={{ fontWeight: 600, width: 60 }}>编码</TableCell>
                <TableCell sx={{ fontWeight: 600, width: '20%' }}>值</TableCell>
                <TableCell sx={{ fontWeight: 600, width: '50%' }}>说明</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 50 }} align="center">排序</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 150 }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    暂无数据，点击"新增"添加
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {item.code || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" noWrap>{item.value}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={item.description || ''} arrow placement="top-start">
                        <Typography variant="body2" color="text.secondary">
                          {item.description || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {item.sort_order}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title="上移">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveUp(item, idx)}
                              disabled={idx === 0}
                            >
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="下移">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveDown(item, idx)}
                              disabled={idx === items.length - 1}
                            >
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="编辑">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEdit(item)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="删除">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(item)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'add' ? '新增字典项' : '编辑字典项'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            类别：{currentCatName}
          </DialogContentText>
          <TextField autoFocus label="值" value={dialogValue}
            onChange={(e) => setDialogValue(e.target.value)} fullWidth size="small"
            onKeyDown={(e) => { if (e.key === 'Enter') handleDialogConfirm(); }} />
          <TextField label="说明" value={dialogDesc}
            onChange={(e) => setDialogDesc(e.target.value)} fullWidth size="small"
            multiline minRows={2}
            placeholder="简短说明该值的含义和适用范围..."
            sx={{ mt: 2, '& textarea': { resize: 'both' } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleDialogConfirm} variant="contained">
            确定
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除字典值「{deleteTarget?.value}」吗？
            {deleteUsageCount > 0 && (
              <Typography
                component="span"
                sx={{ color: 'warning.dark', fontWeight: 600, display: 'block', mt: 1 }}
              >
                该值已被 {deleteUsageCount} 条记录使用，确定删除？
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={catDialogOpen} onClose={() => setCatDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{catEditing ? '编辑分类' : '新增分类'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <TextField label="编码" value={catForm.code} size="small" sx={{ width: 100 }}
              onChange={e => setCatForm({ ...catForm, code: e.target.value })} />
            <TextField label="名称" value={catForm.name} size="small" sx={{ flex: 1 }}
              onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TextField label="排序" value={catForm.sort_order} size="small" type="number" sx={{ width: 100 }}
              onChange={e => setCatForm({ ...catForm, sort_order: Number(e.target.value) })} />
            <TextField label="说明" value={catForm.description} size="small" fullWidth
              onChange={e => setCatForm({ ...catForm, description: e.target.value })} />
          </Box>
          {catEditing && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" color="error" variant="outlined"
                onClick={() => { handleDeleteCategory(currentCategory); setCatDialogOpen(false); }}>
                删除此分类
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialogOpen(false)}>取消</Button>
          <Button onClick={handleSaveCategory} variant="contained">确定</Button>
        </DialogActions>
      </Dialog>

      {/* Category Sort Dialog */}
      <Dialog open={catSortOpen} onClose={() => setCatSortOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>管理分类</DialogTitle>
        <DialogContent>
          {categories.map((cat, idx) => (
            <Box key={cat.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: 28 }}>
                {cat.code}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1, cursor: 'pointer' }}
                onClick={() => { setCatSortOpen(false); openCatDialog(cat); }}>
                {cat.name}
              </Typography>
              <IconButton size="small" onClick={() => { setCatSortOpen(false); openCatDialog(cat); }} title="编辑">
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" disabled={idx === 0}
                onClick={() => handleCatMoveUp(cat, idx)}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" disabled={idx === categories.length - 1}
                onClick={() => handleCatMoveDown(cat, idx)}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatSortOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
