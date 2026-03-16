import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Typography, Alert, Snackbar,
} from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { auditTrailApi } from '../../api/auditTrail'
import PageHeader from '../../components/common/PageHeader'
import dayjs from 'dayjs'

const ACTION_COLORS: Record<string, 'success'|'warning'|'error'|'info'|'default'> = {
  create: 'success',
  update: 'info',
  delete: 'error',
  status_change: 'warning',
  login: 'default',
  export: 'default',
}

const AuditTrailPage: React.FC = () => {
  const { t } = useTranslation()
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success'|'error' })

  const params: Record<string, unknown> = {}
  if (filterUser) params.user = filterUser
  if (filterAction) params.action = filterAction
  if (filterEntity) params.entity_type = filterEntity
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ['audit-trail', params],
    queryFn: () => auditTrailApi.list(params).then(r => r.data),
  })

  const rows: any[] = Array.isArray(data) ? data : ((data as any)?.items ?? [])

  const exportCSV = useMutation({
    mutationFn: () => auditTrailApi.exportCSV(params),
    onSuccess: (res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_trail_${dayjs().format('YYYYMMDD_HHmm')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setSnackbar({ open: true, message: 'Export CSV telecharge', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur export', severity: 'error' }),
  })

  const exportJSON = useMutation({
    mutationFn: () => auditTrailApi.exportJSON(params),
    onSuccess: (res) => {
      const url = window.URL.createObjectURL(new Blob([JSON.stringify(res.data, null, 2)]))
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_trail_${dayjs().format('YYYYMMDD_HHmm')}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setSnackbar({ open: true, message: 'Export JSON telecharge', severity: 'success' })
    },
  })

  const columns: GridColDef[] = [
    {
      field: 'created_at', headerName: 'Horodatage', width: 165,
      renderCell: ({ value }) => (
        <Typography variant='caption'>{dayjs(value).format('DD/MM/YYYY HH:mm:ss')}</Typography>
      ),
    },
    { field: 'user_email', headerName: 'Utilisateur', width: 200 },
    {
      field: 'action', headerName: 'Action', width: 140,
      renderCell: ({ value }) => (
        <Chip label={value} size='small' color={ACTION_COLORS[value] ?? 'default'} />
      ),
    },
    { field: 'entity_type', headerName: 'Entite', width: 140 },
    { field: 'entity_id', headerName: 'ID', width: 80 },
    {
      field: 'details', headerName: 'Details', flex: 1,
      renderCell: ({ value }) => (
        <Typography variant='caption' noWrap title={value ? JSON.stringify(value) : ''}>
          {value ? JSON.stringify(value).substring(0, 80) + '...' : '-'}
        </Typography>
      ),
    },
    { field: 'ip_address', headerName: 'IP', width: 130 },
  ]

  return (
    <Box>
      <PageHeader title='Journal d audit (Audit Trail)'
        subtitle='Traçabilite complete de toutes les actions — conformite ISO 15189'
        actionButton={
          <Box display='flex' gap={1}>
            <Button variant='outlined' startIcon={<DownloadIcon />}
              onClick={() => exportCSV.mutate()} disabled={exportCSV.isPending}>
              CSV
            </Button>
            <Button variant='outlined' startIcon={<DownloadIcon />}
              onClick={() => exportJSON.mutate()} disabled={exportJSON.isPending}>
              JSON
            </Button>
          </Box>
        }
      />

      <Box display='flex' gap={2} mb={2} flexWrap='wrap'>
        <TextField size='small' label='Utilisateur' value={filterUser}
          onChange={e => setFilterUser(e.target.value)} sx={{ minWidth: 180 }} />
        <FormControl size='small' sx={{ minWidth: 150 }}>
          <InputLabel>Action</InputLabel>
          <Select value={filterAction} label='Action' onChange={e => setFilterAction(e.target.value)}>
            <MenuItem value=''>Toutes</MenuItem>
            {['create', 'update', 'delete', 'status_change', 'login', 'export'].map(a => (
              <MenuItem key={a} value={a}>{a}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size='small' sx={{ minWidth: 180 }}>
          <InputLabel>Entite</InputLabel>
          <Select value={filterEntity} label='Entite' onChange={e => setFilterEntity(e.target.value)}>
            <MenuItem value=''>Toutes</MenuItem>
            {['document', 'nonconformite', 'equipement', 'audit', 'lot', 'formation', 'plainte', 'risque', 'kpi'].map(e => (
              <MenuItem key={e} value={e}>{e}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField size='small' label='Du' type='date' InputLabelProps={{ shrink: true }}
          value={dateFrom} onChange={e => setDateFrom(e.target.value)} sx={{ minWidth: 150 }} />
        <TextField size='small' label='Au' type='date' InputLabelProps={{ shrink: true }}
          value={dateTo} onChange={e => setDateTo(e.target.value)} sx={{ minWidth: 150 }} />
      </Box>

      <DataGrid rows={rows} columns={columns} loading={isLoading}
        pageSizeOptions={[50, 100, 500]}
        initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
        autoHeight disableRowSelectionOnClick
        sx={{ fontFamily: 'monospace', fontSize: 12 }}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

export default AuditTrailPage
