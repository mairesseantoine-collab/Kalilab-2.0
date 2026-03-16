import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Paper, Typography, Tooltip, Skeleton, Alert, Button,
  Chip, alpha, useTheme, Stack, Divider, LinearProgress, Badge,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add, Shield, ShieldOutlined, CheckCircle, ErrorOutline,
  WarningAmber, Block, TrendingUp, Search, Info,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { risksApi } from '../../api/risks';
import PageHeader from '../../components/common/PageHeader';
import { RiskLevel } from '../../types';
import dayjs from 'dayjs';

// ── AMDEC scoring legend ───────────────────────────────────────────────────────
// Based on Capillarys.xlsx methodology:
//   Gravité (G)      = impact  axis (1-5)
//   Fréquence (F)    = probabilite axis (1-5)
//   Score IPR        = G × F  (1-25)
//   ≤ 4  → Faible (négligeable)
//   ≤ 9  → Modéré (acceptable)
//   ≤ 16 → Élevé  (à surveiller)
//   > 16 → Critique (intolérable — plan d'action urgent)

const RISK_COLORS: Record<RiskLevel, string> = {
  faible:   '#10b981',
  modere:   '#f59e0b',
  eleve:    '#f97316',
  critique: '#ef4444',
};

const RISK_BG: Record<RiskLevel, string> = {
  faible:   '#ecfdf5',
  modere:   '#fffbeb',
  eleve:    '#fff7ed',
  critique: '#fef2f2',
};

const LEVEL_LABELS: Record<RiskLevel, string> = {
  faible:   'Faible',
  modere:   'Modéré',
  eleve:    'Élevé',
  critique: 'Critique',
};

const DECISION_MAP: Record<RiskLevel, { label: string; color: string; icon: React.ReactNode }> = {
  faible:   { label: 'Accepter / Maintenir', color: '#10b981', icon: <CheckCircle sx={{ fontSize: 13 }} /> },
  modere:   { label: 'À surveiller',          color: '#f59e0b', icon: <Info sx={{ fontSize: 13 }} /> },
  eleve:    { label: 'Plan d\'action',         color: '#f97316', icon: <WarningAmber sx={{ fontSize: 13 }} /> },
  critique: { label: 'Action urgente',         color: '#ef4444', icon: <ErrorOutline sx={{ fontSize: 13 }} /> },
};

// AMDEC matrix color by score (1–25)
const MATRIX_BG = (score: number): string => {
  if (score <= 4)  return '#bbf7d0';  // faible
  if (score <= 9)  return '#fef08a';  // modere
  if (score <= 16) return '#fed7aa';  // eleve
  return '#fecaca';                    // critique
};
const MATRIX_BORDER = (score: number): string => {
  if (score <= 4)  return '#6ee7b7';
  if (score <= 9)  return '#fde047';
  if (score <= 16) return '#fdba74';
  return '#fca5a5';
};

// Gravity axis labels (1-5)
const G_LABELS = ['Très faible', 'Faible', 'Moyenne', 'Élevée', 'Critique'];
const F_LABELS = ['Très rare', 'Rare', 'Occasionnel', 'Fréquent', 'Très fréquent'];

const LEVEL_CONFIG = (['faible', 'modere', 'eleve', 'critique'] as RiskLevel[]);

const STATUT_LABELS: Record<string, string> = {
  ouvert:  'Ouvert',
  traite:  'Traité',
  accepte: 'Accepté',
  surveille: 'Surveillé',
  clos:    'Clos',
};

const RisksPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [criticiteFilter, setCriticiteFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ['risks', criticiteFilter, page, pageSize],
    queryFn: () =>
      risksApi.list({ criticite: criticiteFilter || undefined, skip: page * pageSize, limit: pageSize })
        .then((r) => r.data),
  });

  const { data: allData } = useQuery({
    queryKey: ['risks-all'],
    queryFn: () => risksApi.list({ skip: 0, limit: 200 }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });
  const allRisks: any[] = allData?.items ?? [];

  const levelCounts = Object.fromEntries(
    LEVEL_CONFIG.map(l => [l, allRisks.filter(r => r.criticite === l).length])
  );
  const critiqueRisks = allRisks.filter(r => r.criticite === 'critique');

  // Build 5×5 AMDEC matrix  (rows = Fréquence 1→5, cols = Gravité 1→5)
  const matrix = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => {
      const score = (r + 1) * (c + 1);
      const count = allRisks.filter(
        (risk) => risk.probabilite === r + 1 && risk.impact === c + 1
      ).length;
      return { score, count, freq: r + 1, grav: c + 1 };
    })
  );

  const columns: GridColDef[] = [
    {
      field: 'description',
      headerName: 'Description du risque',
      flex: 2,
      minWidth: 220,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title={params.value} enterDelay={400}>
          <Box>
            <Typography variant="body2" noWrap sx={{ maxWidth: 320 }}>{params.value}</Typography>
            {params.row.controles && (
              <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>
                🛡 {String(params.row.controles).substring(0, 60)}{params.row.controles.length > 60 ? '…' : ''}
              </Typography>
            )}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'score_risque',
      headerName: 'IPR (G×F)',
      width: 90,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => {
        const score = params.value as number;
        const g = params.row.impact ?? 0;
        const f = params.row.probabilite ?? 0;
        const color =
          score <= 4 ? RISK_COLORS.faible
          : score <= 9 ? RISK_COLORS.modere
          : score <= 16 ? RISK_COLORS.eleve
          : RISK_COLORS.critique;
        return (
          <Tooltip title={`Gravité ${g} × Fréquence ${f} = ${score}`}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '50%',
                bgcolor: color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13, cursor: 'help',
              }}
            >
              {score}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'criticite',
      headerName: 'Niveau',
      width: 110,
      renderCell: (params: GridRenderCellParams) => {
        const level = params.value as RiskLevel;
        return (
          <Chip
            label={LEVEL_LABELS[level] ?? level}
            size="small"
            sx={{
              bgcolor: RISK_BG[level],
              color: RISK_COLORS[level],
              fontWeight: 700,
              border: `1px solid ${alpha(RISK_COLORS[level], 0.4)}`,
              fontSize: 11,
            }}
          />
        );
      },
    },
    {
      field: 'decision',
      headerName: 'Décision',
      width: 160,
      valueGetter: (params: { row: { criticite: RiskLevel } }) => params.row.criticite,
      renderCell: (params: GridRenderCellParams) => {
        const level = params.row.criticite as RiskLevel;
        const dec = DECISION_MAP[level];
        if (!dec) return null;
        return (
          <Box display="flex" alignItems="center" gap={0.5} sx={{ color: dec.color }}>
            {dec.icon}
            <Typography variant="caption" fontWeight={600} color={dec.color}>
              {dec.label}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'controles',
      headerName: 'Barrières',
      width: 90,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <Tooltip title={params.value}>
            <Chip
              label="Oui"
              size="small"
              icon={<Shield sx={{ fontSize: 12 }} />}
              sx={{ bgcolor: '#ecfdf5', color: '#10b981', border: '1px solid #6ee7b7', fontWeight: 600, fontSize: 10 }}
            />
          </Tooltip>
        ) : (
          <Chip
            label="Non"
            size="small"
            icon={<ShieldOutlined sx={{ fontSize: 12 }} />}
            sx={{ fontSize: 10, color: 'text.disabled' }}
            variant="outlined"
          />
        )
      ),
    },
    {
      field: 'plan_action',
      headerName: 'Plan',
      width: 70,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <Tooltip title={params.value}>
            <CheckCircle sx={{ fontSize: 18, color: '#10b981' }} />
          </Tooltip>
        ) : (
          <Block sx={{ fontSize: 18, color: 'text.disabled' }} />
        )
      ),
    },
    {
      field: 'statut',
      headerName: 'Statut',
      width: 110,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={STATUT_LABELS[params.value] ?? params.value}
          size="small"
          variant="outlined"
          sx={{ fontSize: 11 }}
        />
      ),
    },
    {
      field: 'echeance',
      headerName: 'Échéance',
      width: 110,
      renderCell: (params: GridRenderCellParams) => {
        if (!params.value) return <Typography variant="body2" color="text.disabled">—</Typography>;
        const overdue = dayjs(params.value as string).isBefore(dayjs());
        return (
          <Typography
            variant="body2"
            color={overdue ? 'error.main' : 'text.primary'}
            fontWeight={overdue ? 700 : 400}
          >
            {dayjs(params.value as string).format('DD/MM/YYYY')}
          </Typography>
        );
      },
    },
  ];

  if (error) return <Alert severity="error">Erreur de chargement des risques</Alert>;

  return (
    <Box>
      <PageHeader
        title="Gestion des risques (AMDEC)"
        breadcrumbs={[{ label: 'Risques' }]}
        action={{ label: 'Nouveau risque', onClick: () => navigate('/risks/new'), icon: <Add /> }}
      />

      {/* Critical alert banner */}
      {critiqueRisks.length > 0 && (
        <Alert
          severity="error"
          icon={<ErrorOutline />}
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button
              color="error"
              size="small"
              variant="outlined"
              onClick={() => setCriticiteFilter(criticiteFilter === 'critique' ? '' : 'critique')}
            >
              {criticiteFilter === 'critique' ? 'Tout voir' : 'Filtrer'}
            </Button>
          }
        >
          <strong>{critiqueRisks.length} risque{critiqueRisks.length > 1 ? 's critiques' : ' critique'}</strong>{' '}
          nécessitent un plan d'action urgent (IPR ≥ 17).
        </Alert>
      )}

      {/* Level filter cards */}
      <Grid container spacing={1.5} mb={2.5}>
        {LEVEL_CONFIG.map((level) => {
          const active = criticiteFilter === level;
          const count = levelCounts[level] ?? 0;
          const color = RISK_COLORS[level];
          const dec = DECISION_MAP[level];
          const pct = allRisks.length > 0 ? (count / allRisks.length) * 100 : 0;

          return (
            <Grid item xs={6} sm={3} key={level}>
              <Paper
                onClick={() => { setCriticiteFilter(active ? '' : level); setPage(0); }}
                elevation={active ? 3 : 1}
                sx={{
                  p: 1.5, cursor: 'pointer', borderRadius: 2,
                  border: active ? `2px solid ${color}` : '2px solid transparent',
                  bgcolor: active ? alpha(color, 0.06) : 'background.paper',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: alpha(color, 0.08) },
                }}
              >
                <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                  <Box
                    sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      bgcolor: active ? color : alpha(color, 0.12),
                      color: active ? '#fff' : color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 15, flexShrink: 0,
                    }}
                  >
                    {count}
                  </Box>
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight={700} color={active ? color : 'text.primary'}>
                      {LEVEL_LABELS[level]}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={0.5} sx={{ color: dec.color }}>
                      {dec.icon}
                      <Typography variant="caption" color={dec.color} lineHeight={1}>
                        {dec.label}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 4, borderRadius: 2,
                    bgcolor: alpha(color, 0.12),
                    '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
                  }}
                />
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25, textAlign: 'right' }}>
                  {pct.toFixed(0)}%
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={3}>
        {/* ── DataGrid ─────────────────────────────────────────────────────── */}
        <Grid item xs={12} lg={8}>
          {isLoading ? (
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
          ) : (
            <Paper sx={{ borderRadius: 2 }}>
              <DataGrid
                rows={data?.items || []}
                columns={columns}
                rowCount={data?.total || 0}
                paginationMode="server"
                paginationModel={{ page, pageSize }}
                onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize); }}
                pageSizeOptions={[10, 20, 50]}
                autoHeight
                disableRowSelectionOnClick
                onRowClick={(p) => navigate(`/risks/${p.row.id}`)}
                rowHeight={52}
                sx={{
                  border: 0,
                  '& .MuiDataGrid-row': { cursor: 'pointer' },
                  '& .MuiDataGrid-row:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                  '& .MuiDataGrid-columnHeaders': {
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    borderRadius: 0,
                  },
                }}
                localeText={{
                  noRowsLabel: criticiteFilter
                    ? `Aucun risque de niveau « ${LEVEL_LABELS[criticiteFilter as RiskLevel]} »`
                    : 'Aucun risque enregistré',
                  MuiTablePagination: {
                    labelRowsPerPage: 'Lignes :',
                    labelDisplayedRows: ({ from, to, count }) =>
                      `${from}–${to} sur ${count !== -1 ? count : `plus de ${to}`}`,
                  },
                }}
              />
            </Paper>
          )}
        </Grid>

        {/* ── AMDEC Matrice de criticité ────────────────────────────────── */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <TrendingUp color="primary" />
              <Typography variant="h6" fontWeight={700}>Matrice AMDEC</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Gravité (G) × Fréquence (F) = IPR
            </Typography>

            {/* Matrix table */}
            <Box sx={{ overflowX: 'auto' }}>
              <Box mb={0.5} ml="32px">
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  GRAVITÉ →
                </Typography>
              </Box>
              <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <td style={{ width: 32 }} />
                    {[1, 2, 3, 4, 5].map((g) => (
                      <td key={g} style={{ textAlign: 'center', padding: '2px 4px' }}>
                        <Tooltip title={G_LABELS[g - 1]}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary">
                            G{g}
                          </Typography>
                        </Tooltip>
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...matrix].reverse().map((row, r) => {
                    const freqIdx = 4 - r; // reversed (F5 at top)
                    return (
                      <tr key={r}>
                        <td style={{ padding: '2px 4px', textAlign: 'right', width: 32 }}>
                          <Tooltip title={F_LABELS[freqIdx]}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary">
                              F{freqIdx + 1}
                            </Typography>
                          </Tooltip>
                        </td>
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            onClick={() => {
                              const lvl = cell.score <= 4 ? 'faible' : cell.score <= 9 ? 'modere' : cell.score <= 16 ? 'eleve' : 'critique';
                              setCriticiteFilter(criticiteFilter === lvl ? '' : lvl);
                            }}
                            style={{
                              backgroundColor: MATRIX_BG(cell.score),
                              border: `2px solid ${MATRIX_BORDER(cell.score)}`,
                              textAlign: 'center',
                              padding: '6px 2px',
                              cursor: 'pointer',
                              transition: 'opacity 0.1s',
                            }}
                          >
                            {cell.count > 0 ? (
                              <Tooltip
                                title={`G${cell.grav} × F${cell.freq} = ${cell.score} — ${cell.count} risque(s)`}
                              >
                                <Badge
                                  badgeContent={cell.count}
                                  color={
                                    cell.score <= 4 ? 'success'
                                    : cell.score <= 9 ? 'warning'
                                    : 'error'
                                  }
                                  sx={{ '& .MuiBadge-badge': { fontSize: 9, minWidth: 14, height: 14, padding: '0 3px' } }}
                                >
                                  <Box
                                    sx={{
                                      width: 20, height: 20, borderRadius: '50%',
                                      bgcolor: 'rgba(0,0,0,0.25)', color: '#fff',
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 700, fontSize: 10,
                                    }}
                                  >
                                    {cell.score}
                                  </Box>
                                </Badge>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" sx={{ opacity: 0.5, fontSize: 10 }}>
                                {cell.score}
                              </Typography>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Box mt={0.5} mr="4px" textAlign="right">
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  ↑ FRÉQUENCE
                </Typography>
              </Box>
            </Box>

            {/* Legend */}
            <Stack spacing={0.75} mt={2}>
              {[
                { range: 'IPR 1–4',   label: 'Négligeable — Accepter/Maintenir', color: '#10b981', bg: '#bbf7d0' },
                { range: 'IPR 5–9',   label: 'Modéré — À surveiller',            color: '#f59e0b', bg: '#fef08a' },
                { range: 'IPR 10–16', label: 'Élevé — Plan d\'action',           color: '#f97316', bg: '#fed7aa' },
                { range: 'IPR ≥ 17',  label: 'Critique — Action urgente',        color: '#ef4444', bg: '#fecaca' },
              ].map((item) => (
                <Box key={item.range} display="flex" alignItems="center" gap={1}>
                  <Box sx={{ width: 28, height: 14, borderRadius: 0.5, bgcolor: item.bg, border: `1px solid ${item.color}`, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary">
                    <strong style={{ color: item.color }}>{item.range}</strong> — {item.label}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Distribution */}
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
              RÉPARTITION ({allRisks.length} risque{allRisks.length !== 1 ? 's' : ''})
            </Typography>
            <Stack spacing={0.75}>
              {LEVEL_CONFIG.map(level => {
                const count = levelCounts[level] ?? 0;
                const pct = allRisks.length > 0 ? (count / allRisks.length) * 100 : 0;
                const color = RISK_COLORS[level];
                return (
                  <Box key={level}>
                    <Box display="flex" justifyContent="space-between" mb={0.25}>
                      <Typography variant="caption" fontWeight={500}>{LEVEL_LABELS[level]}</Typography>
                      <Typography variant="caption" fontWeight={700} color={color}>{count}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 5, borderRadius: 3,
                        bgcolor: alpha(color, 0.12),
                        '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>

            {/* AMDEC info chip */}
            <Box mt={2} p={1.5} bgcolor="grey.50" borderRadius={1.5}>
              <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                <Search sx={{ fontSize: 13, color: 'text.disabled' }} />
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Méthodologie AMDEC (ISO 15189)
                </Typography>
              </Box>
              <Typography variant="caption" color="text.disabled" lineHeight={1.5}>
                IPR = Gravité × Fréquence. Les contrôles existants (barrières de sécurité) réduisent le risque résiduel.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RisksPage;
