import React, { useState } from "react";
import {
  Box, Button, Alert, FormControl, Grid, InputLabel, MenuItem, Paper,
  Select, Typography, Stack, Chip, alpha, useTheme, InputAdornment, TextField,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {
  Add as AddIcon, Block as BlockIcon, CheckCircle, Build, Cancel,
  Warning, Search as SearchIcon, FilterAltOff,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import PageHeader from "../../components/common/PageHeader";
import StatusChip from "../../components/common/StatusChip";
import { equipmentApi } from "../../api/equipment";

const CATEGORIES = ["analyseur", "centrifugeuse", "autoclave", "pipette", "balance", "thermometre", "refrigerateur", "autre"];

const STATUS_CONFIG = [
  { value: 'operationnel', label: 'Opérationnel', icon: <CheckCircle />, color: '#10b981' },
  { value: 'en_maintenance', label: 'En maintenance', icon: <Build />, color: '#f97316' },
  { value: 'hors_service', label: 'Hors service', icon: <Cancel />, color: '#ef4444' },
  { value: 'calibration_echuee', label: 'Étalonnage échu', icon: <Warning />, color: '#8b5cf6' },
]

const EquipmentPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ["equipment", { categoryFilter, statusFilter, page, pageSize }],
    queryFn: () => equipmentApi.list({
      categorie: categoryFilter || undefined,
      statut: statusFilter || undefined,
      skip: page * pageSize,
      limit: pageSize,
    }),
  });

  // Load all for counts
  const { data: allData } = useQuery({
    queryKey: ["equipment-all"],
    queryFn: () => equipmentApi.list({ skip: 0, limit: 200 }),
    staleTime: 2 * 60 * 1000,
  });
  const allItems: any[] = (allData?.data as any)?.items ?? [];
  const statusCounts = Object.fromEntries(
    STATUS_CONFIG.map((s) => [s.value, allItems.filter((e) => e.statut === s.value).length])
  );

  const rawItems = (data?.data as any)?.items ?? [];
  const total = (data?.data as any)?.total ?? 0;
  const overdueCount = statusCounts['calibration_echuee'] ?? 0;

  // Client-side search filter
  const items = search
    ? rawItems.filter((e: any) =>
        e.nom?.toLowerCase().includes(search.toLowerCase()) ||
        e.numero_inventaire?.toLowerCase().includes(search.toLowerCase()) ||
        e.localisation?.toLowerCase().includes(search.toLowerCase())
      )
    : rawItems;

  const hasFilters = !!search || !!categoryFilter || !!statusFilter;
  const clearFilters = () => { setSearch(""); setCategoryFilter(""); setStatusFilter(""); setPage(0); };

  const isCalibrationOverdue = (date: string | undefined) => date && dayjs(date).isBefore(dayjs());
  const isCalibrationSoon = (date: string | undefined) =>
    date && dayjs(date).diff(dayjs(), "day") <= 30 && !isCalibrationOverdue(date);

  const columns: GridColDef[] = [
    {
      field: "nom", headerName: "Nom de l'équipement", flex: 1, minWidth: 160,
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={500} noWrap>{p.value}</Typography>
      ),
    },
    {
      field: "numero_inventaire", headerName: "N° inventaire", width: 130,
      renderCell: (p) => p.value ? (
        <Chip label={p.value} size="small" variant="outlined" sx={{ fontSize: 11 }} />
      ) : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      field: "categorie", headerName: "Catégorie", width: 130,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{p.value}</Typography>
      ),
    },
    {
      field: "statut", headerName: "Statut", width: 165,
      renderCell: (p) => <StatusChip status={p.value as string} />,
    },
    {
      field: "prochaine_calibration", headerName: "Prochain étalonnage", width: 170,
      renderCell: (p) => {
        if (!p.value) return <Typography variant="body2" color="text.disabled">—</Typography>;
        const date = p.value as string;
        const overdue = isCalibrationOverdue(date);
        const soon = isCalibrationSoon(date);
        return (
          <Chip
            size="small"
            label={dayjs(date).format("DD/MM/YYYY")}
            color={overdue ? 'error' : soon ? 'warning' : 'default'}
            variant={overdue || soon ? 'filled' : 'outlined'}
            sx={{ fontSize: 11, fontWeight: overdue || soon ? 700 : 400 }}
            icon={overdue ? <BlockIcon /> : soon ? <Warning /> : undefined}
          />
        );
      },
    },
    {
      field: "localisation", headerName: "Localisation", width: 130,
      renderCell: (p) => p.value ? (
        <Typography variant="body2" color="text.secondary">{p.value}</Typography>
      ) : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Parc matériel"
        actionButton={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/equipment/new")}>
            Nouvel équipement
          </Button>
        }
      />

      {overdueCount > 0 && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          icon={<BlockIcon />}
          action={
            <Button color="error" size="small" onClick={() => setStatusFilter('calibration_echuee')}>
              Voir les équipements
            </Button>
          }
        >
          <strong>{overdueCount} équipement{overdueCount > 1 ? 's' : ''}</strong> avec étalonnage échu — intervention requise
        </Alert>
      )}

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
            placeholder="Rechercher un équipement…"
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
          <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>
            <InputLabel>Catégorie</InputLabel>
            <Select value={categoryFilter} label="Catégorie" onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}>
              <MenuItem value="">Toutes les catégories</MenuItem>
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {hasFilters && (
            <Button size="small" startIcon={<FilterAltOff />} onClick={clearFilters} color="inherit" sx={{ flexShrink: 0 }}>
              Effacer
            </Button>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 'auto !important' }}>
            {total} équipement{total !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2 }}>
        <DataGrid
          rows={items}
          columns={columns}
          loading={isLoading}
          rowCount={total}
          pageSizeOptions={[10, 25, 50]}
          paginationModel={{ page, pageSize }}
          paginationMode="server"
          onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize); }}
          autoHeight
          disableRowSelectionOnClick
          onRowClick={(p) => navigate("/equipment/" + p.row.id)}
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
            noRowsLabel: 'Aucun équipement trouvé',
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

export default EquipmentPage;
