import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Chip, Typography, Paper, Grid, Divider,
  Stack, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, alpha, CircularProgress,
} from '@mui/material'
import {
  CheckCircle, Cancel, Science, Inventory2,
  Person, CalendarToday, LocalShipping, Notes,
} from '@mui/icons-material'
import { stockApi } from '../../api/stock'
import PageHeader from '../../components/common/PageHeader'
import { LOT_STATUTS } from '../../constants/lotStatuts'
import dayjs from 'dayjs'

const Field: React.FC<{ label: string; value?: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <Box display="flex" alignItems="flex-start" gap={1} py={1}>
    {icon && <Box sx={{ color: 'text.disabled', mt: 0.3 }}>{icon}</Box>}
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value ?? <span style={{ color: '#9ca3af' }}>—</span>}</Typography>
    </Box>
  </Box>
)

const LotDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const numId = Number(id)
  const queryClient = useQueryClient()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectMotif, setRejectMotif] = useState('')

  const { data: lot, isLoading } = useQuery({
    queryKey: ['lot', id],
    queryFn: () => stockApi.getLot(numId).then(r => r.data),
    enabled: !!id,
  })

  const invalidateLots = () => {
    queryClient.invalidateQueries({ queryKey: ['lot', id] })
    queryClient.invalidateQueries({ queryKey: ['lots'] })
    queryClient.invalidateQueries({ queryKey: ['lots-all'] })
  }

  const acceptMutation = useMutation({
    mutationFn: () => stockApi.acceptLot(numId),
    onSuccess: invalidateLots,
  })

  const rejectMutation = useMutation({
    mutationFn: () => stockApi.rejectLot(numId, rejectMotif),
    onSuccess: () => {
      setRejectOpen(false)
      invalidateLots()
    },
  })

  if (isLoading) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
  }

  if (!lot) return null

  const statut = LOT_STATUTS[lot.statut] ?? { label: lot.statut, color: '#6b7280', bg: '#f3f4f6' }
  const isQuarantine = lot.statut === 'quarantaine'
  const dluDate = lot.dlu ? dayjs(lot.dlu) : null
  const isExpired = dluDate ? dluDate.isBefore(dayjs()) : false
  const isSoon = dluDate && !isExpired ? dluDate.isBefore(dayjs().add(30, 'day')) : false

  return (
    <Box>
      <PageHeader
        title={`Lot ${lot.numero_lot}`}
        subtitle={lot.article_designation ?? ''}
        breadcrumbs={[{ label: 'Stocks', path: '/stock' }, { label: `Lot ${lot.numero_lot}` }]}
      />

      <Grid container spacing={2.5}>
        {/* Main info */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={700}>Informations du lot</Typography>
              <Chip
                label={statut.label}
                sx={{ bgcolor: statut.bg, color: statut.color, fontWeight: 700, border: `1px solid ${alpha(statut.color, 0.3)}` }}
              />
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <Field label="N° de lot" value={<Typography fontFamily="monospace" fontWeight={700}>{lot.numero_lot}</Typography>} icon={<Inventory2 fontSize="small" />} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="Article" value={`${lot.article_designation} (${lot.article_reference})`} icon={<Science fontSize="small" />} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="Quantité reçue" value={`${lot.quantite_recue}`} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="Quantité restante" value={`${lot.quantite_restante}`} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  label="DLU (date limite d'utilisation)"
                  icon={<CalendarToday fontSize="small" />}
                  value={
                    dluDate ? (
                      <Chip
                        label={dluDate.format('DD/MM/YYYY')}
                        size="small"
                        color={isExpired ? 'error' : isSoon ? 'warning' : 'default'}
                        variant={isExpired || isSoon ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 700 }}
                      />
                    ) : '—'
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="Date de réception" icon={<LocalShipping fontSize="small" />} value={dayjs(lot.date_reception).format('DD/MM/YYYY HH:mm')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="Réceptionné par" icon={<Person fontSize="small" />} value={lot.reception_par} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="Conformité" value={
                  lot.conformite === null ? '—'
                  : lot.conformite ? <Chip label="Conforme" color="success" size="small" />
                  : <Chip label="Non conforme" color="error" size="small" />
                } />
              </Grid>
              {lot.notes && (
                <Grid item xs={12}>
                  <Field label="Notes" icon={<Notes fontSize="small" />} value={<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{lot.notes}</Typography>} />
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Actions</Typography>
            <Divider sx={{ mb: 2 }} />
            {isQuarantine ? (
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={acceptMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                  fullWidth
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                >
                  Accepter le lot
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Cancel />}
                  fullWidth
                  onClick={() => setRejectOpen(true)}
                >
                  Refuser le lot
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Ce lot est en statut <strong>{statut.label}</strong> et ne peut plus être modifié.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Refuser le lot {lot.numero_lot}</DialogTitle>
        <DialogContent>
          <TextField
            label="Motif de refus"
            multiline
            rows={3}
            fullWidth
            value={rejectMotif}
            onChange={e => setRejectMotif(e.target.value)}
            sx={{ mt: 1 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => rejectMutation.mutate()}
            disabled={!rejectMotif.trim() || rejectMutation.isPending}
          >
            Confirmer le refus
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default LotDetailPage
