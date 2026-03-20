import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Chip, Typography, Paper, Grid, Divider,
  CircularProgress, alpha,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { TrendingDown } from '@mui/icons-material'
import { stockApi } from '../../api/stock'
import PageHeader from '../../components/common/PageHeader'
import dayjs from 'dayjs'

const LOT_STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:  { label: 'En attente',  color: '#f59e0b', bg: '#fffbeb' },
  accepte:     { label: 'Accepté',     color: '#10b981', bg: '#ecfdf5' },
  refuse:      { label: 'Refusé',      color: '#ef4444', bg: '#fef2f2' },
  quarantaine: { label: 'Quarantaine', color: '#8b5cf6', bg: '#f5f3ff' },
}

const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: article, isLoading } = useQuery({
    queryKey: ['article', id],
    queryFn: () => stockApi.getArticle(Number(id)).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
  }

  if (!article) return null

  const isCritical = article.stock_actuel <= article.seuil_alerte
  const lots: any[] = (article as any).lots ?? []

  const lotsColumns: GridColDef[] = [
    {
      field: 'numero_lot', headerName: 'N° Lot', width: 160,
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{p.value}</Typography>
      ),
    },
    {
      field: 'statut', headerName: 'Statut', width: 140,
      renderCell: (p: GridRenderCellParams) => {
        const s = LOT_STATUTS[p.value] ?? { label: p.value, color: '#6b7280', bg: '#f3f4f6' }
        return (
          <Chip
            label={s.label} size="small"
            sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, border: `1px solid ${alpha(s.color, 0.3)}` }}
          />
        )
      },
    },
    { field: 'quantite_restante', headerName: 'Qté restante', width: 130, type: 'number' },
    {
      field: 'dlu', headerName: 'DLU', width: 120,
      renderCell: (p: GridRenderCellParams) => {
        if (!p.value) return <Typography variant="body2" color="text.disabled">—</Typography>
        const isExp = dayjs(p.value).isBefore(dayjs())
        return (
          <Chip
            label={dayjs(p.value).format('DD/MM/YYYY')}
            size="small" color={isExp ? 'error' : 'default'}
            variant={isExp ? 'filled' : 'outlined'}
            sx={{ fontWeight: isExp ? 700 : 400, fontSize: 11 }}
          />
        )
      },
    },
    {
      field: 'date_reception', headerName: 'Réception', width: 120,
      renderCell: (p: GridRenderCellParams) => p.value ? (
        <Typography variant="body2">{dayjs(p.value).format('DD/MM/YYYY')}</Typography>
      ) : null,
    },
  ]

  return (
    <Box>
      <PageHeader
        title={article.designation}
        subtitle={`Réf. ${article.reference}`}
        breadcrumbs={[{ label: 'Stocks', path: '/stock' }, { label: article.designation }]}
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Informations article</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={1.5}>
              {[
                { label: 'Référence', value: <Typography fontFamily="monospace" fontWeight={700}>{article.reference}</Typography> },
                { label: 'Désignation', value: article.designation },
                { label: 'Catégorie', value: <Chip label={article.categorie} size="small" variant="outlined" /> },
                { label: 'Unité', value: article.unite },
                { label: 'Seuil d\'alerte', value: article.seuil_alerte },
              ].map(({ label, value }) => (
                <Grid item xs={12} sm={6} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Box mt={0.25}>{typeof value === 'string' || typeof value === 'number'
                    ? <Typography variant="body2" fontWeight={500}>{value}</Typography>
                    : value}
                  </Box>
                </Grid>
              ))}
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Stock actuel</Typography>
                <Box mt={0.25} display="flex" alignItems="center" gap={1}>
                  {isCritical && <TrendingDown sx={{ color: 'error.main', fontSize: 18 }} />}
                  <Chip
                    label={article.stock_actuel}
                    color={isCritical ? 'error' : 'success'}
                    sx={{ fontWeight: 800, fontSize: 15, px: 1 }}
                  />
                  {isCritical && (
                    <Typography variant="caption" color="error.main" fontWeight={700}>
                      Sous le seuil minimum
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box px={2.5} pt={2} pb={1}>
              <Typography variant="h6" fontWeight={700}>
                Lots associés
                {lots.length > 0 && (
                  <Chip label={lots.length} size="small" sx={{ ml: 1, height: 18, fontSize: 10 }} />
                )}
              </Typography>
            </Box>
            <DataGrid
              rows={lots}
              columns={lotsColumns}
              autoHeight
              pageSizeOptions={[10, 25]}
              disableRowSelectionOnClick={false}
              onRowClick={p => navigate(`/stock/lots/${p.row.id}`)}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              sx={{
                border: 0,
                '& .MuiDataGrid-row': { cursor: 'pointer' },
                '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' },
              }}
              localeText={{ noRowsLabel: 'Aucun lot pour cet article' }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ArticleDetailPage
