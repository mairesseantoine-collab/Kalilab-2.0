import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Card, CardContent, CardHeader, Chip, CircularProgress, Alert, Snackbar,
  Stepper, Step, StepLabel, Grid, TextField, Button, Divider, Typography,
  FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch,
  Table, TableHead, TableRow, TableCell, TableBody, Dialog,
  DialogTitle, DialogContent, DialogActions, alpha, useTheme,
  Tooltip, Stack,
} from '@mui/material'
import {
  ArrowBack, Save, CheckCircle, Add, ArrowForward,
  PersonOutline, DateRange, Category, Warning,
} from '@mui/icons-material'
import dayjs from 'dayjs'
import PageHeader from '../../components/common/PageHeader'
import StatusChip from '../../components/common/StatusChip'
import { nonConformitiesApi } from '../../api/nonconformities'
import { actionsApi } from '../../api/actions'
import { usersApi } from '../../api/users'
import { useAuth } from '../../hooks/useAuth'
import { NonConformite, Action } from '../../types'

const NC_STEPS = ['ouverte', 'en_analyse', 'capa_en_cours', 'verification', 'cloturee']
const NC_STEP_LABELS = ['Ouverte', 'En analyse', 'CAPA en cours', 'Vérification', 'Clôturée']

const DEGRE_COLORS: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  observation: 'info',
  mineur: 'warning',
  majeur: 'error',
  critique: 'error',
}

const PROCESSUS_LABELS: Record<string, string> = {
  preanalytique: 'Préanalytique',
  analytique: 'Analytique',
  postanalytique: 'Postanalytique',
  management: 'Management',
  support: 'Support',
  autre: 'Autre',
}

const NATURE_LABELS: Record<string, string> = {
  non_conformite: 'Non-conformité',
  ecart: 'Écart',
  reclamation: 'Réclamation',
  observation: 'Observation',
}

function InfoField({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={0.5} alignItems="center" mb={0.25}>
        {icon && <Box sx={{ color: 'text.disabled', display: 'flex', '& svg': { fontSize: 13 } }}>{icon}</Box>}
        <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
    </Box>
  )
}

export default function NCDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const theme = useTheme()
  const ncId = Number(id)

  const [fields, setFields] = useState<Partial<NonConformite>>({})
  const [actionDialog, setActionDialog] = useState(false)
  const [actionForm, setActionForm] = useState({
    description: '',
    type_action: 'corrective',
    echeance: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    responsable_id: 0,
  })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const { data: ncData, isLoading, isError } = useQuery({
    queryKey: ['nc', ncId],
    queryFn: () => nonConformitiesApi.get(ncId),
    enabled: !!ncId,
  })
  const { data: actionsData } = useQuery({
    queryKey: ['nc-actions', ncId],
    queryFn: () => actionsApi.list({ nc_id: ncId }),
    enabled: !!ncId,
  })
  const { data: personnelData } = useQuery({
    queryKey: ['personnel'],
    queryFn: () => usersApi.listPersonnel().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const personnel = personnelData ?? []
  const nameById = (id_?: number | null) => {
    if (!id_) return null
    const p = personnel.find(u => u.id === id_)
    return p ? `${p.prenom} ${p.nom}` : `#${id_}`
  }

  const nc: NonConformite | undefined = (ncData?.data as NonConformite | undefined)
  const actions: Action[] = (actionsData?.data as any)?.items ?? (actionsData?.data as any) ?? []

  React.useEffect(() => {
    if (nc) {
      setFields(nc)
      setActionForm(prev => ({ ...prev, responsable_id: nc.responsable_id ?? nc.declarant_id ?? 0 }))
    }
  }, [nc])

  const f = (key: keyof NonConformite) => (fields[key] as string | undefined) ?? ''
  const fb = (key: keyof NonConformite) => (fields[key] as boolean | undefined) ?? true
  const set = (key: keyof NonConformite) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields(prev => ({ ...prev, [key]: e.target.value }))
  const setVal = (key: keyof NonConformite, val: unknown) => setFields(prev => ({ ...prev, [key]: val }))

  const updateMutation = useMutation({
    mutationFn: (data: Partial<NonConformite>) => nonConformitiesApi.update(ncId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nc', ncId] })
      setSnackbar({ open: true, message: 'Modifications sauvegardées', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur de sauvegarde', severity: 'error' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ new_status }: { new_status: string }) => nonConformitiesApi.changeStatus(ncId, new_status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nc', ncId] })
      queryClient.invalidateQueries({ queryKey: ['nonconformities-counts'] })
      setSnackbar({ open: true, message: 'Statut mis à jour', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Transition non autorisée', severity: 'error' }),
  })

  const addActionMutation = useMutation({
    mutationFn: (data: any) => actionsApi.create({ ...data, nc_id: ncId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nc-actions', ncId] })
      setActionDialog(false)
      setActionForm({ description: '', type_action: 'corrective', echeance: dayjs().add(30, 'day').format('YYYY-MM-DD'), responsable_id: nc?.responsable_id ?? 0 })
      setSnackbar({ open: true, message: 'Action ajoutée', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur', severity: 'error' }),
  })

  const currentStep = NC_STEPS.indexOf(nc?.statut ?? 'ouverte')
  const canEdit = nc?.statut !== 'cloturee'
  const canAdvance = hasRole('admin', 'qualiticien') && canEdit && currentStep < NC_STEPS.length - 1
  const isRQ = hasRole('admin', 'qualiticien')

  const SaveBtn = ({ data }: { data: Partial<NonConformite> }) => (
    canEdit ? (
      <Button
        size="small"
        variant="outlined"
        startIcon={updateMutation.isPending ? <CircularProgress size={14} /> : <Save />}
        onClick={() => updateMutation.mutate(data)}
        disabled={updateMutation.isPending}
      >
        Sauvegarder
      </Button>
    ) : null
  )

  if (isLoading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>
  if (isError || !nc) return <Alert severity="error">Erreur de chargement de la NC</Alert>

  const isOverdue = nc.date_echeance && dayjs(nc.date_echeance).isBefore(dayjs()) && nc.statut !== 'cloturee'

  return (
    <Box>
      <PageHeader
        title={`NC #${nc.id} — ${nc.nature ? NATURE_LABELS[nc.nature] ?? nc.nature : nc.type_nc}`}
        breadcrumbs={[
          { label: 'Non-Conformités', path: '/nonconformities' },
          { label: `NC #${nc.id}` },
        ]}
        action={canAdvance ? {
          label: `→ ${NC_STEP_LABELS[currentStep + 1]}`,
          onClick: () => statusMutation.mutate({ new_status: NC_STEPS[currentStep + 1] }),
        } : undefined}
      />

      {isOverdue && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<Warning />}>
          Cette NC est <strong>en retard</strong> — échéance dépassée le {dayjs(nc.date_echeance).format('DD/MM/YYYY')}
        </Alert>
      )}

      {/* Stepper */}
      <Card sx={{ mb: 3, overflow: 'visible' }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Stepper activeStep={currentStep} alternativeLabel>
            {NC_STEP_LABELS.map((label, i) => (
              <Step key={label} completed={i < currentStep}>
                <StepLabel
                  StepIconProps={{
                    sx: i === currentStep ? {
                      '& .MuiStepIcon-root': { color: 'primary.main' },
                    } : {},
                  }}
                >
                  <Typography variant="caption" fontWeight={i === currentStep ? 700 : 400}>
                    {label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Grid container spacing={3}>

        {/* ── Section 1 : Identification ── */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="1. Identification"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={
                <Box display="flex" gap={1} alignItems="center">
                  <StatusChip status={nc.statut} />
                  {nc.degre && (
                    <Chip
                      label={nc.degre.toUpperCase()}
                      color={DEGRE_COLORS[nc.degre] ?? 'default'}
                      size="small"
                    />
                  )}
                </Box>
              }
              sx={{ pb: 0 }}
            />
            <Divider sx={{ mt: 1 }} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4} md={3}>
                  <InfoField label="Type" icon={<Category />}
                    value={nc.type_nc === 'interne' ? 'Interne' : 'Externe'} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <InfoField label="Nature" icon={<Category />}
                    value={nc.nature ? (NATURE_LABELS[nc.nature] ?? nc.nature) : null} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <InfoField label="Source" value={nc.source_nc} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <InfoField label="Processus"
                    value={nc.processus_concerne ? (PROCESSUS_LABELS[nc.processus_concerne] ?? nc.processus_concerne) : null} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <InfoField label="Déclarant" icon={<PersonOutline />}
                    value={nameById(nc.declarant_id)} />
                </Grid>
                {nc.responsable_id && (
                  <Grid item xs={6} sm={4} md={3}>
                    <InfoField label="Responsable" icon={<PersonOutline />}
                      value={nameById(nc.responsable_id)} />
                  </Grid>
                )}
                <Grid item xs={6} sm={4} md={3}>
                  <InfoField label="Date de détection" icon={<DateRange />}
                    value={dayjs(nc.date_detection).format('DD/MM/YYYY')} />
                </Grid>
                {nc.date_echeance && (
                  <Grid item xs={6} sm={4} md={3}>
                    <InfoField label="Échéance" icon={<DateRange />}
                      value={
                        <Typography
                          variant="body2" fontWeight={500}
                          color={isOverdue ? 'error.main' : 'text.primary'}
                        >
                          {dayjs(nc.date_echeance).format('DD/MM/YYYY')}
                          {isOverdue && ' ⚠'}
                        </Typography>
                      }
                    />
                  </Grid>
                )}
                {nc.document_sq && (
                  <Grid item xs={6} sm={4} md={3}>
                    <InfoField label="Document SQ" value={nc.document_sq} />
                  </Grid>
                )}
              </Grid>

              <Box mt={2.5}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight={600}>
                  Description
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                    p: 1.5,
                    borderRadius: 1.5,
                    lineHeight: 1.7,
                  }}
                >
                  {nc.description}
                </Typography>
              </Box>
              {nc.impact && (
                <Box mt={1.5}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight={600}>
                    Impact
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{nc.impact}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Section 2 : Traitement immédiat ── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="2. Traitement immédiat" titleTypographyProps={{ variant: 'h6', fontWeight: 600 }} sx={{ pb: 0 }} />
            <Divider sx={{ mt: 1 }} />
            <CardContent>
              <TextField
                fullWidth multiline rows={4}
                label="Action immédiate réalisée"
                value={f('traitement_immediat')}
                onChange={set('traitement_immediat')}
                disabled={!canEdit}
                sx={{ mb: 2 }}
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth type="date"
                    label="Date du traitement"
                    value={f('date_traitement')}
                    onChange={set('date_traitement')}
                    disabled={!canEdit}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth disabled={!canEdit}>
                    <InputLabel>Effectué par</InputLabel>
                    <Select
                      value={fields.effectue_par_id ?? ''}
                      onChange={(e) => setVal('effectue_par_id', e.target.value)}
                      label="Effectué par"
                    >
                      <MenuItem value=""><em>Non renseigné</em></MenuItem>
                      {personnel.map(p => (
                        <MenuItem key={p.id} value={p.id}>{p.prenom} {p.nom}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Box mt={2}>
                <SaveBtn data={{
                  traitement_immediat: f('traitement_immediat'),
                  date_traitement: f('date_traitement') || undefined,
                  effectue_par_id: fields.effectue_par_id as number,
                }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Section 3 : Acceptation ── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="3. Acceptation" titleTypographyProps={{ variant: 'h6', fontWeight: 600 }} sx={{ pb: 0 }} />
            <Divider sx={{ mt: 1 }} />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={fb('acceptation')}
                    onChange={(e) => setVal('acceptation', e.target.checked)}
                    disabled={!isRQ || !canEdit}
                    color="success"
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={500}>
                    {fb('acceptation') ? '✓ NC acceptée pour traitement' : '✗ NC refusée'}
                  </Typography>
                }
                sx={{ mb: 2 }}
              />
              {!fb('acceptation') && (
                <TextField
                  fullWidth multiline rows={3}
                  label="Motivation du refus *"
                  value={f('motivation_refus')}
                  onChange={set('motivation_refus')}
                  disabled={!isRQ || !canEdit}
                  sx={{ mb: 1 }}
                />
              )}
              {isRQ && (
                <SaveBtn data={{
                  acceptation: fb('acceptation'),
                  motivation_refus: f('motivation_refus') || undefined,
                }} />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Section 4 : Analyse des causes ── */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="4. Analyse des causes" titleTypographyProps={{ variant: 'h6', fontWeight: 600 }} sx={{ pb: 0 }} />
            <Divider sx={{ mt: 1 }} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth multiline rows={5}
                    label="Analyse de la cause racine"
                    value={f('analyse_causes')}
                    onChange={set('analyse_causes')}
                    disabled={!canEdit}
                    helperText="Méthode 5 Pourquoi, Ishikawa ou autre"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth multiline rows={5}
                    label="Analyse de l'étendue"
                    value={f('analyse_etendue')}
                    onChange={set('analyse_etendue')}
                    disabled={!canEdit}
                    helperText="Impact sur d'autres processus ou échantillons potentiellement affectés"
                  />
                </Grid>
              </Grid>
              <Box mt={2}>
                <SaveBtn data={{
                  analyse_causes: f('analyse_causes') || undefined,
                  analyse_etendue: f('analyse_etendue') || undefined,
                }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Section 5 : Plan d'actions CAPA ── */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="5. Plan d'actions CAPA" titleTypographyProps={{ variant: 'h6', fontWeight: 600 }} sx={{ pb: 0 }} />
            <Divider sx={{ mt: 1 }} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth multiline rows={4}
                    label="Actions correctives (CAPA)"
                    value={f('capa')}
                    onChange={set('capa')}
                    disabled={!canEdit}
                    helperText="Pour éliminer la cause racine"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth multiline rows={4}
                    label="Action corrective secondaire"
                    value={f('action_corrective_secondaire')}
                    onChange={set('action_corrective_secondaire')}
                    disabled={!canEdit}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth multiline rows={4}
                    label="Action préventive"
                    value={f('action_preventive')}
                    onChange={set('action_preventive')}
                    disabled={!canEdit}
                    helperText="Pour éviter la récurrence"
                  />
                </Grid>
              </Grid>

              <Box mt={2} mb={3}>
                <SaveBtn data={{
                  capa: f('capa') || undefined,
                  action_corrective_secondaire: f('action_corrective_secondaire') || undefined,
                  action_preventive: f('action_preventive') || undefined,
                }} />
              </Box>

              {/* Actions liées */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Actions liées{actions.length > 0 && <Chip label={actions.length} size="small" sx={{ ml: 1 }} />}
                </Typography>
                {canEdit && (
                  <Button size="small" startIcon={<Add />} variant="outlined" onClick={() => setActionDialog(true)}>
                    Ajouter une action
                  </Button>
                )}
              </Box>
              {actions.length > 0 ? (
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Responsable</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Échéance</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {actions.map((a: Action) => {
                      const aOverdue = a.echeance && dayjs(a.echeance).isBefore(dayjs()) && a.statut !== 'cloturee'
                      return (
                        <TableRow key={a.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                          <TableCell>
                            <Chip
                              label={a.type_action}
                              size="small"
                              color={a.type_action === 'corrective' ? 'error' : a.type_action === 'preventive' ? 'warning' : 'info'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title={a.description}>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>{a.description}</Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{nameById(a.responsable_id)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color={aOverdue ? 'error.main' : 'text.primary'} fontWeight={aOverdue ? 700 : 400}>
                              {a.echeance ? dayjs(a.echeance).format('DD/MM/YY') : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell><StatusChip status={a.statut} /></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Box
                  sx={{
                    py: 3, textAlign: 'center',
                    bgcolor: alpha(theme.palette.action.hover, 0.5),
                    borderRadius: 1.5,
                    border: `1px dashed ${theme.palette.divider}`,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Aucune action enregistrée pour cette NC
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Section 6 : Clôture ── */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="6. Clôture"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={nc.date_cloture && (
                <Chip
                  icon={<CheckCircle />}
                  label={`Clôturée le ${dayjs(nc.date_cloture).format('DD/MM/YYYY')}`}
                  color="success"
                  variant="outlined"
                />
              )}
              sx={{ pb: 0 }}
            />
            <Divider sx={{ mt: 1 }} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth multiline rows={3}
                    label="Vérification de l'efficacité"
                    value={f('verification_efficacite')}
                    onChange={set('verification_efficacite')}
                    disabled={!canEdit}
                    helperText="Date et méthode de vérification, observations"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth disabled={!isRQ || !canEdit}>
                    <InputLabel>Efficacité</InputLabel>
                    <Select value={f('efficacite')} onChange={(e) => setVal('efficacite', e.target.value)} label="Efficacité">
                      <MenuItem value=""><em>À évaluer</em></MenuItem>
                      <MenuItem value="efficace">✓ Efficace</MenuItem>
                      <MenuItem value="non_efficace">✗ Non efficace</MenuItem>
                      <MenuItem value="en_cours">⏳ En cours</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Référence(s) PAG"
                    value={f('reference_pag')}
                    onChange={set('reference_pag')}
                    disabled={!isRQ || !canEdit}
                    helperText="Plan d'Actions Global"
                  />
                </Grid>
              </Grid>

              <Box mt={2} display="flex" gap={2} flexWrap="wrap" alignItems="center">
                <SaveBtn data={{
                  verification_efficacite: f('verification_efficacite') || undefined,
                  efficacite: f('efficacite') || undefined,
                  reference_pag: f('reference_pag') || undefined,
                }} />
                {isRQ && nc.statut === 'capa_en_cours' && (
                  <Button
                    variant="outlined"
                    startIcon={<ArrowForward />}
                    onClick={() => statusMutation.mutate({ new_status: 'verification' })}
                    disabled={statusMutation.isPending}
                  >
                    Passer en vérification
                  </Button>
                )}
                {isRQ && nc.statut === 'verification' && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => statusMutation.mutate({ new_status: 'cloturee' })}
                    disabled={statusMutation.isPending}
                  >
                    Clôturer la NC
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      <Box mt={2} mb={4}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/nonconformities')}>
          Retour à la liste
        </Button>
      </Box>

      {/* Dialog Ajouter action */}
      <Dialog open={actionDialog} onClose={() => setActionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter une action</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Type d'action</InputLabel>
            <Select
              value={actionForm.type_action}
              onChange={(e) => setActionForm(prev => ({ ...prev, type_action: e.target.value }))}
              label="Type d'action"
            >
              <MenuItem value="corrective">Corrective</MenuItem>
              <MenuItem value="preventive">Préventive</MenuItem>
              <MenuItem value="amelioration">Amélioration</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth multiline rows={3}
            label="Description *"
            value={actionForm.description}
            onChange={(e) => setActionForm(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth type="date"
                label="Échéance *"
                value={actionForm.echeance}
                onChange={(e) => setActionForm(prev => ({ ...prev, echeance: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Responsable</InputLabel>
                <Select
                  value={actionForm.responsable_id}
                  onChange={(e) => setActionForm(prev => ({ ...prev, responsable_id: Number(e.target.value) }))}
                  label="Responsable"
                >
                  {personnel.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.prenom} {p.nom}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!actionForm.description || addActionMutation.isPending}
            onClick={() => addActionMutation.mutate({
              type_action: actionForm.type_action,
              description: actionForm.description,
              echeance: actionForm.echeance,
              responsable_id: actionForm.responsable_id || (nc.responsable_id ?? nc.declarant_id),
            })}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
