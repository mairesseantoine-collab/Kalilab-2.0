import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Button, TextField, Chip, Typography, Paper, Grid,
  Tabs, Tab, Alert, AlertTitle, alpha, Stack, Tooltip,
  InputAdornment, IconButton, useTheme,
} from '@mui/material'
import {
  Add as AddIcon, Search, Clear, Inventory2,
  CheckCircle, Cancel, Pause, Science,
  Warning as WarningIcon, LocalShipping, TrendingDown,
} from '@mui/icons-material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { useNavigate } from 'react-router-dom'
import { stockApi } from '../../api/stock'
import PageHeader from '../../components/common/PageHeader'
import dayjs from 'dayjs'

// ── Constants ──────────────────────────────────────────────────────────────────
const LOT_STATUTS = [
  { value: 'en_attente', label: 'En attente', color: '#f59e0b', bg: '#fffbeb', icon: <Pause fontSize="small" /> },
  { value: 'accepte',    label: 'Accepté',    color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle fontSize="small" /> },
  { value: 'rejete',     label: 'Rejeté',     color: '#ef4444', bg: '#fef2f2', icon: <Cancel fontSize="small" /> },
  { value: 'quarantaine', label: 'Quarantaine', color: '#8b5cf6', bg: '#f5f3ff', icon: <Science fontSize="small" /> },
]

const StockPage: React.FC = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: lots, isLoading: lotsLoading } = useQuery({
    queryKey: ['lots', filterStatut],
    queryFn: () => stockApi.listLots({ statut: filterStatut || undefined, limit: 200 }).then(r => r.data),
  })
  const { data: allLots } = useQuery({
    queryKey: ['lots-all'],
    queryFn: () => stockApi.listLots({ limit: 500 }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: () => stockApi.listArticles().then(r => r.data),
  })

  const allLotsArr: any[] = Array.isArray(allLots) ? allLots : (allLots as any)?.items ?? []
  const lotsArr: any[] = Array.isArray(lots) ? lots : (lots as any)?.items ?? []
  const articlesArr: any[] = Array.isArray(articles) ? articles : []

  // ── Counts ──────────────────────────────────────────────────────────────────
  const lotCounts = Object.fromEntries(
    LOT_STATUTS.map(s => [s.value, allLotsArr.filter((l: any) => l.statut === s.value).length])
  )
  const expiringSoon = allLotsArr.filter((l: any) =>
    l.date_expiration &&
    dayjs(l.date_expiration).isAfter(dayjs()) &&
    dayjs(l.date_expiration).isBefore(dayjs().add(30, 'day'))
  )
  const expired = allLotsArr.filter((l: any) =>
    l.date_expiration && dayjs(l.date_expiration).isBefore(dayjs())
  )
  const lowStock = articlesArr.filter((a: any) =>
    a.stock_actuel !== undefined && a.stock_min !== undefined && a.stock_actuel <= a.stock_min
  )

  // ── Filtered rows ────────────────────────────────────────────────────────────
  const lotsRows = lotsArr.filter((l: any) =>
    !search ||
    l.numero_lot?.toLowerCase().includes(search.toLowerCase()) ||
    l.article_nom?.toLowerCase().includes(search.toLowerCase())
  )
  const articlesRows = articlesArr.filter((a: any) =>
    !search ||
    a.nom?.toLowerCase().includes(search.toLowerCase()) ||
    a.code?.toLowerCase().includes(search.toLowerCase())
  )

  // ── Columns: Lots ────────────────────────────────────────────────────────────
  const lotsColumns: GridColDef[] = [
    {
      field: 'numero_lot', headerName: 'N° Lot', width: 160,
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600} fontFamily="monospace">
          {p.value || '—'}
        </Typography>
      ),
    },
    { field: 'article_nom', headerName: 'Article / Réactif', flex: 1, minWidth: 180 },
    {
      field: 'quantite', headerName: 'Qté', width: 80, type: 'number',
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600}>{p.value ?? 0}</Typography>
      ),
    },
    {
      field: 'statut', headerName: 'Statut', width: 140,
      renderCell: (p: GridRenderCellParams) => {
        const s = LOT_STATUTS.find(x => x.value === p.value)
        if (!s) return <Chip label={p.value} size="small" />
        return (
          <Chip
            label={s.label}
            size="small"
            icon={s.icon}
            sx={{
              bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 11,
              '& .MuiChip-icon': { color: s.color },
              border: `1px solid ${alpha(s.color, 0.3)}`,
            }}
          />
        )
      },
    },
    {
      field: 'date_reception', headerName: 'Réception', width: 115,
      renderCell: (p: GridRenderCellParams) =>
        p.value ? (
          <Box display="flex" alignItems="center" gap={0.5}>
            <LocalShipping sx={{ fontSize: 13, color: 'text.disabled' }} />
            <Typography variant="body2">{dayjs(p.value).format('DD/MM/YYYY')}</Typography>
          </Box>
        ) : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      field: 'date_expiration', headerName: 'Expiration', width: 130,
      renderCell: (p: GridRenderCellParams) => {
        if (!p.value) return <Typography variant="body2" color="text.disabled">—</Typography>
        const isExpired = dayjs(p.value).isBefore(dayjs())
        const isSoon = dayjs(p.value).isBefore(dayjs().add(30, 'day'))
        const daysLeft = dayjs(p.value).diff(dayjs(), 'day')
        return (
          <Tooltip title={isExpired ? `Expiré il y a ${Math.abs(daysLeft)} j` : `Dans ${daysLeft} jour(s)`}>
            <Chip
              label={dayjs(p.value).format('DD/MM/YYYY')}
              size="small"
              color={isExpired ? 'error' : isSoon ? 'warning' : 'default'}
              variant={isExpired || isSoon ? 'filled' : 'outlined'}
              sx={{ fontWeight: isExpired || isSoon ? 700 : 400, fontSize: 11 }}
            />
          </Tooltip>
        )
      },
    },
    {
      field: 'fournisseur', headerName: 'Fournisseur', width: 130,
      renderCell: (p: GridRenderCellParams) =>
        <Typography variant="body2" color={p.value ? 'text.primary' : 'text.disabled'}>{p.value || '—'}</Typography>,
    },
  ]

  // ── Columns: Articles ─────────────────────────────────────────────────────────
  const articlesColumns: GridColDef[] = [
    {
      field: 'code', headerName: 'Code', width: 130,
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600} fontFamily="monospace" color="primary.main">
          {p.value || '—'}
        </Typography>
      ),
    },
    { field: 'nom', headerName: 'Désignation', flex: 1, minWidth: 180 },
    { field: 'unite', headerName: 'Unité', width: 80 },
    { field: 'stock_min', headerName: 'Seuil min', width: 100, type: 'number' },
    {
      field: 'stock_actuel', headerName: 'Stock actuel', width: 130, type: 'number',
      renderCell: (p: GridRenderCellParams) => {
        const val = p.value ?? 0
        const min = p.row.stock_min ?? 0
        const critical = val <= min
        const warning = val <= min * 1.5
        return (
          <Box display="flex" alignItems="center" gap={1}>
            {critical && <TrendingDown sx={{ fontSize: 14, color: 'error.main' }} />}
            <Chip
              label={val}
              size="small"
              color={critical ? 'error' : warning ? 'warning' : 'success'}
              sx={{ fontWeight: 700, minWidth: 40 }}
            />
          </Box>
        )
      },
    },
    {
      field: 'categorie', headerName: 'Catégorie', width: 130,
      renderCell: (p: GridRenderCellParams) =>
        p.value ? <Chip label={p.value} size="small" variant="outlined" /> : null,
    },
  ]

  return (
    <Box>
      <PageHeader
        title="Gestion des stocks"
        subtitle="Lots reçus, articles & réactifs"
        action={{
          label: 'Nouvelle réception',
          onClick: () => navigate('/stock/reception'),
          icon: <AddIcon />,
        }}
      />

      {/* ── Status cards (lots) ─────────────────────────────────────────────── */}
      {tab === 0 && (
        <Grid container spacing={1.5} mb={2.5}>
          {LOT_STATUTS.map((s) => {
            const active = filterStatut === s.value
            const count = lotCounts[s.value] ?? 0
            return (
              <Grid item xs={6} sm={3} key={s.value}>
                <Paper
                  onClick={() => setFilterStatut(active ? '' : s.value)}
                  elevation={active ? 3 : 1}
                  sx={{
                    p: 1.5, cursor: 'pointer', borderRadius: 2,
                    border: active ? `2px solid ${s.color}` : '2px solid transparent',
                    bgcolor: active ? alpha(s.color, 0.06) : 'background.paper',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: alpha(s.color, 0.08) },
                    display: 'flex', alignItems: 'center', gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 40, height: 40, borderRadius: 1.5,
                      bgcolor: active ? s.color : alpha(s.color, 0.12),
                      color: active ? '#fff' : s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={800} lineHeight={1} color={active ? s.color : 'text.primary'}>
                      {count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      {s.label}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* ── Low stock cards for articles ────────────────────────────────────── */}
      {tab === 1 && lowStock.length > 0 && (
        <Paper
          sx={{
            mb: 2.5, p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center',
            gap: 2, bgcolor: alpha('#ef4444', 0.04), border: '1px solid', borderColor: alpha('#ef4444', 0.3),
          }}
        >
          <TrendingDown sx={{ color: 'error.main', flexShrink: 0 }} />
          <Box flex={1}>
            <Typography variant="body2" fontWeight={700} color="error.main">
              {lowStock.length} article{lowStock.length > 1 ? 's' : ''} sous le seuil minimum
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {lowStock.slice(0, 3).map((a: any) => a.nom).join(' • ')}
              {lowStock.length > 3 && ` … +${lowStock.length - 3}`}
            </Typography>
          </Box>
          <Chip
            label="Filtrer"
            size="small" color="error" variant="outlined"
            onClick={() => setSearch('')}
          />
        </Paper>
      )}

      {/* ── Expiry alerts ───────────────────────────────────────────────────── */}
      {tab === 0 && (expired.length > 0 || expiringSoon.length > 0) && (
        <Stack spacing={1} mb={2.5}>
          {expired.length > 0 && (
            <Alert
              severity="error"
              icon={<WarningIcon />}
              action={
                <Button
                  color="error" size="small" variant="outlined"
                  onClick={() => { setFilterStatut(''); setSearch('expir'); }}
                >
                  Voir
                </Button>
              }
            >
              <AlertTitle>Lots expirés</AlertTitle>
              <strong>{expired.length}</strong> lot{expired.length > 1 ? 's ont' : ' a'} dépassé leur date de péremption.
            </Alert>
          )}
          {expiringSoon.length > 0 && (
            <Alert
              severity="warning"
              icon={<Inventory2 />}
            >
              <AlertTitle>Expirations prochaines (30 jours)</AlertTitle>
              <strong>{expiringSoon.length}</strong> lot{expiringSoon.length > 1 ? 's expirent' : ' expire'} dans moins de 30 jours —{' '}
              {expiringSoon.slice(0, 2).map((l: any) => l.numero_lot).join(', ')}
              {expiringSoon.length > 2 && ` … +${expiringSoon.length - 2} autres`}
            </Alert>
          )}
        </Stack>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box
          sx={{
            borderBottom: 1, borderColor: 'divider',
            px: 2, pt: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setSearch(''); setFilterStatut('') }}>
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={0.75}>
                  Lots reçus
                  {allLotsArr.length > 0 && (
                    <Chip label={allLotsArr.length} size="small" sx={{ height: 18, fontSize: 10 }} />
                  )}
                </Box>
              }
            />
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={0.75}>
                  Articles / Réactifs
                  {articlesArr.length > 0 && (
                    <Chip label={articlesArr.length} size="small" sx={{ height: 18, fontSize: 10 }} />
                  )}
                </Box>
              }
            />
          </Tabs>

          {/* Search */}
          <TextField
            size="small"
            placeholder={tab === 0 ? 'Rechercher un lot, un article…' : 'Rechercher un article, code…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
              endAdornment: search && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}>
                    <Clear fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* ── DataGrid: Lots ─────────────────────────────────────────────────── */}
        {tab === 0 && (
          <DataGrid
            rows={lotsRows}
            columns={lotsColumns}
            loading={lotsLoading}
            pageSizeOptions={[25, 50]}
            autoHeight
            disableRowSelectionOnClick={false}
            onRowClick={(p) => navigate(`/stock/lots/${p.row.id}`)}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            sx={{
              border: 0,
              '& .MuiDataGrid-row': { cursor: 'pointer' },
              '& .MuiDataGrid-row:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' },
            }}
            localeText={{
              noRowsLabel: filterStatut
                ? `Aucun lot avec le statut « ${LOT_STATUTS.find(s => s.value === filterStatut)?.label} »`
                : 'Aucun lot enregistré',
              MuiTablePagination: {
                labelRowsPerPage: 'Lignes :',
                labelDisplayedRows: ({ from, to, count }) => `${from}–${to} sur ${count}`,
              },
            }}
          />
        )}

        {/* ── DataGrid: Articles ─────────────────────────────────────────────── */}
        {tab === 1 && (
          <DataGrid
            rows={articlesRows}
            columns={articlesColumns}
            loading={articlesLoading}
            pageSizeOptions={[25, 50]}
            autoHeight
            disableRowSelectionOnClick={false}
            onRowClick={(p) => navigate(`/stock/articles/${p.row.id}`)}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            sx={{
              border: 0,
              '& .MuiDataGrid-row': { cursor: 'pointer' },
              '& .MuiDataGrid-row:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' },
            }}
            localeText={{
              noRowsLabel: 'Aucun article enregistré',
              MuiTablePagination: {
                labelRowsPerPage: 'Lignes :',
                labelDisplayedRows: ({ from, to, count }) => `${from}–${to} sur ${count}`,
              },
            }}
          />
        )}
      </Paper>
    </Box>
  )
}

export default StockPage
