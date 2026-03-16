import React from 'react';
import {
  Card, CardContent, CardHeader, List, ListItem, ListItemIcon,
  ListItemText, Chip, Typography, Box, Divider,
} from '@mui/material';
import { ReportProblem, Build, Description, Inventory, Timer } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { DashboardData } from '../../types';

interface Props { stats?: DashboardData; }

const AlertsPanel: React.FC<Props> = ({ stats: _stats }) => {
  const stats = _stats as any;
  const { t } = useTranslation();

  const alerts = [
    {
      icon: <ReportProblem color="error" />,
      label: t('dashboard.openNC'),
      count: stats?.open_nc_count || 0,
      color: 'error' as const,
    },
    {
      icon: <Build color="warning" />,
      label: t('dashboard.overdueCalibrations'),
      count: stats?.overdue_calibrations || 0,
      color: 'warning' as const,
    },
    {
      icon: <Description color="info" />,
      label: t('dashboard.pendingSignatures'),
      count: stats?.pending_signatures || 0,
      color: 'info' as const,
    },
    {
      icon: <Inventory color="warning" />,
      label: t('dashboard.quarantineLots'),
      count: stats?.quarantine_lots || 0,
      color: 'warning' as const,
    },
    {
      icon: <Timer color="error" />,
      label: t('dashboard.overdueActions'),
      count: stats?.overdue_actions || 0,
      color: 'error' as const,
    },
  ];

  const totalAlerts = alerts.reduce((sum, a) => sum + a.count, 0);

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title={t('dashboard.alerts')}
        action={
          totalAlerts > 0 ? (
            <Chip label={totalAlerts} color="error" size="small" />
          ) : null
        }
      />
      <Divider />
      <CardContent sx={{ p: 0 }}>
        {totalAlerts === 0 ? (
          <Box p={3} textAlign="center">
            <Typography color="success.main">{t('dashboard.noAlerts')}</Typography>
          </Box>
        ) : (
          <List dense>
            {alerts.map((alert, idx) => (
              <ListItem key={idx} sx={{ py: 1 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>{alert.icon}</ListItemIcon>
                <ListItemText primary={alert.label} />
                {alert.count > 0 && (
                  <Chip label={alert.count} color={alert.color} size="small" />
                )}
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default AlertsPanel;
