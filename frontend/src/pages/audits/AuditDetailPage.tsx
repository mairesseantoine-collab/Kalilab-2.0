import React, { useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button,
  Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Alert, Snackbar, Divider,
} from '@mui/material'
import { ExpandMore, ArrowBack, PictureAsPdf, CheckCircle, Add } from '@mui/icons-material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import dayjs from 'dayjs'
import PageHeader from '../../components/common/PageHeader'
import StatusChip from '../../components/common/StatusChip'
import { auditsApi } from '../../api/audits'
import { actionsApi } from '../../api/actions'
import { AuthContext } from '../../contexts/AuthContext'
import { Audit, Action } from '../../types'

interface Constat { numero?: string | number; texte?: string; description?: string; severite?: string }
interface Ecart { description?: string; niveau?: string; severite?: string }

export default function AuditDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authCtx = useContext(AuthContext)
  const [constatDialogOpen, setConstatDialogOpen] = useState(false)
  const [ecartDialogOpen, setEcartDialogOpen] = useState(false)
  const [constatText, setConstatText] = useState('')
  const [constatRef, setConstatRef] = useState('')
  const [ecartDescription, setEcartDescription] = useState('')
  const [ecartNiveau, setEcartNiveau] = useState('mineur')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const auditId = Number(id)
  const { data: auditData, isLoading, isError } = useQuery({
    queryKey: ['audit', auditId],
    queryFn: () => auditsApi.get(auditId),
    enabled: !isNaN(auditId),
  })
  const { data: actionsData } = useQuery({
    queryKey: ['actions', { audit_id: auditId }],
    queryFn: () => actionsApi.list({ audit_id: auditId, size: 100 }),
    enabled: !isNaN(auditId),
  })
  const audit: Audit | undefined = auditData?.data
  const actions: Action[] = actionsData?.data?.items ?? []
  const addConstatMutation = useMutation({
    mutationFn: (data: { description: string; reference_exigence?: string }) => auditsApi.addConstat(auditId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] })
      setConstatDialogOpen(false); setConstatText(''); setConstatRef('')
      setSnackbar({ open: true, message: t('audit.constatAdded', 'Constat ajoute'), severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: t('common.error', 'Erreur'), severity: 'error' }),
  })
  const addEcartMutation = useMutation({
    mutationFn: (data: { description: string; severite: string }) => auditsApi.addEcart(auditId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] })
      setEcartDialogOpen(false); setEcartDescription(''); setEcartNiveau('mineur')
      setSnackbar({ open: true, message: t('audit.ecartAdded', 'Ecart ajoute'), severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: t('common.error', 'Erreur'), severity: 'error' }),
  })
  const validateMutation = useMutation({
    mutationFn: () => import('../../api/client').then(({ default: client }) => client.put('/audits/' + auditId + '/validate')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] })
      setSnackbar({ open: true, message: t('audit.validated', 'Audit valide'), severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: t('common.error', 'Erreur'), severity: 'error' }),
  })
  const handleGenerateReport = async () => {
    try {
      const response = await auditsApi.generateReport(auditId)
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'rapport_audit_' + String(auditId) + '.pdf')
      document.body.appendChild(link); link.click(); link.remove()
      window.URL.revokeObjectURL(url)
      setSnackbar({ open: true, message: t('audit.reportGenerated', 'Rapport genere'), severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: t('common.error', 'Erreur'), severity: 'error' })
    }
  }
  const constats: Constat[] = React.useMemo(() => { try { return JSON.parse(audit?.constats || '[]') } catch { return [] } }, [audit?.constats])
  const ecarts: Ecart[] = React.useMemo(() => { try { return JSON.parse(audit?.ecarts || '[]') } catch { return [] } }, [audit?.ecarts])
  const isQualiticienOrAdmin = authCtx?.hasRole('qualiticien', 'admin') ?? false
  const getSeveriteColor = (sev?: string): 'default' | 'warning' | 'error' | 'info' => {
    if (!sev) return 'default'
    const s = sev.toLowerCase()
    if (s === 'majeur' || s === 'critique') return 'error'
    if (s === 'mineur') return 'warning'
    if (s === 'observation') return 'info'
    return 'default'
  }
  const getNiveauColor = (niv?: string): 'default' | 'warning' | 'error' | 'info' => {
    if (!niv) return 'default'
    if (niv.toLowerCase() === 'majeur') return 'error'
    if (niv.toLowerCase() === 'mineur') return 'warning'
    if (niv.toLowerCase() === 'observation') return 'info'
    return 'default'
  }
  const actionColumns: GridColDef[] = [
    { field: 'description', headerName: t('action.description', 'Description'), flex: 1, minWidth: 180 },
    { field: 'responsable_id', headerName: t('action.responsable', 'Responsable'), width: 140, renderCell: (p) => 'User #' + p.value },
    { field: 'echeance', headerName: t('action.echeance', 'Echeance'), width: 120, renderCell: (p) => p.value ? dayjs(p.value as string).format('DD/MM/YYYY') : '-' },
    { field: 'statut', headerName: t('action.statut', 'Statut'), width: 130, renderCell: (p) => <StatusChip status={p.value as string} /> },
  ]
  const auditTypeColors: Record<string, 'default' | 'primary' | 'secondary' | 'info'> = { interne: 'primary', externe: 'secondary', fournisseur: 'info' }
  if (isLoading) return <Box display='flex' justifyContent='center' mt={4}><CircularProgress /></Box>
  if (isError || !audit) return <Alert severity='error'>{t('common.loadError', 'Impossible de charger')}</Alert>
  return (
    <Box>
      <Box display='flex' justifyContent='space-between' alignItems='flex-start' mb={3}>
        <PageHeader title={audit.titre} breadcrumbs={[{ label: 'Audits', path: '/audits' }, { label: audit.titre }]} />
        <Button variant='outlined' startIcon={<ArrowBack />} onClick={() => navigate('/audits')} sx={{ flexShrink: 0, mt: 0.5 }}>{t('common.back', 'Retour')}</Button>
      </Box>
      <Card sx={{ mb: 3 }}><CardContent>
        <Typography variant='h6' gutterBottom>{t('audit.metadata', 'Informations generales')}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}><Typography variant='caption' color='text.secondary' display='block'>{t('audit.type', 'Type')}</Typography><Chip label={audit.type_audit} color={auditTypeColors[audit.type_audit] ?? 'default'} size='small' sx={{ mt: 0.5 }} /></Grid>
          <Grid item xs={12} sm={6} md={4}><Typography variant='caption' color='text.secondary' display='block'>{t('audit.referentiel', 'Referentiel')}</Typography><Typography variant='body2'>{audit.referentiel || '-'}</Typography></Grid>
          <Grid item xs={12} sm={6} md={4}><Typography variant='caption' color='text.secondary' display='block'>{t('audit.statut', 'Statut')}</Typography><Box mt={0.5}><StatusChip status={audit.statut} /></Box></Grid>
          <Grid item xs={12} sm={6} md={4}><Typography variant='caption' color='text.secondary' display='block'>{t('audit.datePlanifiee', 'Date planifiee')}</Typography><Typography variant='body2'>{audit.date_planifiee ? dayjs(audit.date_planifiee).format('DD/MM/YYYY') : '-'}</Typography></Grid>
          <Grid item xs={12} sm={6} md={4}><Typography variant='caption' color='text.secondary' display='block'>{t('audit.dateRealisation', 'Date realisation')}</Typography><Typography variant='body2'>{audit.date_realisation ? dayjs(audit.date_realisation).format('DD/MM/YYYY') : '-'}</Typography></Grid>
          <Grid item xs={12} sm={6} md={4}><Typography variant='caption' color='text.secondary' display='block'>{t('audit.auditeur', 'Auditeur')}</Typography><Typography variant='body2'>{audit.auditeur_id ? 'User #' + audit.auditeur_id : '-'}</Typography></Grid>
        </Grid>
      </CardContent></Card>
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography fontWeight={600}>{t('audit.constats', 'Constats')} ({constats.length})</Typography></AccordionSummary>
        <AccordionDetails>
          <Box display='flex' justifyContent='flex-end' mb={1}>
            <Button size='small' variant='outlined' startIcon={<Add />} onClick={() => setConstatDialogOpen(true)}>
              {t('audit.addConstat', 'Ajouter constat')}
            </Button>
          </Box>
          {constats.length === 0 ? (
            <Typography color='text.secondary' variant='body2'>{t('audit.noConstats', 'Aucun constat')}</Typography>
          ) : (
            <List dense disablePadding>
              {constats.map((c, idx) => (
                <React.Fragment key={idx}>
                  <ListItem alignItems='flex-start' disableGutters>
                    <ListItemText primary={
                      <Box display='flex' alignItems='center' gap={1} flexWrap='wrap'>
                        {c.numero !== undefined && <Typography variant='caption' color='text.secondary'>#{c.numero}</Typography>}
                        <Typography variant='body2'>{c.texte ?? c.description ?? ''}</Typography>
                        {c.severite && <Chip label={c.severite} size='small' color={getSeveriteColor(c.severite)} />}
                      </Box>
                    } />
                  </ListItem>
                  {idx < constats.length - 1 && <Divider component='li' />}
                </React.Fragment>
              ))}
            </List>
          )}
        </AccordionDetails>
      </Accordion>
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography fontWeight={600}>{t('audit.ecarts', 'Ecarts')} ({ecarts.length})</Typography></AccordionSummary>
        <AccordionDetails>
          <Box display='flex' justifyContent='flex-end' mb={1}>
            <Button size='small' variant='outlined' startIcon={<Add />} onClick={() => setEcartDialogOpen(true)}>
              {t('audit.addEcart', 'Ajouter ecart')}
            </Button>
          </Box>
          {ecarts.length === 0 ? (
            <Typography color='text.secondary' variant='body2'>{t('audit.noEcarts', 'Aucun ecart')}</Typography>
          ) : (
            <List dense disablePadding>
              {ecarts.map((e, idx) => (
                <React.Fragment key={idx}>
                  <ListItem alignItems='flex-start' disableGutters>
                    <ListItemText primary={
                      <Box display='flex' alignItems='center' gap={1} flexWrap='wrap'>
                        <Typography variant='body2'>{e.description ?? ''}</Typography>
                        {(e.niveau ?? e.severite) && <Chip label={e.niveau ?? e.severite} size='small' color={getNiveauColor(e.niveau ?? e.severite)} />}
                      </Box>
                    } />
                  </ListItem>
                  {idx < ecarts.length - 1 && <Divider component='li' />}
                </React.Fragment>
              ))}
            </List>
          )}
        </AccordionDetails>
      </Accordion>
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography fontWeight={600}>{t('audit.actionsCorrectives', 'Actions correctives')} ({actions.length})</Typography></AccordionSummary>
        <AccordionDetails>
          {actions.length === 0 ? (
            <Typography color='text.secondary' variant='body2'>{t('audit.noActions', 'Aucune action')}</Typography>
          ) : (
            <DataGrid rows={actions} columns={actionColumns} rowHeight={40} autoHeight disableRowSelectionOnClick hideFooter={actions.length <= 10} pageSizeOptions={[10, 25]} sx={{ border: 0 }} />
          )}
        </AccordionDetails>
      </Accordion>
      <Box display='flex' gap={2} flexWrap='wrap' sx={{ mb: 3 }}>
        <Button variant='outlined' startIcon={<PictureAsPdf />} onClick={handleGenerateReport}>
          {t('audit.generateReport', 'Generer rapport PDF')}
        </Button>
        {audit.statut === 'en_cours' && isQualiticienOrAdmin && (
          <Button variant='contained' color='success' startIcon={<CheckCircle />}
            onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}>
            {validateMutation.isPending ? <CircularProgress size={20} color='inherit' /> : t('audit.validate', 'Valider audit')}
          </Button>
        )}
      </Box>
      <Dialog open={constatDialogOpen} onClose={() => setConstatDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{t('audit.addConstat', 'Ajouter un constat')}</DialogTitle>
        <DialogContent>
          <TextField label={t('audit.constatText', 'Description')} value={constatText}
            onChange={(e) => setConstatText(e.target.value)} multiline rows={3} fullWidth sx={{ mt: 1 }} />
          <TextField label={t('audit.constatRef', 'Reference exigence')} value={constatRef}
            onChange={(e) => setConstatRef(e.target.value)} fullWidth sx={{ mt: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConstatDialogOpen(false)}>{t('common.cancel', 'Annuler')}</Button>
          <Button variant='contained'
            onClick={() => addConstatMutation.mutate({ description: constatText, reference_exigence: constatRef || undefined })}
            disabled={!constatText.trim() || addConstatMutation.isPending}>
            {addConstatMutation.isPending ? <CircularProgress size={20} /> : t('common.add', 'Ajouter')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={ecartDialogOpen} onClose={() => setEcartDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{t('audit.addEcart', 'Ajouter un ecart')}</DialogTitle>
        <DialogContent>
          <TextField label={t('audit.ecartDescription', 'Description')} value={ecartDescription}
            onChange={(e) => setEcartDescription(e.target.value)} multiline rows={3} fullWidth sx={{ mt: 1 }} />
          <TextField select label={t('audit.ecartNiveau', 'Niveau')} value={ecartNiveau}
            onChange={(e) => setEcartNiveau(e.target.value)} fullWidth sx={{ mt: 2 }} SelectProps={{ native: true }}>
            <option value='majeur'>Majeur</option>
            <option value='mineur'>Mineur</option>
            <option value='observation'>Observation</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEcartDialogOpen(false)}>{t('common.cancel', 'Annuler')}</Button>
          <Button variant='contained'
            onClick={() => addEcartMutation.mutate({ description: ecartDescription, severite: ecartNiveau })}
            disabled={!ecartDescription.trim() || addEcartMutation.isPending}>
            {addEcartMutation.isPending ? <CircularProgress size={20} /> : t('common.add', 'Ajouter')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
