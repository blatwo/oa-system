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
  getConditionTemplates,
  saveConditionTemplates,
  updateConditionTemplate,
  deleteConditionTemplate,
} from '../db/projects';
import { getDictByCategory } from '../db/dictionaries';

export default function ProjectConditionManager() {
  const [tabIndex, setTabIndex] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' | 'edit'
  const [dialogText, setDialogText] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  // 删除确认
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 状态列表（从字典动态加载）— 字符串数组
  const [statusOptions, setStatusOptions] = useState([]);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const currentStatus = statusOptions[tabIndex] || '';

  /** 加载当前 Tab 的模板列表 */
  const loadItems = useCallback(async () => {
    if (!currentStatus) return;
    try {
      setLoading(true);
      const data = await getConditionTemplates(currentStatus);
      setItems(data);
    } catch (err) {
      console.error('加载模板失败:', err);
      setSnackbar({ open: true, message: '加载模板失败: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentStatus]);

  /** 加载字典中的状态选项 */
  const loadStatusOptions = useCallback(async () => {
    try {
      const data = await getDictByCategory('status');
      // getDictByCategory 返回字符串数组；如果将来改成对象数组也能兼容
      const list = Array.isArray(data)
        ? data.map(item => typeof item === 'string' ? item : (item.value || item.name || '')).filter(Boolean)
        : [];
      setStatusOptions(list);
    } catch (err) {
      console.error('加载状态字典失败:', err);
      setSnackbar({ open: true, message: '加载状态字典失败: ' + err.message, severity: 'error' });
    }
  }, []);

  useEffect(() => {
    loadStatusOptions();
  }, [loadStatusOptions]);

  useEffect(() => {
    if (currentStatus) loadItems();
  }, [loadItems, currentStatus]);

  /** 切换 Tab */
  const handleTabChange = (_event, newValue) => {
    setTabIndex(newValue);
    if (newValue >= statusOptions.length) {
      setTabIndex(0);
    }
  };

  /** 打开添加对话框 */
  const handleAdd = () => {
    setDialogMode('add');
    setDialogText('');
    setEditingItem(null);
    setDialogOpen(true);
  };

  /** 打开编辑对话框 */
  const handleEdit = (item) => {
    setDialogMode('edit');
    setDialogText(item.condition_text);
    setEditingItem(item);
    setDialogOpen(true);
  };

  /** 确认添加/编辑 */
  const handleDialogConfirm = async () => {
    if (!dialogText.trim()) {
      setSnackbar({ open: true, message: '条件描述不能为空', severity: 'warning' });
      return;
    }

    try {
      if (dialogMode === 'add') {
        // 添加：在当前列表末尾追加，然后整批保存
        const newSortOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1;
        const newConditions = [
          ...items.map(i => ({ condition_text: i.condition_text, sort_order: i.sort_order })),
          { condition_text: dialogText.trim(), sort_order: newSortOrder },
        ];
        await saveConditionTemplates(currentStatus, newConditions);
        setSnackbar({ open: true, message: '添加成功', severity: 'success' });
      } else if (dialogMode === 'edit' && editingItem) {
        await updateConditionTemplate(editingItem.id, { condition_text: dialogText.trim() });
        setSnackbar({ open: true, message: '修改成功', severity: 'success' });
      }
      await loadItems();
    } catch (err) {
      setSnackbar({ open: true, message: '操作失败: ' + err.message, severity: 'error' });
    }

    setDialogOpen(false);
    setDialogText('');
    setEditingItem(null);
  };

  /** 打开删除确认 */
  const handleDeleteClick = (item) => {
    setDeleteTarget(item);
    setDeleteDialogOpen(true);
  };

  /** 确认删除 */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteConditionTemplate(deleteTarget.id);
      setSnackbar({ open: true, message: '删除成功', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '删除失败: ' + err.message, severity: 'error' });
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    await loadItems();
  };

  /** 上移 */
  const handleMoveUp = async (item, index) => {
    if (index === 0) return;
    const prev = items[index - 1];
    await updateConditionTemplate(item.id, { sort_order: prev.sort_order });
    await updateConditionTemplate(prev.id, { sort_order: item.sort_order });
    await loadItems();
  };

  /** 下移 */
  const handleMoveDown = async (item, index) => {
    if (index === items.length - 1) return;
    const next = items[index + 1];
    await updateConditionTemplate(item.id, { sort_order: next.sort_order });
    await updateConditionTemplate(next.id, { sort_order: item.sort_order });
    await loadItems();
  };

  return (
    <Box>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700' }}>
          项目状态达成条件
        </Typography>

        {/* 状态 Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabIndex < statusOptions.length ? tabIndex : 0}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {statusOptions.map((opt, idx) => (
              <Tab key={opt} label={opt} id={`condition-tab-${idx}`} />
            ))}
          </Tabs>
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {currentStatus} — {items.length} 项条件
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              添加条件
            </Button>
          </Box>
        </Box>

        {/* 条件表格 */}
        <TableContainer>
          <Table size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.50' }}>
                <TableCell sx={{ fontWeight: 600, width: 60 }} align="center">序号</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>条件描述</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">排序号</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 150 }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    暂无模板条件，点击「添加条件」创建
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => (
                  <TableRow key={item.id} hover>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {idx + 1}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.condition_text}</Typography>
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

      {/* 添加/编辑对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'add' ? '添加条件' : '编辑条件'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            目标状态：{currentStatus}
          </DialogContentText>
          <TextField
            autoFocus
            label="条件描述"
            value={dialogText}
            onChange={(e) => setDialogText(e.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={2}
            placeholder="请输入达成该状态需要满足的条件..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleDialogConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleDialogConfirm} variant="contained">
            确定
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除该条件模板吗？
            {deleteTarget && (
              <Typography
                component="span"
                sx={{ color: 'text.secondary', display: 'block', mt: 1, fontStyle: 'italic' }}
              >
                「{deleteTarget.condition_text}」
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

      {/* Snackbar 提示 */}
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
