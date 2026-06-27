import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  Snackbar,
  Alert,
  Chip,
  Autocomplete,
  Tabs,
  Tab,
  LinearProgress,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import {
  getAllProjects,
  addProject,
  updateProject,
  deleteProject,
  getProjectConditions,
  saveProjectConditions,
  updateProjectCondition,
  deleteProjectCondition,
  checkProjectStatus,
} from '../db/projects';
import { getAllSales } from '../db/sales';

const STATUS_OPTIONS = ['进行中', '已完成', '暂停'];
const TARGET_STATUS = '已完成'; // 当前仅支持"已完成"状态的条件管理

const statusColor = {
  '进行中': 'primary',
  '已完成': 'success',
  '暂停': 'default',
};

/**
 * 项目状态达成条件管理组件。
 * 提供项目CRUD + 状态变更条件检查机制：
 * 项目从"进行中"变更为"已完成"时，必须满足预设的条件清单（全部勾选 is_met=1）。
 */
export default function ProjectManager() {
  const [projects, setProjects] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [editingProject, setEditingProject] = useState(null);
  const [dialogForm, setDialogForm] = useState({
    code: '',
    name: '',
    customer: '',
    isv: '',
    product_version: '',
    status: '进行中',
    sales_person: '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [filterName, setFilterName] = useState('');
  const [filterSalesperson, setFilterSalesperson] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 达成条件相关状态
  const [conditionsMap, setConditionsMap] = useState({}); // { projectId: { met_count, total_count } }
  const [dialogTab, setDialogTab] = useState(0); // 0=基本信息, 1=达成条件
  const [conditions, setConditions] = useState([]); // 当前编辑项目的条件列表
  const [conditionsLoading, setConditionsLoading] = useState(false);
  const [newConditionText, setNewConditionText] = useState('');

  /** Client-side filtered projects */
  const displayProjects = projects.filter(p => {
    if (filterName && !p.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterSalesperson && p.sales_person !== filterSalesperson) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  /** Reload projects from API */
  const loadProjects = useCallback(async () => {
    try {
      const data = await getAllProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, []);

  /** Load sales list for dropdown */
  const loadSales = useCallback(async () => {
    try {
      const data = await getAllSales();
      setSalesList(data);
    } catch (err) {
      console.error('Failed to load sales:', err);
    }
  }, []);

  /** 加载所有项目（非已完成状态）的达成条件进度 */
  const loadAllConditionsProgress = useCallback(async () => {
    const map = {};
    try {
      // 批量请求每个非已完成项目的条件进度
      const activeProjects = projects.filter(p => p.status !== '已完成');
      const results = await Promise.allSettled(
        activeProjects.map(p => checkProjectStatus(p.id, TARGET_STATUS))
      );
      activeProjects.forEach((p, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          map[p.id] = {
            met_count: result.value.met_count || 0,
            total_count: result.value.total_count || 0,
          };
        } else {
          map[p.id] = { met_count: 0, total_count: 0 };
        }
      });
    } catch (err) {
      console.error('Failed to load conditions progress:', err);
    }
    setConditionsMap(map);
  }, [projects]);

  useEffect(() => {
    loadProjects();
    loadSales();
  }, [loadProjects, loadSales]);

  // 每次 projects 更新后刷新条件进度
  useEffect(() => {
    if (projects.length > 0) {
      loadAllConditionsProgress();
    }
  }, [projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Open add dialog */
  const handleAdd = () => {
    setDialogMode('add');
    setDialogForm({ code: '', name: '', customer: '', isv: '', product_version: '', status: '进行中', sales_person: '' });
    setEditingProject(null);
    setDialogTab(0);
    setConditions([]);
    setNewConditionText('');
    setDialogOpen(true);
  };

  /** Open edit dialog */
  const handleEdit = (project) => {
    setDialogMode('edit');
    setDialogForm({
      code: project.code || '',
      name: project.name || '',
      customer: project.customer || '',
      isv: project.isv || '',
      product_version: project.product_version || '',
      status: project.status || '进行中',
      sales_person: project.sales_person || '',
    });
    setEditingProject(project);
    setDialogTab(0);
    setConditions([]);
    setNewConditionText('');
    setDialogOpen(true);
    // 加载该项目的达成条件
    loadConditions(project.id);
  };

  /** 加载项目达成条件 */
  const loadConditions = async (projectId) => {
    setConditionsLoading(true);
    try {
      const data = await getProjectConditions(projectId, TARGET_STATUS);
      setConditions(data);
    } catch (err) {
      console.error('Failed to load conditions:', err);
      setConditions([]);
    } finally {
      setConditionsLoading(false);
    }
  };

  /** 切换条件勾选状态 */
  const handleConditionToggle = async (condition) => {
    if (!editingProject) return;
    try {
      const updated = await updateProjectCondition(editingProject.id, condition.id, {
        is_met: condition.is_met ? 0 : 1,
        met_by: condition.is_met ? '' : '当前用户',
      });
      setConditions(prev =>
        prev.map(c => (c.id === condition.id ? updated : c))
      );
      // 刷新条件进度
      loadAllConditionsProgress();
    } catch (err) {
      setSnackbar({ open: true, message: '更新条件失败: ' + err.message, severity: 'error' });
    }
  };

  /** 更新条件描述 */
  const handleConditionTextChange = async (condition, newText) => {
    if (!editingProject || !newText.trim()) return;
    try {
      const updated = await updateProjectCondition(editingProject.id, condition.id, {
        condition_text: newText.trim(),
      });
      setConditions(prev =>
        prev.map(c => (c.id === condition.id ? updated : c))
      );
    } catch (err) {
      setSnackbar({ open: true, message: '修改条件失败: ' + err.message, severity: 'error' });
    }
  };

  /** 删除单条条件 */
  const handleConditionDelete = async (condition) => {
    if (!editingProject) return;
    try {
      await deleteProjectCondition(editingProject.id, condition.id);
      setConditions(prev => prev.filter(c => c.id !== condition.id));
      loadAllConditionsProgress();
      setSnackbar({ open: true, message: '条件已删除', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '删除条件失败: ' + err.message, severity: 'error' });
    }
  };

  /** 添加新条件 */
  const handleAddCondition = async () => {
    if (!editingProject || !newConditionText.trim()) return;
    try {
      const updatedList = [
        ...conditions.map((c, i) => ({ condition_text: c.condition_text, sort_order: i })),
        { condition_text: newConditionText.trim(), sort_order: conditions.length },
      ];
      const saved = await saveProjectConditions(editingProject.id, TARGET_STATUS, updatedList);
      setConditions(saved);
      setNewConditionText('');
      loadAllConditionsProgress();
      setSnackbar({ open: true, message: '条件已添加', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '添加条件失败: ' + err.message, severity: 'error' });
    }
  };

  /** Confirm add/edit dialog */
  const handleDialogConfirm = async () => {
    if (!dialogForm.name.trim()) {
      setSnackbar({ open: true, message: '项目名称不能为空', severity: 'warning' });
      return;
    }

    try {
      if (dialogMode === 'add') {
        await addProject(
          dialogForm.name.trim(),
          dialogForm.customer.trim(),
          dialogForm.isv.trim(),
          dialogForm.product_version.trim(),
          dialogForm.status,
          dialogForm.sales_person.trim(),
          dialogForm.code.trim()
        );
        setSnackbar({ open: true, message: '项目添加成功', severity: 'success' });
      } else if (dialogMode === 'edit' && editingProject) {
        // 状态变更为"已完成"时，先检查达成条件
        if (dialogForm.status === '已完成' && editingProject.status !== '已完成') {
          try {
            const checkResult = await checkProjectStatus(editingProject.id, TARGET_STATUS);
            if (!checkResult.can_change) {
              const unmetMsg = checkResult.unmet_list && checkResult.unmet_list.length > 0
                ? `以下条件未达成：\n${checkResult.unmet_list.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
                : '该项目未配置"已完成"状态的达成条件，请先在"达成条件"页签中设置条件。';
              setSnackbar({ open: true, message: unmetMsg, severity: 'warning' });
              return; // 阻止保存
            }
          } catch (checkErr) {
            setSnackbar({ open: true, message: '检查达成条件失败: ' + checkErr.message, severity: 'error' });
            return;
          }
        }

        await updateProject(editingProject.id, {
          code: dialogForm.code.trim(),
          name: dialogForm.name.trim(),
          customer: dialogForm.customer.trim(),
          isv: dialogForm.isv.trim(),
          product_version: dialogForm.product_version.trim(),
          status: dialogForm.status,
          sales_person: dialogForm.sales_person.trim(),
        });
        setSnackbar({ open: true, message: '项目更新成功', severity: 'success' });
      }
      loadProjects();
    } catch (err) {
      setSnackbar({ open: true, message: '操作失败: ' + err.message, severity: 'error' });
      return; // 操作失败也保持对话框打开
    }

    setDialogOpen(false);
  };

  /** Open delete confirmation */
  const handleDeleteClick = (project) => {
    setDeleteTarget(project);
    setDeleteDialogOpen(true);
  };

  /** Confirm deletion */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id);
      setSnackbar({ open: true, message: '项目删除成功', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '删除失败: ' + err.message, severity: 'error' });
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    loadProjects();
  };

  /** 计算条件达成进度百分比 */
  const getConditionProgress = (projectId) => {
    const prog = conditionsMap[projectId];
    if (!prog || prog.total_count === 0) return null;
    return {
      met: prog.met_count,
      total: prog.total_count,
      percent: Math.round((prog.met_count / prog.total_count) * 100),
    };
  };

  const columns = [
    { field: 'code', headerName: '项目编号', width: 130, resizable: true,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500, color: 'primary.main' }}>
          {params.value || '-'}
        </Typography>
      ),
    },
    { field: 'name', headerName: '项目名称', flex: 2, minWidth: 180, resizable: true },
    { field: 'customer', headerName: '客户', flex: 1, minWidth: 100, resizable: true },
    { field: 'isv', headerName: 'ISV', flex: 0.8, minWidth: 80, resizable: true },
    { field: 'product_version', headerName: '产品版本', flex: 0.8, minWidth: 100, resizable: true },
    { field: 'status', headerName: '状态', width: 140, resizable: false, align: 'center', headerAlign: 'center',
      renderCell: (params) => {
        const progress = getConditionProgress(params.row.id);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label={params.value} color={statusColor[params.value] || 'default'} size="small" variant="filled" />
            {params.value !== '已完成' && progress && (
              <Tooltip title={`达成条件进度：${progress.met}/${progress.total}（${progress.percent}%）`}>
                <Chip
                  label={`${progress.met}/${progress.total}`}
                  size="small"
                  variant="outlined"
                  color={progress.percent === 100 ? 'success' : progress.percent >= 50 ? 'warning' : 'error'}
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              </Tooltip>
            )}
          </Box>
        );
      },
    },
    { field: 'sales_person', headerName: '销售负责人', flex: 0.8, minWidth: 80, resizable: true },
    { field: 'actions', headerName: '操作', width: 100, resizable: false, sortable: false, align: 'center', headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          <Tooltip title="编辑"><IconButton size="small" color="primary" onClick={() => handleEdit(params.row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => handleDeleteClick(params.row)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ];

  /** 对话框条件进度统计 */
  const conditionsMet = conditions.filter(c => c.is_met).length;
  const conditionsTotal = conditions.length;
  const conditionsPercent = conditionsTotal > 0 ? Math.round((conditionsMet / conditionsTotal) * 100) : 0;

  return (
    <Box>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700' }}>
          项目管理
        </Typography>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            共 {displayProjects.length} 个项目
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            新增项目
          </Button>
        </Box>

        {/* Filters */}
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>筛选：</Typography>
          <TextField
            label="项目名"
            size="small"
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            placeholder="模糊搜索..."
            sx={{ minWidth: 180 }}
          />
          <TextField
            select
            label="销售负责人"
            size="small"
            value={filterSalesperson}
            onChange={e => setFilterSalesperson(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">全部</MenuItem>
            {salesList.filter(s => s.name).map(s => (
              <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="状态"
            size="small"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            sx={{ minWidth: 100 }}
          >
            <MenuItem value="">全部</MenuItem>
            {STATUS_OPTIONS.map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          {(filterName || filterSalesperson || filterStatus) && (
            <Button size="small" onClick={() => { setFilterName(''); setFilterSalesperson(''); setFilterStatus(''); }}>
              清除筛选
            </Button>
          )}
        </Paper>

        {/* Projects DataGrid */}
        <Box sx={{ height: 500, width: '100%' }}>
          <DataGrid
            rows={displayProjects.map((p, i) => ({ ...p, seq: i + 1 }))}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[10, 25, 50]}
            disableSelectionOnClick
            sx={{
              border: 0,
              '& .MuiDataGrid-cell': { fontSize: '0.85rem' },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#e3f2fd',
                fontWeight: 600,
              },
            }}
          />
        </Box>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'add' ? '新增项目' : '编辑项目'}
        </DialogTitle>

        {/* Tab 切换：编辑模式下显示"达成条件"页签 */}
        {dialogMode === 'edit' && editingProject ? (
          <>
            <Tabs
              value={dialogTab}
              onChange={(_e, newVal) => setDialogTab(newVal)}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
            >
              <Tab label="基本信息" />
              <Tab label={`达成条件${conditionsTotal > 0 ? ` (${conditionsMet}/${conditionsTotal})` : ''}`} />
            </Tabs>

            {dialogTab === 0 && (
              <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <TextField
                    label="项目编号"
                    value={dialogForm.code}
                    onChange={(e) => setDialogForm({ ...dialogForm, code: e.target.value })}
                    fullWidth size="small"
                    placeholder="如 HG-N018450"
                    helperText="业务编码，用于标识项目，自动从名称提取或手工输入"
                  />
                  <TextField
                    autoFocus
                    label="项目名称"
                    value={dialogForm.name}
                    onChange={(e) => setDialogForm({ ...dialogForm, name: e.target.value })}
                    fullWidth
                    size="small"
                    required
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDialogConfirm();
                    }}
                  />
                  <TextField
                    label="客户"
                    value={dialogForm.customer}
                    onChange={(e) => setDialogForm({ ...dialogForm, customer: e.target.value })}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="ISV"
                    value={dialogForm.isv}
                    onChange={(e) => setDialogForm({ ...dialogForm, isv: e.target.value })}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="产品版本"
                    value={dialogForm.product_version}
                    onChange={(e) => setDialogForm({ ...dialogForm, product_version: e.target.value })}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="状态"
                    value={dialogForm.status}
                    onChange={(e) => setDialogForm({ ...dialogForm, status: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                  </TextField>
                  <Autocomplete
                    size="small"
                    options={salesList}
                    getOptionLabel={(option) => option.name || ''}
                    value={salesList.find((s) => s.name === dialogForm.sales_person) || null}
                    onChange={(_event, newValue) => {
                      setDialogForm({ ...dialogForm, sales_person: newValue ? newValue.name : '' });
                    }}
                    isOptionEqualToValue={(option, value) => option.name === value.name}
                    renderInput={(params) => (
                      <TextField {...params} label="销售负责人" fullWidth />
                    )}
                  />
                </Box>
              </DialogContent>
            )}

            {dialogTab === 1 && (
              <DialogContent>
                <Box sx={{ mt: 1 }}>
                  {/* 条件达成进度条 */}
                  {conditionsTotal > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          「{TARGET_STATUS}」条件达成进度
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color={conditionsPercent === 100 ? 'success.main' : 'warning.main'}>
                          {conditionsMet}/{conditionsTotal}（{conditionsPercent}%）
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={conditionsPercent}
                        color={conditionsPercent === 100 ? 'success' : 'warning'}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  )}

                  {conditionsTotal === 0 && !conditionsLoading && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                      尚未配置达成条件。请添加项目完成前需要满足的条件项。
                    </Typography>
                  )}

                  {/* 条件列表 */}
                  {conditionsLoading ? (
                    <Typography variant="body2" color="text.secondary">加载中...</Typography>
                  ) : (
                    <List dense disablePadding>
                      {conditions.map((cond) => (
                        <ListItem
                          key={cond.id}
                          disableGutters
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 1,
                            px: 1,
                          }}
                          secondaryAction={
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleConditionDelete(cond)}
                              title="删除条件"
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox
                              edge="start"
                              checked={!!cond.is_met}
                              onChange={() => handleConditionToggle(cond)}
                              size="small"
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <TextField
                                variant="standard"
                                fullWidth
                                size="small"
                                value={cond.condition_text}
                                onChange={(e) => {
                                  // 本地先更新显示
                                  setConditions(prev =>
                                    prev.map(c => (c.id === cond.id ? { ...c, condition_text: e.target.value } : c))
                                  );
                                }}
                                onBlur={(e) => {
                                  if (e.target.value !== cond.condition_text && e.target.value.trim()) {
                                    handleConditionTextChange(cond, e.target.value);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.target.blur();
                                  }
                                }}
                                sx={{
                                  '& .MuiInput-input': {
                                    textDecoration: cond.is_met ? 'line-through' : 'none',
                                    color: cond.is_met ? 'text.disabled' : 'text.primary',
                                  },
                                }}
                              />
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}

                  {/* 添加新条件 */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="输入新条件内容..."
                      value={newConditionText}
                      onChange={(e) => setNewConditionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCondition();
                      }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAddCondition}
                      disabled={!newConditionText.trim()}
                    >
                      添加
                    </Button>
                  </Box>
                </Box>
              </DialogContent>
            )}
          </>
        ) : (
          /* 新增模式：仅显示基本信息 */
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="项目编号"
                value={dialogForm.code}
                onChange={(e) => setDialogForm({ ...dialogForm, code: e.target.value })}
                fullWidth size="small"
                placeholder="如 HG-N018450"
                helperText="业务编码，用于标识项目，自动从名称提取或手工输入"
              />
              <TextField
                autoFocus
                label="项目名称"
                value={dialogForm.name}
                onChange={(e) => setDialogForm({ ...dialogForm, name: e.target.value })}
                fullWidth
                size="small"
                required
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDialogConfirm();
                }}
              />
              <TextField
                label="客户"
                value={dialogForm.customer}
                onChange={(e) => setDialogForm({ ...dialogForm, customer: e.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label="ISV"
                value={dialogForm.isv}
                onChange={(e) => setDialogForm({ ...dialogForm, isv: e.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label="产品版本"
                value={dialogForm.product_version}
                onChange={(e) => setDialogForm({ ...dialogForm, product_version: e.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                select
                label="状态"
                value={dialogForm.status}
                onChange={(e) => setDialogForm({ ...dialogForm, status: e.target.value })}
                fullWidth
                size="small"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </TextField>
              <Autocomplete
                size="small"
                options={salesList}
                getOptionLabel={(option) => option.name || ''}
                value={salesList.find((s) => s.name === dialogForm.sales_person) || null}
                onChange={(_event, newValue) => {
                  setDialogForm({ ...dialogForm, sales_person: newValue ? newValue.name : '' });
                }}
                isOptionEqualToValue={(option, value) => option.name === value.name}
                renderInput={(params) => (
                  <TextField {...params} label="销售负责人" fullWidth />
                )}
              />
            </Box>
          </DialogContent>
        )}

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
            确定要删除项目「{deleteTarget?.name}」吗？此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.severity === 'warning' ? 6000 : 3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', whiteSpace: 'pre-line' }}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
