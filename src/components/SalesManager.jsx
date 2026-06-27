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
  Card,
  CardContent,
  Chip,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  getAllSales,
  addSale,
  updateSale,
  deleteSale,
  getSalesStats,
} from '../db/sales';

/**
 * Sales Manager component.
 * Tab 1: Sales person management with full CRUD.
 * Tab 2: Sales-project association statistics.
 */
export default function SalesManager() {
  const [tabIndex, setTabIndex] = useState(0);
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [dialogForm, setDialogForm] = useState({
    name: '',
    department: '',
    phone: '',
    notes: '',
  });
  const [editingSale, setEditingSale] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  /** Reload sales list */
  const loadSales = useCallback(async () => {
    try {
      const data = await getAllSales();
      setSales(data);
    } catch (err) {
      console.error('Failed to load sales:', err);
    }
  }, []);

  /** Reload stats */
  const loadStats = useCallback(async () => {
    try {
      const data = await getSalesStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  useEffect(() => {
    if (tabIndex === 0) {
      loadSales();
    } else {
      loadStats();
    }
  }, [tabIndex, loadSales, loadStats]);

  /** Switch tab */
  const handleTabChange = (_event, newValue) => {
    setTabIndex(newValue);
  };

  /** Open add dialog */
  const handleAdd = () => {
    setDialogMode('add');
    setDialogForm({ name: '', department: '', phone: '', notes: '' });
    setEditingSale(null);
    setDialogOpen(true);
  };

  /** Open edit dialog */
  const handleEdit = (sale) => {
    setDialogMode('edit');
    setDialogForm({
      name: sale.name || '',
      department: sale.department || '',
      phone: sale.phone || '',
      notes: sale.notes || '',
    });
    setEditingSale(sale);
    setDialogOpen(true);
  };

  /** Confirm add/edit dialog */
  const handleDialogConfirm = async () => {
    if (!dialogForm.name.trim()) {
      setSnackbar({ open: true, message: '姓名不能为空', severity: 'warning' });
      return;
    }

    try {
      if (dialogMode === 'add') {
        await addSale(
          dialogForm.name.trim(),
          dialogForm.department.trim(),
          dialogForm.phone.trim(),
          dialogForm.notes.trim()
        );
        setSnackbar({ open: true, message: '添加成功', severity: 'success' });
      } else if (dialogMode === 'edit' && editingSale) {
        await updateSale(editingSale.id, {
          name: dialogForm.name.trim(),
          department: dialogForm.department.trim(),
          phone: dialogForm.phone.trim(),
          notes: dialogForm.notes.trim(),
        });
        setSnackbar({ open: true, message: '更新成功', severity: 'success' });
      }
      loadSales();
    } catch (err) {
      setSnackbar({ open: true, message: '操作失败: ' + err.message, severity: 'error' });
    }

    setDialogOpen(false);
  };

  /** Open delete confirmation */
  const handleDeleteClick = (sale) => {
    setDeleteTarget(sale);
    setDeleteDialogOpen(true);
  };

  /** Confirm deletion */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSale(deleteTarget.id);
      setSnackbar({ open: true, message: '删除成功', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '删除失败: ' + err.message, severity: 'error' });
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    loadSales();
  };

  return (
    <Box>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.700' }}>
          销售管理
        </Typography>

        {/* Tabs */}
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="销售管理" />
          <Tab label="项目关联统计" />
        </Tabs>

        {/* Tab 1: Sales Management */}
        {tabIndex === 0 && (
          <>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                共 {sales.length} 人
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAdd}
              >
                新增销售
              </Button>
            </Box>

            {/* Sales Table */}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'primary.50' }}>
                    <TableCell sx={{ fontWeight: 600, width: 60 }}>序号</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>姓名</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 120 }}>部门</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 140 }}>电话</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>备注</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 100 }} align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        暂无数据，点击"新增销售"添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale, idx) => (
                      <TableRow key={sale.id} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {sale.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sale.department || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sale.phone || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sale.notes || '-'}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="编辑">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleEdit(sale)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="删除">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(sale)}
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
          </>
        )}

        {/* Tab 2: Project Association Stats */}
        {tabIndex === 1 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                共 {stats.length} 人
              </Typography>
            </Box>

            {stats.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                暂无统计数据
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {stats.map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        borderColor: item.project_count > 0 ? 'primary.200' : 'divider',
                        transition: 'box-shadow 0.2s',
                        '&:hover': { boxShadow: 3 },
                      }}
                    >
                      <CardContent sx={{ pb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {item.name}
                          </Typography>
                          <Chip
                            label={`${item.project_count} 个项目`}
                            color={item.project_count > 0 ? 'primary' : 'default'}
                            size="small"
                            variant="filled"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {item.department || '-'}
                        </Typography>
                        {item.project_list && item.project_list.length > 0 ? (
                          <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                            {item.project_list.map((name, i) => (
                              <Typography key={i} component="li" variant="body2" sx={{ color: 'text.primary' }}>
                                {name}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                            暂无关联项目
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'add' ? '新增销售' : '编辑销售'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              label="姓名"
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
              label="部门"
              value={dialogForm.department}
              onChange={(e) => setDialogForm({ ...dialogForm, department: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="电话"
              value={dialogForm.phone}
              onChange={(e) => setDialogForm({ ...dialogForm, phone: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="备注"
              value={dialogForm.notes}
              onChange={(e) => setDialogForm({ ...dialogForm, notes: e.target.value })}
              fullWidth
              size="small"
              multiline
              rows={2}
            />
          </Box>
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
            确定要删除销售人员「{deleteTarget?.name}」吗？此操作不可撤销。
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
