import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, MenuItem, Select, FormControl, InputLabel,
  Grid, Typography, Paper, Stack, Chip, InputAdornment, alpha,
  useTheme, Button,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add, Search as SearchIcon, FilterAltOff,
  EditNote, RateReview, ThumbUp, CheckCircle, Public, Archive,
} from '@mui/icons-material';
import { useDocuments } from '../../hooks/useDocuments';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ErrorAlert from '../../components/common/ErrorAlert';
import { DocumentStatus } from '../../types';
import dayjs from 'dayjs';

const DOC_STATUS_CONFIG: {
  value: DocumentStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { value: 'brouillon', label: 'Brouillon', icon: <EditNote />, color: '#78716c' },
  { value: 'relecture', label: 'Relecture', icon: <RateReview />, color: '#f97316' },
  { value: 'approbation', label: 'Approbation', icon: <ThumbUp />, color: '#8b5cf6' },
  { value: 'publie', label: 'Publié', icon: <CheckCircle />, color: '#10b981' },
  { value: 'diffusion', label: 'Diffusion', icon: <Public />, color: '#3b82f6' },
  { value: 'archive', label: 'Archivé', icon: <Archive />, color: '#94a3b8' },
];

const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, error } = useDocuments({
    search: search || undefined,
    statut: statusFilter || undefined,
    theme: themeFilter || undefined,
    page: page + 1,
    size: pageSize,
  });

  // Load all docs for status counts
  const { data: allDocsData } = useDocuments({ skip: 0, limit: 200 });
  const allDocs: any[] = allDocsData?.items ?? [];
  const statusCounts = Object.fromEntries(
    DOC_STATUS_CONFIG.map((s) => [s.value, allDocs.filter((d) => d.statut === s.value).length])
  );

  const hasFilters = !!search || !!statusFilter || !!themeFilter;
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setThemeFilter(''); setPage(0); };

  const columns: GridColDef[] = [
    {
      field: 'titre',
      headerName: 'Titre du document',
      flex: 2,
      minWidth: 200,
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={500} noWrap title={p.value}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'theme',
      headerName: 'Thème',
      flex: 1,
      minWidth: 120,
      renderCell: (p: GridRenderCellParams) =>
        p.value ? (
          <Chip label={p.value} size="small" variant="outlined" sx={{ fontSize: 11 }} />
        ) : (
          <Typography variant="body2" color="text.disabled">—</Typography>
        ),
    },
    {
      field: 'statut',
      headerName: 'Statut',
      width: 145,
      renderCell: (p: GridRenderCellParams) => <StatusChip status={p.value} />,
    },
    {
      field: 'version',
      headerName: 'Version',
      width: 85,
      renderCell: (p: GridRenderCellParams) => (
        <Chip label={`v${p.value}`} size="small" sx={{ fontSize: 11, fontWeight: 600 }} />
      ),
    },
    {
      field: 'auteur',
      headerName: 'Auteur',
      width: 160,
      renderCell: (p: GridRenderCellParams) =>
        p.row.auteur
          ? `${p.row.auteur.prenom} ${p.row.auteur.nom}`
          : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      field: 'date_validite',
      headerName: 'Validité',
      width: 115,
      renderCell: (p: GridRenderCellParams) => {
        if (!p.value) return <Typography variant="body2" color="text.disabled">—</Typography>;
        const expired = dayjs(p.value).isBefore(dayjs());
        return (
          <Typography
            variant="body2"
            color={expired ? 'error.main' : 'text.primary'}
            fontWeight={expired ? 700 : 400}
          >
            {dayjs(p.value).format('DD/MM/YYYY')}
          </Typography>
        );
      },
    },
    {
      field: 'fichier_path',
      headerName: 'Fichier',
      width: 80,
      sortable: false,
      renderCell: (p: GridRenderCellParams) =>
        p.value ? (
          <Chip label="✓ PDF" size="small" color="success" variant="outlined" sx={{ fontSize: 11 }} />
        ) : (
          <Chip label="Vide" size="small" variant="outlined" color="default" sx={{ fontSize: 11, color: 'text.disabled' }} />
        ),
    },
  ];

  if (error) return <ErrorAlert error={error} />;

  return (
    <Box>
      <PageHeader
        title="Documents qualité"
        breadcrumbs={[{ label: 'Documents' }]}
        action={{ label: 'Nouveau document', onClick: () => navigate('/documents/new'), icon: <Add /> }}
      />

      {/* Status cards */}
      <Grid container spacing={1.5} mb={2.5}>
        {DOC_STATUS_CONFIG.map((s) => {
          const active = statusFilter === s.value;
          const count = statusCounts[s.value] ?? 0;
          return (
            <Grid item xs={6} sm={4} md={2} key={s.value}>
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
                  '&:hover': { bgcolor: alpha(s.color, 0.08) },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
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
            placeholder="Rechercher un document…"
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
          <TextField
            size="small"
            label="Thème"
            value={themeFilter}
            onChange={(e) => { setThemeFilter(e.target.value); setPage(0); }}
            sx={{ flex: 1, minWidth: 130 }}
          />
          {hasFilters && (
            <Button
              size="small"
              startIcon={<FilterAltOff />}
              onClick={clearFilters}
              color="inherit"
              sx={{ flexShrink: 0 }}
            >
              Effacer
            </Button>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 'auto !important' }}>
            {data?.total ?? 0} document{(data?.total ?? 0) !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2 }}>
        <DataGrid
          rows={data?.items || []}
          columns={columns}
          loading={isLoading}
          rowCount={data?.total || 0}
          paginationMode="server"
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => { setPage(model.page); setPageSize(model.pageSize); }}
          pageSizeOptions={[10, 20, 50]}
          onRowClick={(params) => navigate(`/documents/${params.row.id}`)}
          autoHeight
          disableRowSelectionOnClick
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
            noRowsLabel: 'Aucun document trouvé',
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

export default DocumentsPage;
