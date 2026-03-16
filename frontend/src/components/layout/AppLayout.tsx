import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton,
  ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar, Menu,
  MenuItem, Badge, Tooltip, Select, SelectChangeEvent, useTheme, useMediaQuery,
  Popover, Paper, Chip, CircularProgress, alpha, InputBase,
} from '@mui/material';
import {
  Dashboard, Description, Warning, ReportProblem, BarChart,
  Build, People, Inventory, Chat, Edit, Assignment, Menu as MenuIcon,
  ChevronLeft, Notifications, Logout, Person, Language,
  ErrorOutline, WarningAmber, InfoOutlined, CheckCircleOutline,
  Gavel, FolderOpen, Science, Search as SearchIcon, Mail, AccountTree,
} from '@mui/icons-material';
import CommandPalette from '../common/CommandPalette';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../api/dashboard';

const DRAWER_WIDTH = 248;

// ── Types ──────────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  alertKey?: string;   // key in stats object for badge count
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── Role badge ─────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  qualiticien: 'Qualiticien',
  responsable_technique: 'Resp. Technique',
  biologiste: 'Biologiste',
  technicien: 'Technicien',
};

const ROLE_COLORS: Record<string, string> = {
  admin: '#7B1FA2',
  qualiticien: '#1565C0',
  responsable_technique: '#00695C',
  biologiste: '#2E7D32',
  technicien: '#BF360C',
};

// ── AppLayout ──────────────────────────────────────────────────────────────────
const AppLayout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: stats } = useQuery<any>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats().then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<any>({
    queryKey: ['dashboard', 'alerts'],
    queryFn: () => dashboardApi.getAlerts().then((r) => r.data),
    refetchInterval: 60000,
  });

  // ── Navigation grouped by section ──────────────────────────────────────────
  const navGroups: NavGroup[] = [
    {
      label: 'Vue générale',
      items: [
        { label: t('nav.dashboard'), path: '/dashboard', icon: <Dashboard /> },
      ],
    },
    {
      label: 'Qualité',
      items: [
        { label: t('nav.nonconformities'), path: '/nonconformities', icon: <ReportProblem />, alertKey: 'open_nc_count' },
        { label: t('nav.complaints'), path: '/complaints', icon: <Chat /> },
        { label: t('nav.audits'), path: '/audits', icon: <Gavel /> },
        { label: t('nav.risks'), path: '/risks', icon: <Warning /> },
        { label: t('nav.kpi'), path: '/kpi', icon: <BarChart /> },
      ],
    },
    {
      label: 'Documents',
      items: [
        { label: t('nav.documents'), path: '/documents', icon: <FolderOpen />, alertKey: 'pending_signatures' },
        { label: t('nav.redaction'), path: '/redaction', icon: <Edit /> },
        { label: 'Arborescence', path: '/services', icon: <AccountTree /> },
      ],
    },
    {
      label: 'Ressources',
      items: [
        { label: t('nav.equipment'), path: '/equipment', icon: <Build />, alertKey: 'overdue_calibrations' },
        { label: t('nav.hr'), path: '/hr', icon: <People /> },
        { label: t('nav.stock'), path: '/stock', icon: <Inventory /> },
      ],
    },
    {
      label: 'Communication',
      items: [
        { label: 'Messagerie', path: '/messagerie', icon: <Mail />, alertKey: 'unread_messages_count' },
      ],
    },
    {
      label: 'Administration',
      items: [
        { label: t('nav.auditTrail'), path: '/audit-trail', icon: <Assignment />, adminOnly: true },
      ],
    },
  ];

  const handleLanguageChange = (e: SelectChangeEvent) => {
    i18n.changeLanguage(e.target.value);
  };

  const totalNotifications = alertsData?.total || 0;

  const severityIcon = (sev: string) => {
    if (sev === 'error') return <ErrorOutline fontSize="small" color="error" />;
    if (sev === 'warning') return <WarningAmber fontSize="small" color="warning" />;
    if (sev === 'info') return <InfoOutlined fontSize="small" color="info" />;
    return <CheckCircleOutline fontSize="small" color="success" />;
  };

  const severityColor = (sev: string): 'error' | 'warning' | 'info' | 'default' => {
    if (sev === 'error') return 'error';
    if (sev === 'warning') return 'warning';
    if (sev === 'info') return 'info';
    return 'default';
  };

  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(path);

  const roleColor = ROLE_COLORS[user?.role ?? ''] ?? '#607D8B';
  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '';

  // ── Sidebar content ────────────────────────────────────────────────────────
  const drawerContent = (
    <Box display="flex" flexDirection="column" height="100%">
      {/* Logo */}
      <Toolbar
        sx={{
          background: `linear-gradient(135deg, #0779BF 0%, #0557A3 100%)`,
          color: 'white',
          minHeight: '64px !important',
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5} sx={{ overflow: 'hidden' }}>
          {/* Logo Cliniques de l'Europe — blanc sur fond bleu */}
          <Box
            component="img"
            src="https://www.cliniquesdeleurope.be/themes/custom/ceez_theme/logo.png"
            alt="Cliniques de l'Europe"
            sx={{
              height: 30,
              flexShrink: 0,
              filter: 'brightness(0) invert(1)',
              objectFit: 'contain',
            }}
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <Box minWidth={0}>
            <Typography
              variant="subtitle2"
              fontWeight={800}
              lineHeight={1.1}
              noWrap
              sx={{ fontSize: 12 }}
            >
              Cliniques de l'Europe
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 9.5, letterSpacing: '0.02em' }}>
              Labo. Biologie Clinique
            </Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton onClick={() => setMobileOpen(false)} sx={{ ml: 'auto', color: 'white' }}>
            <ChevronLeft />
          </IconButton>
        )}
      </Toolbar>

      {/* Nav groups */}
      <Box flex={1} overflow="auto" py={1}>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || hasRole('admin')
          );
          if (visibleItems.length === 0) return null;

          return (
            <Box key={group.label} mb={0.5}>
              <Box
                display="flex" alignItems="center" gap={1}
                sx={{ px: 2, py: 0.75 }}
              >
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.7px',
                    fontSize: '0.62rem', flexShrink: 0,
                  }}
                >
                  {group.label}
                </Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Box>
              <List dense disablePadding>
                {visibleItems.map((item) => {
                  const active = isActive(item.path);
                  const badgeCount = item.alertKey ? (stats?.[item.alertKey] ?? 0) : 0;

                  return (
                    <ListItem key={item.path} disablePadding sx={{ px: 1, py: 0.25 }}>
                      <ListItemButton
                        selected={active}
                        onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
                        sx={{
                          borderRadius: 1.5,
                          py: 0.75,
                          '&.Mui-selected': {
                            bgcolor: alpha('#0779BF', 0.09),
                            color: '#0779BF',
                            boxShadow: 'inset 3px 0 0 #0779BF',
                            '& .MuiListItemIcon-root': { color: '#0779BF' },
                            '& .MuiTypography-root': { fontWeight: 700 },
                            '&:hover': { bgcolor: alpha('#0779BF', 0.13) },
                          },
                          '&:hover': { bgcolor: alpha('#0779BF', 0.05) },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 34, color: active ? '#0779BF' : 'text.secondary' }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 600 : 400 }}
                        />
                        {badgeCount > 0 && (
                          <Chip
                            label={badgeCount > 99 ? '99+' : badgeCount}
                            size="small"
                            color="error"
                            sx={{ height: 18, fontSize: 10, fontWeight: 700, ml: 0.5 }}
                          />
                        )}
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          );
        })}
      </Box>

      {/* User profile at bottom of sidebar */}
      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            cursor: 'pointer', borderRadius: 2, p: 1.25,
            border: '1px solid', borderColor: 'divider',
            bgcolor: 'white',
            transition: 'all 0.15s',
            '&:hover': {
              bgcolor: alpha('#0779BF', 0.04),
              borderColor: alpha('#0779BF', 0.3),
              boxShadow: `0 2px 8px ${alpha('#0779BF', 0.1)}`,
            },
          }}
          onClick={(e) => setAnchorEl(e.currentTarget as HTMLElement)}
        >
          <Avatar
            sx={{
              width: 34, height: 34, fontSize: 12, fontWeight: 700,
              bgcolor: roleColor, flexShrink: 0,
              boxShadow: `0 2px 6px ${alpha(roleColor, 0.4)}`,
            }}
          >
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </Avatar>
          <Box flex={1} overflow="hidden">
            <Typography variant="body2" fontWeight={700} noWrap lineHeight={1.3}>
              {user?.prenom} {user?.nom}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{
                color: roleColor, fontWeight: 600,
                fontSize: '0.68rem',
                bgcolor: alpha(roleColor, 0.1),
                px: 0.75, py: 0.15, borderRadius: 1,
                display: 'inline-block', mt: 0.25,
              }}
            >
              {roleLabel}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          background: 'linear-gradient(135deg, #0779BF 0%, #0557A3 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
          )}

          {/* Current page breadcrumb */}
          <Typography variant="subtitle1" noWrap fontWeight={500} sx={{ opacity: 0.9, mr: 2 }}>
            {navGroups
              .flatMap(g => g.items)
              .find(item => isActive(item.path))?.label ?? 'Cliniques de l\'Europe'}
          </Typography>

          {/* Command Palette trigger */}
          <Box
            onClick={() => setCommandOpen(true)}
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              gap: 1,
              px: 1.5, py: 0.5,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.25)',
              bgcolor: 'rgba(255,255,255,0.08)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              mr: 'auto',
              minWidth: 180,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.4)',
              },
            }}
          >
            <SearchIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, flexGrow: 1 }}>
              Rechercher…
            </Typography>
            <Box
              component="kbd"
              sx={{
                px: 0.75, py: 0.25, borderRadius: 1,
                bgcolor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11, fontFamily: 'monospace',
                border: '1px solid rgba(255,255,255,0.2)',
                lineHeight: 1.4,
              }}
            >
              Ctrl K
            </Box>
          </Box>

          {/* Mobile search icon */}
          <Tooltip title="Recherche rapide (Ctrl+K)">
            <IconButton
              color="inherit"
              onClick={() => setCommandOpen(true)}
              sx={{ display: { xs: 'flex', sm: 'none' }, mr: 0.5 }}
            >
              <SearchIcon />
            </IconButton>
          </Tooltip>

          {/* Language */}
          <Select
            value={i18n.language.substring(0, 2)}
            onChange={handleLanguageChange}
            size="small"
            sx={{
              color: 'white', mr: 1,
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '& .MuiSelect-icon': { color: 'white' },
            }}
            startAdornment={<Language sx={{ mr: 0.5, fontSize: 18, color: 'white' }} />}
          >
            <MenuItem value="fr">FR</MenuItem>
            <MenuItem value="en">EN</MenuItem>
          </Select>

          {/* Notifications */}
          <Tooltip title={`${totalNotifications || 0} alertes actives`}>
            <IconButton color="inherit" onClick={(e) => setNotifAnchor(e.currentTarget)}>
              <Badge badgeContent={totalNotifications || undefined} color="error" max={99}>
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* User avatar (mobile) */}
          {isMobile && (
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 1 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: roleColor, fontSize: 13 }}>
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </Avatar>
            </IconButton>
          )}

          {/* Notifications Popover */}
          <Popover
            open={Boolean(notifAnchor)}
            anchorEl={notifAnchor}
            onClose={() => setNotifAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ elevation: 8, sx: { mt: 1 } }}
          >
            <Paper sx={{ width: 360, maxHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Box
                px={2} py={1.5}
                display="flex" justifyContent="space-between" alignItems="center"
                sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}
              >
                <Typography variant="subtitle1" fontWeight={700}>Alertes & Notifications</Typography>
                {totalNotifications > 0 && (
                  <Chip label={`${totalNotifications} active${totalNotifications > 1 ? 's' : ''}`}
                    size="small" color="error" />
                )}
              </Box>
              <Box overflow="auto" flex={1}>
                {alertsLoading ? (
                  <Box display="flex" justifyContent="center" p={3}>
                    <CircularProgress size={24} />
                  </Box>
                ) : !alertsData?.alerts?.length ? (
                  <Box display="flex" flexDirection="column" alignItems="center" p={4} gap={1}>
                    <CheckCircleOutline color="success" sx={{ fontSize: 48 }} />
                    <Typography color="text.secondary" variant="body2" fontWeight={500}>
                      Tout est en ordre !
                    </Typography>
                    <Typography color="text.disabled" variant="caption">
                      Aucune alerte active
                    </Typography>
                  </Box>
                ) : (
                  <List dense disablePadding>
                    {alertsData.alerts.map((alert: any, idx: number) => (
                      <ListItem key={idx} disablePadding divider={idx < alertsData.alerts.length - 1}>
                        <ListItemButton
                          onClick={() => { setNotifAnchor(null); navigate(alert.link); }}
                          sx={{ py: 1.5, gap: 0.5 }}
                        >
                          <ListItemIcon sx={{ minWidth: 34 }}>
                            {severityIcon(alert.severity)}
                          </ListItemIcon>
                          <ListItemText
                            primary={alert.message}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                          />
                          <Chip
                            label={alert.count}
                            size="small"
                            color={severityColor(alert.severity)}
                            sx={{ ml: 1, minWidth: 28, fontWeight: 700 }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Paper>
          </Popover>

          {/* User menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ elevation: 8, sx: { mt: 1, minWidth: 220 } }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box px={2} py={1.5} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Avatar sx={{ bgcolor: roleColor, width: 40, height: 40, fontSize: 15 }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {user?.prenom} {user?.nom}
                  </Typography>
                  <Chip
                    label={roleLabel}
                    size="small"
                    sx={{ bgcolor: alpha(roleColor, 0.12), color: roleColor, fontWeight: 600, fontSize: 10, height: 18 }}
                  />
                </Box>
              </Box>
            </Box>
            <MenuItem onClick={() => setAnchorEl(null)} sx={{ mt: 0.5 }}>
              <Person sx={{ mr: 1.5, color: 'text.secondary' }} fontSize="small" />
              <Typography variant="body2">Mon profil</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); logout(); }} sx={{ color: 'error.main' }}>
              <Logout sx={{ mr: 1.5 }} fontSize="small" />
              <Typography variant="body2">{t('auth.logout')}</Typography>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: '#FAFBFE' } }}
        >
          {drawerContent}
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
              borderRight: '1px solid #E5E7EB',
              bgcolor: '#FAFBFE',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          mt: 8,
          bgcolor: '#F5F6FA',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </Box>
  );
};

export default AppLayout;
