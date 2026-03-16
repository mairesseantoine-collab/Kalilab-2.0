import React, { useState } from 'react';
import {
  Box, Button, Chip, FormControl, InputLabel, MenuItem, Select,
  TextField, Typography, Paper, Grid, Stack, InputAdornment,
  alpha, useTheme,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Add as AddIcon, Search as SearchIcon, FilterAltOff,
  ErrorOutline, Analytics, Build, FactCheck, CheckCircleOutline,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import { nonConformitiesApi } from '../../api/nonconformities';
import { NCStatus } from '../../types';

const NC_STATUS_CONFIG: {
  value: NCStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { value: 'ouverte', label: 'Ouverte', icon: <ErrorOutline />, color: '#ef4444' },
  { value: 'en_analyse', label: 'En analyse', icon: <Analytics />, color: '#f97316' },
  { value: 'capa_en_cours', label: 'CAPA en cours', icon: <Build />, color: '#3b82f6' },
  { value: 'verification', label: 'Vérification', icon: <FactCheck />, color: '#8b5cf6' },
  { value: 'cloturee', label: 'Clôturée', icon: <CheckCircleOutline />, color: '#10b981' },
];

const NC_TYPES = ['technique', 'administrative', 'securite', 'qualite', 'reglementaire'];

const DEGRE_COLORS: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  observation: 'info',
  mineur: 'warning',
  majeur: 'error',
  critique: 'error',
};

const NonConformitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ['nonconformities', { search, statusFilter, typeFilter, page, pageSize }],
    queryFn: () =>
      nonConformitiesApi.list({
        search: search || undefined,
        statut: statusFilter || undefined,
        type_nc: typeFilter || undefined,
        page: page + 1,
        size: pageSize,
      }),
  });

  // Counts per status — load without filters using backend's skip/limit params
  const { data: allData } = useQuery({
    queryKey: ['nonconformities-counts'],
    queryFn: () => nonConformitiesApi.list({ skip: 0, limit: 200 }),
    staleTime: 2 * 60 * 1000,
  });
  const allItems: any[] = (allData?.data as any)?.items ?? [];
  const statusCounts = Object.fromEntries(
    NC_STATUS_CONFIG.map((s) => [s.value, allItems.filter((nc) => nc.statut === s.value).length])
  );

  const ncs = (data?.data as any)?.items ?? [];
  const total = (data?.data as any)?.total ?? 0;

  const hasFilters = !!search || !!statusFilter || !!typeFilter;
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(0); };

  const columns: GridColDef[] = [
    {
      field: 'id', headerName: 'N°', width: 65,
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary" fontWeight={600}>#{p.value}</Typography>
      ),
    },
    {
      field: 'type_nc',
      headerName: 'Type',
      width: 110,
      renderCell: (p) => (
        <Chip
          label={p.value === 'interne' ? 'Interne' : p.value === 'externe' ? 'Externe' : p.value}
          size="small"
          variant="outlined"
          sx={{ fontSize: 11 }}
        />
      ),
    },
    {
      field: 'degre',
      headerName: 'Gravité',
      width: 110,
      renderCell: (p) =>
        p.value ? (
          <Chip
            label={p.value.toUpperCase()}
            size="small"
            color={DEGRE_COLORS[p.value] ?? 'default'}
            sx={{ fontSize: 11 }}
          />
        ) : null,
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
      renderCell: (p) => (
        <Typography variant="body2" noWrap title={p.value as string}>
          {p.value as string}
        </Typography>
      ),
    },
    {
      field: 'statut',
      headerName: 'Statut',
      width: 155,
      renderCell: (p) => <StatusChip status={p.value as string} />,
    },
    {
      field: 'date_detection',
      headerName: 'Détection',
      width: 110,
      renderCell: (p) => p.value ? (
        <Typography variant="body2">{dayjs(p.value as string).format('DD/MM/YYYY')}</Typography>
      ) : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      field: 'date_echeance',
      headerName: 'Échéance',
      width: 110,
      renderCell: (p) => {
        if (!p.value) return <Typography variant="body2" color="text.disabled">—</Typography>;
        const overdue = dayjs(p.value as string).isBefore(dayjs()) && p.row.statut !== 'cloturee';
        return (
          <Typography
            variant="body2"
            color={overdue ? 'error.main' : 'text.primary'}
            fontWeight={overdue ? 700 : 400}
            sx={overdue ? {
              bgcolor: alpha(theme.palette.error.main, 0.08),
              px: 0.75, borderRadius: 0.75,
            } : {}}
          >
            {dayjs(p.value as string).format('DD/MM/YYYY')}
          </Typography>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Non-Conformités"
        actionButton={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/nonconformities/new')}
          >
            Déclarer une NC
          </Button>
        }
      />

      {/* Status cards */}
      <Grid container spacing={1.5} mb={2.5}>
        {NC_STATUS_CONFIG.map((s) => {
          const active = statusFilter === s.value;
          const count = statusCounts[s.value] ?? 0;
          return (
            <Grid item xs={6} sm={4} md key={s.value}>
              <Paper
                onClick={() => { setStatusFilter(active ? '' : s.value); setPage(0); }}
                elevation={active ? 3 : 1}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  border: active ? `2px solid ${s.color}` : '2px solid transparent',
                  borderRadius: 2,
                  transition: 'all 0.15s',
                  bgcolor: active ? alpha(s.color, 0.06) : 'background.paper',
                  '&:hover': { bgcolor: alpha(s.color, 0.08), elevation: 2 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    color: s.color,
                    display: 'flex',
                    bgcolor: alpha(s.color, 0.12),
                    borderRadius: 1.5,
                    p: 0.75,
                  }}
                >
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
            placeholder="Rechercher dans les descriptions…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ flex: 2, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ flex: 1, minWidth: 140 }}>
            <InputLabel>Type NC</InputLabel>
            <Select
              value={typeFilter}
              label="Type NC"
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
            >
              <MenuItem value="">Tous les types</MenuItem>
              {NC_TYPES.map((t) => (
                <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {hasFilters && (
            <Button
              size="small"
              startIcon={<FilterAltOff />}
              onClick={clearFilters}
              color="inherit"
              sx={{ flexShrink: 0 }}
            >
              Effacer filtres
            </Button>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 'auto !important' }}>
            {total} résultat{total !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2 }}>
        <DataGrid
          rows={ncs}
          columns={columns}
          loading={isLoading}
          rowCount={total}
          pageSizeOptions={[10, 25, 50]}
          paginationModel={{ page, pageSize }}
          paginationMode="server"
          onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize); }}
          autoHeight
          disableRowSelectionOnClick
          onRowClick={(p) => navigate(`/nonconformities/${p.row.id}`)}
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
            noRowsLabel: 'Aucune non-conformité trouvée',
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

export default NonConformitiesPage;
