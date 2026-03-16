import React, { useState } from 'react';
import {
  Box, Button, FormControl, Grid, InputLabel, MenuItem, Paper, Select,
  Typography, Stack, Chip, alpha, useTheme, TextField, InputAdornment,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Add as AddIcon, Search as SearchIcon,
  EventNote, PlayArrow, CheckCircle, Lock,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import { auditsApi } from '../../api/audits';

const AUDIT_TYPES = ['interne', 'externe', 'fournisseur'];

const TYPE_LABELS: Record<string, string> = {
  interne: 'Interne',
  externe: 'Externe',
  fournisseur: 'Fournisseur',
};

const STATUS_CONFIG = [
  { value: 'planifie', label: 'Planifié', icon: <EventNote />, color: '#3b82f6' },
  { value: 'en_cours', label: 'En cours', icon: <PlayArrow />, color: '#f97316' },
  { value: 'termine', label: 'Terminé', icon: <CheckCircle />, color: '#10b981' },
  { value: 'cloture', label: 'Clôturé', icon: <Lock />, color: '#6b7280' },
];

const AuditsPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ['audits', { typeFilter, statusFilter, page, pageSize }],
    queryFn: () => auditsApi.list({
      type_audit: typeFilter || undefined,
      statut: statusFilter || undefined,
      page: page + 1,
      size: pageSize,
    }),
  });

  const { data: allData } = useQuery({
    queryKey: ['audits-all'],
    queryFn: () => auditsApi.list({ skip: 0, limit: 200 }),
    staleTime: 2 * 60 * 1000,
  });

  const allItems: any[] = (allData?.data as any)?.items ?? [];
  const statusCounts = Object.fromEntries(
    STATUS_CONFIG.map((s) => [s.value, allItems.filter((a) => a.statut === s.value).length])
  );

  const audits = (data?.data as any)?.items ?? [];
  const total = (data?.data as any)?.total ?? 0;

  const filtered = search
    ? audits.filter((a: any) =>
        a.titre?.toLowerCase().includes(search.toLowerCase()) ||
        a.referentiel?.toLowerCase().includes(search.toLowerCase())
      )
    : audits;

  const columns: GridColDef[] = [
    {
      field: 'titre',
      headerName: "Titre de l'audit",
      flex: 2,
      minWidth: 180,
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={500} noWrap title={p.value}>{p.value}</Typography>
      ),
    },
    {
      field: 'type_audit',
      headerName: 'Type',
      width: 115,
      renderCell: (p) => (
        <Chip
          label={TYPE_LABELS[p.value] ?? p.value}
          size="small"
          variant="outlined"
          sx={{ fontSize: 11 }}
        />
      ),
    },
    {
      field: 'referentiel',
      headerName: 'Référentiel',
      width: 130,
      renderCell: (p) => p.value ? (
        <Typography variant="body2" color="text.secondary">{p.value}</Typography>
      ) : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      field: 'date_planifiee',
      headerName: 'Date planifiée',
      width: 130,
      renderCell: (p) => {
        if (!p.value) return <Typography variant="body2" color="text.disabled">—</Typography>;
        const isPast = dayjs(p.value as string).isBefore(dayjs());
        return (
          <Typography variant="body2" color={isPast && p.row.statut === 'planifie' ? 'warning.main' : 'text.primary'}>
            {dayjs(p.value as string).format('DD/MM/YYYY')}
          </Typography>
        );
      },
    },
    {
      field: 'responsable_nom',
      headerName: 'Responsable',
      width: 150,
      renderCell: (p) => p.value ? (
        <Typography variant="body2">{p.value}</Typography>
      ) : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      field: 'statut',
      headerName: 'Statut',
      width: 140,
      renderCell: (p) => <StatusChip status={p.value as string} />,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Audits"
        actionButton={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/audits/new')}>
            Planifier un audit
          </Button>
        }
      />

      {/* Status cards */}
      <Grid container spacing={1.5} mb={2.5}>
        {STATUS_CONFIG.map((s) => {
          const active = statusFilter === s.value;
          const count = statusCounts[s.value] ?? 0;
          return (
            <Grid item xs={6} sm={3} key={s.value}>
              <Paper
                onClick={() => { setStatusFilter(active ? '' : s.value); setPage(0); }}
                elevation={active ? 3 : 1}
                sx={{
                  p: 1.5, cursor: 'pointer',
                  border: active ? `2px solid ${s.color}` : '2px solid transparent',
                  borderRadius: 2, transition: 'all 0.15s',
                  bgcolor: active ? alpha(s.color, 0.06) : 'background.paper',
                  '&:hover': { bgcolor: alpha(s.color, 0.08) },
                  display: 'flex', alignItems: 'center', gap: 1.5,
                }}
              >
                <Box sx={{ color: s.color, display: 'flex', bgcolor: alpha(s.color, 0.12), borderRadius: 1.5, p: 0.75 }}>
                  {s.icon}
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700} color={active ? s.color : 'text.primary'} lineHeight={1}>
                    {count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" lineHeight={1.2} display="block">
                    {s.label}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Rechercher un audit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 2, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>
            <InputLabel>Type d'audit</InputLabel>
            <Select value={typeFilter} label="Type d'audit" onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}>
              <MenuItem value="">Tous les types</MenuItem>
              {AUDIT_TYPES.map((tp) => (
                <MenuItem key={tp} value={tp}>{TYPE_LABELS[tp] ?? tp}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 'auto !important' }}>
            {total} audit{total !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2 }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          loading={isLoading}
          rowCount={total}
          pageSizeOptions={[10, 25, 50]}
          paginationModel={{ page, pageSize }}
          paginationMode="server"
          onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize); }}
          autoHeight
          disableRowSelectionOnClick
          onRowClick={(p) => navigate('/audits/' + p.row.id)}
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
            noRowsLabel: 'Aucun audit trouvé',
            MuiTablePagination: {
              labelRowsPerPage: 'Lignes par page :',
              labelDisplayedRows: ({ from, to, count }) =>
                `${from}–${to} sur ${count !== -1 ? count : `plus de ${to}`}`,
            },
          }}
        />
      </Paper>
    </Box>
  );
};

export default AuditsPage;
