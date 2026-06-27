import { useState, useEffect } from 'react';
import {
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Divider, Box, Typography, Collapse,
} from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ListAltIcon from '@mui/icons-material/ListAlt';
import BarChartIcon from '@mui/icons-material/BarChart';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SettingsIcon from '@mui/icons-material/Settings';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PersonIcon from '@mui/icons-material/Person';
import CategoryIcon from '@mui/icons-material/Category';
import TuneIcon from '@mui/icons-material/Tune';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import StorefrontIcon from '@mui/icons-material/Storefront';
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VerifiedIcon from '@mui/icons-material/Verified';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import DnsIcon from '@mui/icons-material/Dns';
import RuleIcon from '@mui/icons-material/Rule';
import BugReportIcon from '@mui/icons-material/BugReport';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import DescriptionIcon from '@mui/icons-material/Description';
import CalculateIcon from '@mui/icons-material/Calculate';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useWorkContext } from '../context/WorkContext';
import { getDefaultProfile } from '../db/settings';

const navItems = [
  { key: 'form', label: '录入工作', icon: <EditNoteIcon /> },
  { key: 'list', label: '工作记录列表', icon: <ListAltIcon /> },
  { key: 'stats', label: '项目工时统计', icon: <BarChartIcon /> },
  { key: 'todo', label: '待办事项', icon: <AssignmentIcon /> },
  { key: 'backlog', label: '工作积压', icon: <WarningAmberIcon /> },
  { key: 'overtime', label: '加班记录', icon: <AccessTimeIcon /> },
  { key: 'ai', label: 'AI 智能分析', icon: <AutoAwesomeIcon /> },
  { key: 'expense', label: '财务报销', icon: <AccountBalanceWalletIcon /> },
  { key: 'issue_tracker', label: '问题记录', icon: <BugReportIcon /> },
];

const dictChildren = [
  { key: 'dict', label: '常规字典', icon: <SettingsIcon /> },
  { key: 'priority', label: '优先级准则', icon: <RuleIcon /> },
  { key: 'issues', label: '典型案例库', icon: <BugReportIcon /> },
  { key: 'llm', label: 'LLM 模型管理', icon: <PsychologyIcon /> },
  { key: 'scripts', label: '话术库', icon: <RecordVoiceOverIcon /> },
];

const productServiceChildren = [
  { key: 'compat', label: '兼容证明', icon: <VerifiedIcon /> },
  { key: 'compat_flow', label: '兼容流程', icon: <AccountTreeIcon /> },
  { key: 'plan', label: '产品规划', icon: <TuneIcon /> },
  { key: 'release', label: '产品超市', icon: <StorefrontIcon /> },
  { key: 'catalog', label: '产品目录', icon: <CategoryIcon /> },
  { key: 'svc', label: '服务目录', icon: <MiscellaneousServicesIcon /> },
];

const projectChildren = [
  { key: 'project', label: '项目信息', icon: <BusinessIcon /> },
  { key: 'sales', label: '销售人员', icon: <PeopleIcon /> },
  { key: 'persona', label: '用户画像', icon: <PersonIcon /> },
  { key: 'risk', label: '风险管理', icon: <WarningAmberIcon /> },
  { key: 'wbs', label: '里程碑管理', icon: <AccountTreeIcon /> },
  { key: 'server', label: '服务器管理', icon: <DnsIcon /> },
  { key: 'work_templates', label: '工作模板', icon: <DescriptionIcon /> },
  { key: 'condition', label: '状态达成条件', icon: <CheckCircleIcon /> },
];

const toolChildren = [
  { key: 'lsn', label: 'LSN 分析', icon: <CalculateIcon /> },
  { key: 'sysid', label: '系统标识符分析', icon: <FingerprintIcon /> },
];

const adminItems = [
  { key: 'project_mgmt', label: '项目管理', icon: <AccountTreeIcon />, children: projectChildren },
  { key: 'product_service', label: '产品服务', icon: <ViewInArIcon />, children: productServiceChildren },
  { key: 'tool', label: '实用工具', icon: <BuildIcon />, children: toolChildren },
  { key: 'dict', label: '字典维护', icon: <SettingsIcon />, children: dictChildren },
];

export default function Sidebar({ onNavigate }) {
  const { state, setPage } = useWorkContext();
  const [expanded, setExpanded] = useState({});
  const [defaultModel, setDefaultModel] = useState('');

  useEffect(() => {
    const fetchDefault = async () => {
      try {
        const d = await getDefaultProfile();
        if (d?.name) setDefaultModel(`${d.name} (${d.model})`);
      } catch { /* */ }
    };
    fetchDefault();
    window.addEventListener('defaultProfileChanged', fetchDefault);
    return () => window.removeEventListener('defaultProfileChanged', fetchDefault);
  }, []);

  const handleClick = (key) => {
    setPage(key);
    if (onNavigate) onNavigate();
  };

  const toggleExpand = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNavItem = (item, depth = 0) => {
    const isActive = state.currentPage === item.key;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expanded[item.key];

    if (hasChildren) {
      return (
        <Box key={item.key}>
          <ListItem disablePadding sx={{ px: 1, mb: 0.5 }}>
            <ListItemButton
              onClick={() => toggleExpand(item.key)}
              sx={{
                borderRadius: 2,
                color: 'text.primary',
                '&:hover': { backgroundColor: 'action.hover' },
                '& .MuiListItemIcon-root': { color: 'action.active' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600, fontSize: '0.85rem' }} />
              {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </ListItemButton>
          </ListItem>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List disablePadding>
              {item.children.map(child => {
                const childActive = state.currentPage === child.key;
                return (
                  <ListItem key={child.key} disablePadding sx={{ pl: 2, pr: 1, mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => handleClick(child.key)}
                      sx={{
                        borderRadius: 2,
                        backgroundColor: childActive ? 'primary.50' : 'transparent',
                        color: childActive ? 'primary.700' : 'text.secondary',
                        '&:hover': {
                          backgroundColor: childActive ? 'primary.100' : 'action.hover',
                        },
                        '& .MuiListItemIcon-root': {
                          color: childActive ? 'primary.700' : 'action.active',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, fontSize: '1.2rem' }}>{child.icon}</ListItemIcon>
                      <ListItemText
                        primary={child.label}
                        primaryTypographyProps={{
                          fontWeight: childActive ? 600 : 400,
                          fontSize: '0.82rem',
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Collapse>
        </Box>
      );
    }

    return (
      <ListItem key={item.key} disablePadding sx={{ px: 1, mb: 0.5 }}>
        <ListItemButton
          onClick={() => handleClick(item.key)}
          sx={{
            borderRadius: 2,
            backgroundColor: isActive ? 'primary.50' : 'transparent',
            color: isActive ? 'primary.700' : 'text.primary',
            '&:hover': {
              backgroundColor: isActive ? 'primary.100' : 'action.hover',
            },
            '& .MuiListItemIcon-root': {
              color: isActive ? 'primary.700' : 'action.active',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.9rem',
            }}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Box>
      <Toolbar
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)', color: '#fff',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          功能导航
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ pt: 1 }}>
        {navItems.map(item => renderNavItem(item))}
      </List>
      <Divider sx={{ mt: 1 }} />
      <List sx={{ pt: 1 }}>
        {adminItems.map(item => renderNavItem(item))}
      </List>
      <Divider sx={{ mt: 2 }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          记录总数：{state.records.length} 条
        </Typography>
        {defaultModel && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <SmartToyIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">
              {defaultModel}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
