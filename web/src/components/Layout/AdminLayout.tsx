import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Key as KeyIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  ArrowBack as ArrowBackIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/auth.store';
import { ROUTE_PATHS } from '../../utils/constants';

const drawerWidth = 220;

const adminNavItems = [
  { path: ROUTE_PATHS.ADMIN_DASHBOARD, label: '概览', icon: <DashboardIcon /> },
  { path: ROUTE_PATHS.ADMIN_ACTIVATION, label: '激活码管理', icon: <KeyIcon /> },
  { path: ROUTE_PATHS.ADMIN_USERS, label: '用户管理', icon: <PeopleIcon /> },
  { path: ROUTE_PATHS.ADMIN_ORDERS, label: '订单管理', icon: <ReceiptIcon /> },
  { path: ROUTE_PATHS.ADMIN_SETTINGS, label: '系统配置', icon: <SettingsIcon /> },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { user } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleBackToUser = () => {
    handleClose();
    navigate(ROUTE_PATHS.DASHBOARD);
  };

  const handleLogout = () => {
    handleClose();
    logout();
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
          管理后台
        </Typography>
      </Toolbar>
      <Divider />

      <Box sx={{ flex: 1, py: 1 }}>
        {adminNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2.5,
                  py: 1.2,
                  mx: 1,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'primary.50' : 'transparent',
                  color: isActive ? 'primary.main' : 'text.primary',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'transform 160ms ease, background-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
                  boxShadow: isActive ? '0 8px 18px rgba(37, 99, 235, 0.10)' : 'none',
                  '&:hover': {
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    color: 'primary.main',
                    transform: 'translateX(3px)',
                  },
                }}
              >
                {item.icon}
                <Typography variant="body2">{item.label}</Typography>
              </Box>
            </Link>
          );
        })}
      </Box>

      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          管理员: {user?.nickname}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(!mobileOpen)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(14px)',
            },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderRightColor: 'rgba(148, 163, 184, 0.24)',
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(14px)',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box sx={{ flexGrow: 1, width: { md: `calc(100% - ${drawerWidth}px)` } }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid',
            borderBottomColor: 'rgba(148, 163, 184, 0.22)',
            color: 'text.primary',
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(!mobileOpen)}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={handleBackToUser} size="small" title="返回用户端">
                <ArrowBackIcon />
              </IconButton>
              <IconButton onClick={handleMenu} size="small">
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'error.main',
                    fontSize: 14,
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.16)',
                    '&:hover': { transform: 'scale(1.04)' },
                  }}
                >
                  {user?.nickname?.charAt(0) || 'A'}
                </Avatar>
              </IconButton>
            </Box>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={handleBackToUser}>
                <ListItemIcon>
                  <ArrowBackIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>返回用户端</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>退出登录</ListItemText>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box component="main" className="page-transition" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
