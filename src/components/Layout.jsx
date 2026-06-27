import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  useMediaQuery,
  useTheme,
  Drawer,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { useWorkContext } from '../context/WorkContext';
import Sidebar from './Sidebar';
import WorkForm from './WorkForm';
import WorkList from './WorkList';
import ProjectStats from './ProjectStats';
import TodoList from './TodoList';
import DictManager from './DictManager';
import ProjectManager from './ProjectManager';
import SalesManager from './SalesManager';
import AIAnalysis from './AIAnalysis';
import LLMProfiles from './LLMProfiles';
import PersonaManager from './PersonaManager';
import ProductCatalogManager from './ProductCatalogManager';
import ProductPlanManager from './ProductPlanManager';
import ProductReleaseManager from './ProductReleaseManager';
import ServiceCatalogManager from './ServiceCatalogManager';
import BacklogTracker from './BacklogTracker';
import OvertimeManager from './OvertimeManager';
import RiskManager from './RiskManager';
import ServerManager from './ServerManager';
import WbsManager from './WbsManager';
import PriorityCriteria from './PriorityCriteria';
import TypicalIssues from './TypicalIssues';
import CompatibilityManager from './CompatibilityManager';
import CompatFlow from './CompatFlow';
import ExpenseManager from './ExpenseManager';
import IssueTracker from './IssueTracker';
import ScriptManager from './ScriptManager';
import WorkTemplateManager from './WorkTemplateManager';
import LsnAnalyzer from './LsnAnalyzer';
import SysidAnalyzer from './SysidAnalyzer';
import ProjectConditionManager from './ProjectConditionManager';
import ErrorBoundary from './ErrorBoundary';

const DRAWER_WIDTH = 240;

/** Page component mapping */
const pages = {
  form: WorkForm,
  list: WorkList,
  stats: ProjectStats,
  todo: TodoList,
  backlog: BacklogTracker,
  overtime: OvertimeManager,
  dict: DictManager,
  project: ProjectManager,
  sales: SalesManager,
  compat: CompatibilityManager,
  compat_flow: CompatFlow,
  ai: AIAnalysis,
  llm: LLMProfiles,
  persona: PersonaManager,
  risk: RiskManager,
  wbs: WbsManager,
  server: ServerManager,
  priority: PriorityCriteria,
  issues: TypicalIssues,
  catalog: ProductCatalogManager,
  plan: ProductPlanManager,
  release: ProductReleaseManager,
  svc: ServiceCatalogManager,
  issue_tracker: IssueTracker,
  scripts: ScriptManager,
  work_templates: WorkTemplateManager,
  lsn: LsnAnalyzer,
  sysid: SysidAnalyzer,
  expense: ExpenseManager,
  condition: ProjectConditionManager,
};

/**
 * Main layout component with AppBar, Sidebar navigation, and content area.
 * Handles responsive drawer behavior (temporary on mobile, persistent on desktop).
 */
export default function Layout() {
  const { state } = useWorkContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const CurrentPage = pages[state.currentPage] || WorkForm;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 50%, #1e88e5 100%)',
          boxShadow: '0 2px 12px rgba(21, 101, 192, 0.35)',
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ fontWeight: 700, letterSpacing: 1, flexGrow: 1 }}
          >
            瀚高工作记录系统
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            技术支持工程师 — 邱臣君
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
        >
          <Sidebar onNavigate={handleDrawerToggle} />
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          <Sidebar />
        </Drawer>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          mt: 8,
          ml: { md: `${DRAWER_WIDTH}px` },
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: '#f5f7fa',
        }}
      >
        <ErrorBoundary name={state.currentPage}>
        <CurrentPage />
        </ErrorBoundary>
      </Box>
    </Box>
  );
}
