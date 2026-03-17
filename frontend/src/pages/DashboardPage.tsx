import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, FormControl,
  InputLabel, Select, MenuItem, Skeleton, Card, CardContent,
  CardActionArea, Button, Alert, Stack, Divider, Avatar,
  LinearProgress, Tooltip,
} from '@mui/material';
import {
  BarChart as BarChartRecharts, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, LineChart, Line, ResponsiveContainer, Cell,
} from 'recharts';
import {
  ReportProblem, Build, CheckCircle,
  Add, Chat, FolderOpen, Warning, Assignment, ArrowForward,
  Schedule, PriorityHigh, Inbox, EventBusy, Person,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import PageHeader from '../components/common/PageHeader';
import StatusChip from '../components/common/StatusChip';
import { useAuth } from '../hooks/useAuth';
import dayjs from 'dayjs';

// ── Role display ───────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  qualiticien: 'Qualiticien',
  responsable_technique: 'Responsable Technique',
  biologiste: 'Biologiste',
  technicien: 'Technicien',
};

// ── Task type config ───────────────────────────────────────────────────────────
const TASK_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  nc: { label: 'Non-conformité', color: '#C62828', icon: <ReportProblem fontSize="small" /> },
  plainte: { label: 'Plainte', color: '#6A1B9A', icon: <Chat fontSize="small" /> },
  action: { label: 'Action', color: '#E65100', icon: <Assignment fontSize="small" /> },
  document: { label: 'Document', color: '#1565C0', icon: <FolderOpen fontSize="small" /> },
};

// ── Quick action card ──────────────────────────────────────────────────────────
const QuickAction: React.FC<{
  label: string; icon: React.ReactNode;
  color: string; onClick: () => void;
}> = ({ label, icon, color, onClick }) => (
  <Card
    elevation={0}
    sx={{
      border: '1px solid',
      borderColor: 'divider',
      '&:hover': { borderColor: color, boxShadow: `0 4px 12px ${color}22` },
      transition: 'all 0.2s',
    }}
  >
    <CardActionArea onClick={onClick} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Avatar sx={{ bgcolor: `${color}18`, color, width: 40, height: 40 }}>
        {icon}
      </Avatar>
      <Typography variant="body2" fontWeight={600}>{label}</Typography>
    </CardActionArea>
  </Card>
);

// ── KPI Card clickable ─────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  title: string; value: number; icon: React.ReactNode;
  color: string; link: string; isLoading?: boolean;
  subtitle?: string; urgent?: boolean;
}> = ({ title, value, icon, color, link, isLoading, subtitle, urgent }) => {
  const navigate = useNavigate();

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: urgent && value > 0 ? color : 'divider',
        cursor: 'pointer',
        '&:hover': { borderColor: color, boxShadow: `0 4px 16px ${color}22`, transform: 'translateY(-2px)' },
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => navigate(link)}
    >
      {urgent && value > 0 && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: color }} />
      )}
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {isLoading ? (
          <Skeleton variant="rectangular" height={60} />
        ) : (
          <Box display="flex" alignItems="flex-start" justifyContent="space-between">
            <Box>
              <Typography variant="h3" fontWeight={800} color={value > 0 ? color : 'text.secondary'}>
                {value}
              </Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={500} mt={0.5}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.disabled">{subtitle}</Typography>
              )}
            </Box>
            <Avatar sx={{ bgcolor: `${color}15`, color, width: 44, height: 44 }}>
              {icon}
            </Avatar>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// ── My Tasks section ───────────────────────────────────────────────────────────
const MyTasksSection: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => dashboardApi.getMyTasks().then(r => r.data),
    refetchInterval: 120000,
  });

  const tasks: any[] = data?.tasks ?? [];
  const urgent = tasks.filter((t: any) => t.urgent);
  const normal = tasks.filter((t: any) => !t.urgent);

  if (isLoading) return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />;
  if (tasks.length === 0) return null;

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Typography variant="h6" fontWeight={700}>
            <Inbox sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            Mes tâches ({data?.total ?? 0})
          </Typography>
          <Stack direction="row" spacing={1}>
            {Object.entries(data?.by_type ?? {}).filter(([, v]) => (v as number) > 0).map(([type, count]) => (
              <Chip
                key={type}
                label={`${count} ${TASK_CONFIG[type]?.label}`}
                size="small"
                sx={{ bgcolor: `${TASK_CONFIG[type]?.color}15`, color: TASK_CONFIG[type]?.color, fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Box>

        {urgent.length > 0 && (
          <Alert severity="error" icon={<PriorityHigh />} sx={{ mb: 1.5, py: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>
              {urgent.length} tâche{urgent.length > 1 ? 's' : ''} urgente{urgent.length > 1 ? 's' : ''} (échéance dépassée)
            </Typography>
          </Alert>
        )}

        <Stack spacing={0.5}>
          {[...urgent, ...normal].slice(0, 6).map((task: any, i: number) => {
            const cfg = TASK_CONFIG[task.type] ?? {};
            return (
              <Box
                key={i}
                display="flex" alignItems="center" gap={1.5}
                sx={{
                  p: 1, borderRadius: 1, cursor: 'pointer',
                  border: '1px solid transparent',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
                }}
                onClick={() => navigate(task.link)}
              >
                <Avatar sx={{ width: 28, height: 28, bgcolor: `${cfg.color}15`, color: cfg.color }}>
                  {cfg.icon}
                </Avatar>
                <Box flex={1} overflow="hidden">
                  <Typography variant="body2" noWrap fontWeight={task.urgent ? 600 : 400}>
                    {task.titre}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <StatusChip status={task.statut} />
                    {task.echeance && (
                      <Typography variant="caption" color={task.urgent ? 'error.main' : 'text.secondary'}>
                        <Schedule sx={{ fontSize: 10, mr: 0.25, verticalAlign: 'middle' }} />
                        {dayjs(task.echeance).format('DD/MM/YYYY')}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                {task.urgent && <Chip label="Urgent" size="small" color="error" />}
                <ArrowForward fontSize="small" sx={{ color: 'text.disabled' }} />
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState('6');

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ['dashboard', 'stats', period],
    queryFn: () => dashboardApi.getStats({ months: period }).then((r) => r.data),
    staleTime: 60000,
  });

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonjour' : 'Bonsoir';
  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '';

  // NC trend colors for chart
  const ncMonthData = (stats?.nc_by_month || []).map((d: any, i: number, arr: any[]) => ({
    ...d,
    trend: i > 0 ? (d.count > arr[i - 1].count ? 'up' : 'down') : 'flat',
  }));

  return (
    <Box>
      <PageHeader
        title={`${greeting}, ${user?.prenom || ''} !`}
        subtitle={`${roleLabel} — ${dayjs().format('dddd D MMMM YYYY')}`}
        breadcrumbs={[{ label: t('dashboard.title') }]}
      />

      {/* ── Quick actions row ──────────────────────────────────────────────── */}
      <Box mb={3}>
        <Typography variant="overline" color="text.secondary" fontWeight={600}>
          Actions rapides
        </Typography>
        <Grid container spacing={1.5} mt={0.5}>
          {[
            { label: 'Déclarer une NC', icon: <Add />, color: '#C62828', link: '/nonconformities/new' },
            { label: 'Signaler une plainte', icon: <Chat />, color: '#6A1B9A', link: '/complaints/new' },
            { label: 'Nouveau document', icon: <FolderOpen />, color: '#1565C0', link: '/documents/new' },
            { label: 'Ajouter un risque', icon: <Warning />, color: '#E65100', link: '/risks/new' },
          ].map((qa) => (
            <Grid item xs={6} sm={3} key={qa.label}>
              <QuickAction {...qa} onClick={() => navigate(qa.link)} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* ── My tasks ─────────────────────────────────────────────────────────── */}
      <Box mb={3}>
        <MyTasksSection />
      </Box>

      {/* ── KPI period filter ─────────────────────────────────────────────── */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="overline" color="text.secondary" fontWeight={600}>
          Indicateurs — laboratoire
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('common.period')}</InputLabel>
          <Select value={period} label={t('common.period')} onChange={(e) => setPeriod(String(e.target.value))}>
            <MenuItem value="3">3 mois</MenuItem>
            <MenuItem value="6">6 mois</MenuItem>
            <MenuItem value="12">12 mois</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={2.5}>
        {/* ── KPI Cards ── */}
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="NC ouvertes" value={stats?.open_nc_count ?? 0}
            icon={<ReportProblem />} color="#C62828" link="/nonconformities"
            isLoading={isLoading} urgent />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Plaintes actives" value={stats?.open_complaints ?? 0}
            icon={<Chat />} color="#6A1B9A" link="/complaints"
            isLoading={isLoading} urgent />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Calibrations en retard" value={stats?.overdue_calibrations ?? 0}
            icon={<Build />} color="#BF360C" link="/equipment"
            isLoading={isLoading} urgent />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Actions en retard" value={stats?.overdue_actions ?? 0}
            icon={<Schedule />} color="#E65100" link="/nonconformities"
            isLoading={isLoading} urgent />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Documents à valider" value={stats?.pending_docs ?? 0}
            icon={<CheckCircle />} color="#1565C0" link="/documents"
            isLoading={isLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Risques critiques" value={stats?.critical_risks ?? 0}
            icon={<Warning />} color="#F57F17" link="/risks"
            isLoading={isLoading} urgent />
        </Grid>

        {/* ── NC trend chart ── */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" fontWeight={700}>Évolution des non-conformités</Typography>
              <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/nonconformities')}>
                Voir tout
              </Button>
            </Box>
            {isLoading ? (
              <Skeleton variant="rectangular" height={240} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={ncMonthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Line
                    type="monotone" dataKey="count" stroke="#C62828" name="NC"
                    strokeWidth={2.5} dot={{ r: 4, fill: '#C62828' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* ── NC by type chart ── */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Typography variant="h6" fontWeight={700} mb={2}>NC par type</Typography>
            {isLoading ? (
              <Skeleton variant="rectangular" height={240} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChartRecharts data={stats?.nc_by_type || []} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={80} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#1565C0" name="NC" radius={[0, 4, 4, 0]}>
                    {(stats?.nc_by_type || []).map((_: any, idx: number) => (
                      <Cell key={idx} fill={['#1565C0', '#C62828', '#2E7D32', '#F57F17', '#6A1B9A'][idx % 5]} />
                    ))}
                  </Bar>
                </BarChartRecharts>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* ── Equipment overdue ── */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography variant="h6" fontWeight={700}>
                <Build sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20, color: '#BF360C' }} />
                Calibrations en retard
              </Typography>
              <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/equipment')}>
                Équipements
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: 12 } }}>
                    <TableCell>Équipement</TableCell>
                    <TableCell>Calibration prévue</TableCell>
                    <TableCell align="center">Retard</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading
                    ? Array(4).fill(0).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={3}><Skeleton /></TableCell></TableRow>
                      ))
                    : (stats?.overdue_equipment_list || []).slice(0, 5).map((eq: any) => (
                        <TableRow
                          key={eq.id} hover sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/equipment/${eq.id}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{eq.nom}</Typography>
                            <Typography variant="caption" color="text.secondary">{eq.numero_inventaire}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="error.main">
                              {eq.prochaine_calibration
                                ? dayjs(eq.prochaine_calibration).format('DD/MM/YYYY')
                                : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${eq.jours_retard}j`}
                              size="small"
                              color={eq.jours_retard > 30 ? 'error' : 'warning'}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  {!isLoading && (stats?.overdue_equipment_list || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Box py={2}>
                          <CheckCircle color="success" sx={{ fontSize: 32, mb: 0.5, display: 'block', mx: 'auto' }} />
                          <Typography variant="body2" color="text.secondary">Toutes les calibrations sont à jour</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* ── Documents to review ── */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography variant="h6" fontWeight={700}>
                <FolderOpen sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20, color: '#1565C0' }} />
                Documents à valider
              </Typography>
              <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/documents')}>
                Documents
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: 12 } }}>
                    <TableCell>Titre</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="center">Version</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading
                    ? Array(4).fill(0).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={3}><Skeleton /></TableCell></TableRow>
                      ))
                    : (stats?.docs_to_review || []).slice(0, 5).map((doc: any) => (
                        <TableRow
                          key={doc.id} hover sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/documents/${doc.id}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 200 }}>
                              {doc.titre}
                            </Typography>
                          </TableCell>
                          <TableCell><StatusChip status={doc.statut} /></TableCell>
                          <TableCell align="center">
                            <Chip label={`v${doc.version}`} size="small" color="primary" />
                          </TableCell>
                        </TableRow>
                      ))}
                  {!isLoading && (stats?.docs_to_review || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Box py={2}>
                          <CheckCircle color="success" sx={{ fontSize: 32, mb: 0.5, display: 'block', mx: 'auto' }} />
                          <Typography variant="body2" color="text.secondary">Aucun document en attente</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* ── NC par responsable ── */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" fontWeight={700}>
                <Person sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20, color: '#C62828' }} />
                NC ouvertes par responsable
              </Typography>
              <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/nonconformities')}>
                Voir tout
              </Button>
            </Box>
            {isLoading ? (
              <Skeleton variant="rectangular" height={180} />
            ) : !(stats?.nc_by_responsible || []).length ? (
              <Box py={3} textAlign="center">
                <CheckCircle color="success" sx={{ fontSize: 32, mb: 0.5 }} />
                <Typography variant="body2" color="text.secondary">Aucune NC ouverte</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, (stats.nc_by_responsible.length) * 36)}>
                <BarChartRecharts
                  data={stats.nc_by_responsible}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                  <RechartsTooltip formatter={(v: number) => [v, 'NC ouvertes']} />
                  <Bar dataKey="count" fill="#C62828" radius={[0, 4, 4, 0]} name="NC ouvertes" />
                </BarChartRecharts>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* ── Documents expirant dans 30j ── */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography variant="h6" fontWeight={700}>
                <EventBusy sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20, color: '#E65100' }} />
                Documents expirant dans 30 jours
              </Typography>
              <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/documents')}>
                Documents
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: 12 } }}>
                    <TableCell>Titre</TableCell>
                    <TableCell align="center">Validité</TableCell>
                    <TableCell align="center">Jours restants</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading
                    ? Array(4).fill(0).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={3}><Skeleton /></TableCell></TableRow>
                      ))
                    : (stats?.docs_expiring_soon || []).map((doc: any) => (
                        <TableRow
                          key={doc.id} hover sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/documents/${doc.id}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 240 }}>
                              {doc.titre}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" color={doc.jours_restants <= 7 ? 'error.main' : 'warning.main'} fontWeight={600}>
                              {dayjs(doc.date_validite).format('DD/MM/YYYY')}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${doc.jours_restants}j`}
                              size="small"
                              color={doc.jours_restants <= 7 ? 'error' : 'warning'}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  {!isLoading && (stats?.docs_expiring_soon || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Box py={2}>
                          <CheckCircle color="success" sx={{ fontSize: 32, mb: 0.5, display: 'block', mx: 'auto' }} />
                          <Typography variant="body2" color="text.secondary">Aucun document n'expire dans les 30 prochains jours</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* ── Ongoing actions ── */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography variant="h6" fontWeight={700}>
                <Assignment sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20, color: '#E65100' }} />
                Actions en cours
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: 12 } }}>
                    <TableCell>Description</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Échéance</TableCell>
                    <TableCell>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading
                    ? Array(4).fill(0).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={4}><Skeleton /></TableCell></TableRow>
                      ))
                    : (stats?.ongoing_actions || []).map((action: any) => (
                        <TableRow key={action.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 300 }} noWrap>
                              {action.description}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={action.type_action || '-'} size="small" />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              color={action.en_retard ? 'error.main' : 'text.primary'}
                              fontWeight={action.en_retard ? 700 : 400}
                            >
                              {dayjs(action.echeance).format('DD/MM/YYYY')}
                              {action.en_retard && ' ⚠️'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={action.statut}
                              size="small"
                              color={action.en_retard ? 'error' : 'default'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  {!isLoading && (stats?.ongoing_actions || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Box py={2}>
                          <CheckCircle color="success" sx={{ fontSize: 32, mb: 0.5, display: 'block', mx: 'auto' }} />
                          <Typography variant="body2" color="text.secondary">Aucune action en cours</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
