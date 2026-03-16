import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Grid, Typography, Paper, Chip, Stack, alpha, useTheme,
  InputAdornment,
} from '@mui/material'
import {
  Add as AddIcon, Search as SearchIcon, FilterAltOff,
  ReportProblem, Autorenew, CheckCircle,
} from '@mui/icons-material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { complaintsApi } from '../../api/complaints'
import PageHeader from '../../components/common/PageHeader'
import StatusChip from '../../components/common/StatusChip'
import dayjs from 'dayjs'

const SOURCES = ['patient', 'medecin', 'interne', 'organisme']

const SOURCE_LABELS: Record<string, string> = {
  patient: 'Patient',
  medecin: 'Médecin',
  interne: 'Interne',
  organisme: 'Organisme',
}

const STATUS_CONFIG = [
  { value: 'ouverte', label: 'Ouverte', icon: <ReportProblem />, color: '#ef4444' },
  { value: 'en_cours', label: 'En cours', icon: <Autorenew />, color: '#f97316' },
  { value: 'cloturee', label: 'Clôturée', icon: <CheckCircle />, color: '#10b981' },
]

const ComplaintsPage: React.FC = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatut, setFilterStatut] = useState('')

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['complaints', filterSource, filterStatut],
    queryFn: () => complaintsApi.list({ source: filterSource || undefined, statut: filterStatut || undefined }).then(r => r.data),
  })

  // Load all for counts
  const { data: allRaw } = useQuery({
    queryKey: ['complaints-all'],
    queryFn: () => complaintsApi.list({ skip: 0, limit: 200 }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
  const allItems: any[] = Array.isArray(allRaw) ? allRaw : ((allRaw as any)?.items ?? [])
  const statusCounts = Object.fromEntries(
    STATUS_CONFIG.map((s) => [s.value, allItems.filter((p) => p.statut === s.value).length])
  )

  const allRows: any[] = Array.isArray(rawData) ? rawData : ((rawData as any)?.items ?? [])
  const rows = allRows.filter((p: any) =>
    !search || p.description?.toLowerCase().includes(search.toLowerCase()) ||
    p.declarant_nom?.toLowerCase().includes(search.toLowerCase())
  )

  const hasFilters = !!search || !!filterSource || !!filterStatut
  const clearFilters = () => { setSearch(''); setFilterSource(''); setFilterStatut('') }

  const columns: GridColDef[] = [
    {
      field: 'id', headerName: 'N°', width: 65,
      renderCell: ({ value }) => (
        <Typography variant="body2" color="text.secondary" fontWeight={600}>#{value}</Typography>
      ),
    },
    {
      field: 'source', headerName: 'Source', width: 115,
      renderCell: ({ value }) => (
        <Chip
          label={SOURCE_LABELS[value] ?? value}
          size="small"
          variant="outlined"
          sx={{ fontSize: 11 }}
        />
      ),
    },
    {
      field: 'description', headerName: 'Description', flex: 1, minWidth: 200,
      renderCell: ({ value }) => (
        <Typography variant="body2" noWrap title={value}>{value}</Typography>
      ),
    },
    {
      field: 'declarant_nom',
      headerName: 'Déclarant',
      width: 150,
      renderCell: ({ value, row }) => (
        <Typography variant="body2">{value ?? `#${row.declarant_id ?? '?'}`}</Typography>
      ),
    },
    {
      field: 'statut', headerName: 'Statut', width: 140,
      renderCell: ({ value }) => <StatusChip status={value} />,
    },
    {
      field: 'created_at', headerName: 'Date', width: 110,
      renderCell: ({ value }) => (
        <Typography variant="body2">{dayjs(value).format('DD/MM/YYYY')}</Typography>
      ),
    },
    {
      field: 'date_echeance', headerName: 'Échéance', width: 110,
      renderCell: ({ value, row }) => {
        if (!value) return <Typography variant="body2" color="text.disabled">—</Typography>
        const overdue = dayjs(value).isBefore(dayjs()) && row.statut !== 'cloturee'
        return (
          <Typography
            variant="body2"
            color={overdue ? 'error.main' : 'text.primary'}
            fontWeight={overdue ? 700 : 400}
          >
            {dayjs(value).format('DD/MM/YYYY')}
          </Typography>
        )
      },
    },
  ]

  return (
    <Box>
      <PageHeader
        title="Plaintes & Réclamations"
        actionButton={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/complaints/new')}>
            Enregistrer une plainte
          </Button>
        }
      />

      {/* Status cards */}
      <Grid container spacing={1.5} mb={2.5}>
        {STATUS_CONFIG.map((s) => {
          const active = filterStatut === s.value
          const count = statusCounts[s.value] ?? 0
          return (
            <Grid item xs={4} key={s.value}>
              <Paper
                onClick={() => setFilterStatut(active ? '' : s.value)}
                elevation={active ? 3 : 1}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: active ? `2px solid ${s.color}` : '2px solid transparent',
                  borderRadius: 2,
                  transition: 'all 0.15s',
                  bgcolor: active ? alpha(s.color, 0.06) : 'background.paper',
                  '&:hover': { bgcolor: alpha(s.color, 0.08) },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    color: s.color,
                    display: 'flex',
                    bgcolor: alpha(s.color, 0.12),
                    borderRadius: 1.5,
                    p: 1,
                  }}
                >
                  {s.icon}
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={700} color={active ? s.color : 'text.primary'} lineHeight={1}>
                    {count}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    {s.label}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          )
        })}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Rechercher dans les plaintes…"
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
            <InputLabel>Source</InputLabel>
            <Select value={filterSource} label="Source" onChange={(e) => setFilterSource(e.target.value)}>
              <MenuItem value="">Toutes les sources</MenuItem>
              {SOURCES.map((s) => <MenuItem key={s} value={s}>{SOURCE_LABELS[s] ?? s}</MenuItem>)}
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
              Effacer
            </Button>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 'auto !important' }}>
            {rows.length} résultat{rows.length !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[25, 50]}
          autoHeight
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          onRowClick={({ row }) => navigate(`/complaints/${row.id}`)}
          sx={{
            border: 0,
            cursor: 'pointer',
            '& .MuiDataGrid-row': { cursor: 'pointer' },
            '& .MuiDataGrid-row:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              borderRadius: 0,
            },
          }}
          localeText={{
            noRowsLabel: 'Aucune plainte enregistrée',
            MuiTablePagination: {
              labelRowsPerPage: 'Lignes par page :',
              labelDisplayedRows: ({ from, to, count }) =>
                `${from}–${to} sur ${count !== -1 ? count : `plus de ${to}`}`,
            },
          }}
        />
      </Paper>
    </Box>
  )
}

export default ComplaintsPage
