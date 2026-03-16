import React, { useState } from 'react'
import {
  Box, Button, Card, CardContent, CardHeader, Divider, FormControl,
  Grid, InputLabel, MenuItem, Paper, Select, Snackbar, Alert,
  TextField, Typography, ToggleButtonGroup, ToggleButton, Chip,
  Step, StepLabel, Stepper, alpha, Tooltip,
} from '@mui/material'
import {
  ArrowBack, ArrowForward, Send,
  Warning, ReportProblem, Info, ErrorOutline,
  Business, Person, Science, Build, Support, Category,
  CheckCircle,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/common/PageHeader'
import { nonConformitiesApi } from '../../api/nonconformities'
import { usersApi } from '../../api/users'

const schema = z.object({
  type_nc: z.enum(['interne', 'externe']),
  nature: z.string().min(1, 'Obligatoire'),
  source_nc: z.string().optional(),
  processus_concerne: z.string().min(1, 'Obligatoire'),
  degre: z.string().min(1, 'Obligatoire'),
  document_sq: z.string().optional(),
  description: z.string().min(5, 'Minimum 5 caractères'),
  impact: z.string().optional(),
  traitement_immediat: z.string().optional(),
  date_traitement: z.string().optional(),
  date_echeance: z.string().optional(),
  responsable_id: z.union([z.number(), z.null()]).optional(),
})

type FormData = z.infer<typeof schema>

const SOURCES_INTERNES = [
  { value: 'autocontrole', label: 'Autocontrôle' },
  { value: 'constat_interne', label: 'Constat interne' },
  { value: 'audit_interne', label: 'Audit interne' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'autre_interne', label: 'Autre (interne)' },
]
const SOURCES_EXTERNES = [
  { value: 'prescripteur', label: 'Prescripteur' },
  { value: 'patient', label: 'Patient' },
  { value: 'cofrac', label: 'COFRAC' },
  { value: 'audit_externe', label: 'Audit externe' },
  { value: 'fournisseur', label: 'Fournisseur' },
  { value: 'autre_externe', label: 'Autre (externe)' },
]
const NATURES = [
  { value: 'non_conformite', label: 'Non-conformité' },
  { value: 'ecart', label: 'Écart' },
  { value: 'reclamation', label: 'Réclamation' },
  { value: 'observation', label: 'Observation' },
]
const PROCESSUS = [
  { value: 'preanalytique', label: 'Préanalytique', icon: <Person fontSize="small" />, color: '#3b82f6' },
  { value: 'analytique', label: 'Analytique', icon: <Science fontSize="small" />, color: '#8b5cf6' },
  { value: 'postanalytique', label: 'Postanalytique', icon: <Business fontSize="small" />, color: '#06b6d4' },
  { value: 'management', label: 'Management', icon: <Build fontSize="small" />, color: '#f59e0b' },
  { value: 'support', label: 'Support', icon: <Support fontSize="small" />, color: '#10b981' },
  { value: 'autre', label: 'Autre', icon: <Category fontSize="small" />, color: '#6b7280' },
]
const DEGRES = [
  {
    value: 'observation',
    label: 'Observation',
    description: 'Point d\'amélioration sans impact majeur',
    color: '#2196f3',
    bg: '#e3f2fd',
    icon: <Info />,
  },
  {
    value: 'mineur',
    label: 'Mineur',
    description: 'Impact limité, correction simple',
    color: '#ff9800',
    bg: '#fff3e0',
    icon: <Warning />,
  },
  {
    value: 'majeur',
    label: 'Majeur',
    description: 'Impact significatif sur la qualité',
    color: '#f44336',
    bg: '#ffebee',
    icon: <ReportProblem />,
  },
  {
    value: 'critique',
    label: 'Critique',
    description: 'Risque patient ou exigence ISO 15189',
    color: '#9c27b0',
    bg: '#f3e5f5',
    icon: <ErrorOutline />,
  },
]

const STEPS = ['Identification', 'Description', 'Traitement immédiat']

const NCFormPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState(0)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const { control, handleSubmit, watch, trigger, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type_nc: 'interne', nature: '', source_nc: '', processus_concerne: '',
      degre: '', document_sq: '', description: '', impact: '',
      traitement_immediat: '', date_traitement: '', date_echeance: '',
      responsable_id: null,
    },
  })

  const typeNc = watch('type_nc')
  const degre = watch('degre')
  const processus = watch('processus_concerne')
  const description = watch('description')

  const { data: personnelData } = useQuery({
    queryKey: ['personnel'],
    queryFn: () => usersApi.listPersonnel().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })
  const sources = typeNc === 'interne' ? SOURCES_INTERNES : SOURCES_EXTERNES

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data, responsable_id: data.responsable_id ?? undefined }
      return nonConformitiesApi.create(payload)
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['nonconformities'] })
      setSnackbar({ open: true, message: 'NC déclarée avec succès', severity: 'success' })
      setTimeout(() => navigate(`/nonconformities/${res.data?.id ?? ''}`), 1000)
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur lors de la création', severity: 'error' }),
  })

  const handleNext = async () => {
    const step0Fields: (keyof FormData)[] = ['type_nc', 'nature', 'processus_concerne', 'degre']
    const step1Fields: (keyof FormData)[] = ['description']
    const fields = activeStep === 0 ? step0Fields : activeStep === 1 ? step1Fields : []
    const valid = await trigger(fields)
    if (valid) setActiveStep(s => s + 1)
  }

  const selectedDegre = DEGRES.find(d => d.value === degre)
  const selectedProcessus = PROCESSUS.find(p => p.value === processus)

  return (
    <Box>
      <PageHeader
        title="Déclarer une Non-Conformité"
        breadcrumbs={[
          { label: 'Non-Conformités', path: '/nonconformities' },
          { label: 'Nouvelle NC' },
        ]}
      />

      {/* Progress stepper */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label, idx) => (
            <Step key={label} completed={activeStep > idx}>
              <StepLabel
                onClick={() => activeStep > idx && setActiveStep(idx)}
                sx={{ cursor: activeStep > idx ? 'pointer' : 'default' }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
        <Grid container spacing={3}>

          {/* ── STEP 0 : Identification ───────────────────────────── */}
          {activeStep === 0 && (
            <>
              {/* Type NC toggle */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader
                    title="Type de non-conformité"
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                    sx={{ pb: 1 }}
                  />
                  <Divider />
                  <CardContent>
                    <Controller name="type_nc" control={control} render={({ field }) => (
                      <ToggleButtonGroup
                        exclusive
                        value={field.value}
                        onChange={(_, v) => v && field.onChange(v)}
                        sx={{ width: '100%', maxWidth: 400 }}
                      >
                        <ToggleButton value="interne" sx={{ flex: 1, py: 1.5, fontWeight: 600 }}>
                          <Business sx={{ mr: 1 }} fontSize="small" />
                          Interne
                        </ToggleButton>
                        <ToggleButton value="externe" sx={{ flex: 1, py: 1.5, fontWeight: 600 }}>
                          <Person sx={{ mr: 1 }} fontSize="small" />
                          Externe
                        </ToggleButton>
                      </ToggleButtonGroup>
                    )} />
                  </CardContent>
                </Card>
              </Grid>

              {/* Degré de gravité – visual cards */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader
                    title={
                      <Box display="flex" alignItems="center" gap={1}>
                        Degré de gravité *
                        {selectedDegre && (
                          <Chip
                            label={selectedDegre.label}
                            size="small"
                            sx={{ bgcolor: selectedDegre.bg, color: selectedDegre.color, fontWeight: 700 }}
                          />
                        )}
                      </Box>
                    }
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                    sx={{ pb: 1 }}
                  />
                  <Divider />
                  <CardContent>
                    <Controller name="degre" control={control} render={({ field }) => (
                      <Grid container spacing={2}>
                        {DEGRES.map((d) => {
                          const selected = field.value === d.value
                          return (
                            <Grid item xs={6} sm={3} key={d.value}>
                              <Box
                                onClick={() => field.onChange(d.value)}
                                sx={{
                                  p: 2, borderRadius: 2, cursor: 'pointer',
                                  border: selected ? `2px solid ${d.color}` : '2px solid transparent',
                                  bgcolor: selected ? d.bg : alpha(d.color, 0.04),
                                  transition: 'all 0.15s',
                                  textAlign: 'center',
                                  '&:hover': { bgcolor: d.bg, border: `2px solid ${alpha(d.color, 0.5)}` },
                                  outline: selected ? `3px solid ${alpha(d.color, 0.2)}` : 'none',
                                  outlineOffset: 1,
                                }}
                              >
                                <Box sx={{ color: d.color, mb: 0.5, display: 'flex', justifyContent: 'center' }}>
                                  {d.icon}
                                </Box>
                                <Typography variant="body2" fontWeight={700} color={selected ? d.color : 'text.primary'}>
                                  {d.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.3 }}>
                                  {d.description}
                                </Typography>
                              </Box>
                            </Grid>
                          )
                        })}
                      </Grid>
                    )} />
                    {errors.degre && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                        {errors.degre.message}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Processus – visual tile picker */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader
                    title={
                      <Box display="flex" alignItems="center" gap={1}>
                        Processus concerné *
                        {selectedProcessus && (
                          <Chip
                            label={selectedProcessus.label}
                            size="small"
                            icon={selectedProcessus.icon}
                            sx={{
                              bgcolor: alpha(selectedProcessus.color, 0.12),
                              color: selectedProcessus.color, fontWeight: 600,
                              '& .MuiChip-icon': { color: selectedProcessus.color },
                            }}
                          />
                        )}
                      </Box>
                    }
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                    sx={{ pb: 1 }}
                  />
                  <Divider />
                  <CardContent>
                    <Controller name="processus_concerne" control={control} render={({ field }) => (
                      <Box display="flex" gap={1.5} flexWrap="wrap">
                        {PROCESSUS.map((p) => {
                          const selected = field.value === p.value
                          return (
                            <Box
                              key={p.value}
                              onClick={() => field.onChange(p.value)}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: 0.75,
                                px: 2, py: 1, borderRadius: 2, cursor: 'pointer',
                                border: selected ? `2px solid ${p.color}` : `1px solid`,
                                borderColor: selected ? p.color : 'divider',
                                bgcolor: selected ? alpha(p.color, 0.1) : 'background.paper',
                                color: selected ? p.color : 'text.secondary',
                                fontWeight: selected ? 700 : 400,
                                transition: 'all 0.12s',
                                '&:hover': { bgcolor: alpha(p.color, 0.08), borderColor: p.color },
                              }}
                            >
                              <Box sx={{ color: selected ? p.color : 'text.disabled' }}>{p.icon}</Box>
                              <Typography variant="body2" fontWeight={selected ? 700 : 400} color="inherit">
                                {p.label}
                              </Typography>
                            </Box>
                          )
                        })}
                      </Box>
                    )} />
                    {errors.processus_concerne && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                        {errors.processus_concerne.message}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Nature, source, responsable, document */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader title="Détails complémentaires" titleTypographyProps={{ variant: 'h6', fontWeight: 600 }} sx={{ pb: 0 }} />
                  <Divider sx={{ mt: 1 }} />
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Controller name="nature" control={control} render={({ field }) => (
                          <FormControl fullWidth error={!!errors.nature}>
                            <InputLabel>Nature *</InputLabel>
                            <Select {...field} label="Nature *">
                              {NATURES.map(n => <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>)}
                            </Select>
                            {errors.nature && <Typography variant="caption" color="error">{errors.nature.message}</Typography>}
                          </FormControl>
                        )} />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Controller name="source_nc" control={control} render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Source</InputLabel>
                            <Select {...field} label="Source">
                              <MenuItem value=""><em>Non précisée</em></MenuItem>
                              {sources.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )} />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Controller name="responsable_id" control={control} render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Responsable du traitement</InputLabel>
                            <Select
                              {...field}
                              value={field.value ?? ''}
                              label="Responsable du traitement"
                              onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                            >
                              <MenuItem value=""><em>Non attribué</em></MenuItem>
                              {(personnelData ?? []).map(p => (
                                <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )} />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Controller name="document_sq" control={control} render={({ field }) => (
                          <TextField {...field} fullWidth label="Document SQ lié" placeholder="ex: PROC-PREAN-001" />
                        )} />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}

          {/* ── STEP 1 : Description ─────────────────────────────── */}
          {activeStep === 1 && (
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Description de l'écart"
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                  sx={{ pb: 0 }}
                />
                <Divider sx={{ mt: 1 }} />
                <CardContent>
                  <Grid container spacing={2}>
                    {/* Context summary */}
                    <Grid item xs={12}>
                      <Box
                        display="flex" gap={1} flexWrap="wrap" p={1.5}
                        bgcolor="grey.50" borderRadius={1.5} mb={1}
                      >
                        {selectedDegre && (
                          <Chip
                            label={selectedDegre.label}
                            size="small"
                            sx={{ bgcolor: selectedDegre.bg, color: selectedDegre.color, fontWeight: 700 }}
                          />
                        )}
                        {selectedProcessus && (
                          <Chip
                            label={selectedProcessus.label}
                            size="small"
                            icon={selectedProcessus.icon}
                            sx={{
                              bgcolor: alpha(selectedProcessus.color, 0.1),
                              color: selectedProcessus.color,
                              '& .MuiChip-icon': { color: selectedProcessus.color },
                            }}
                          />
                        )}
                        <Chip
                          label={typeNc === 'interne' ? 'Interne' : 'Externe'}
                          size="small" variant="outlined"
                        />
                      </Box>
                    </Grid>

                    <Grid item xs={12}>
                      <Controller name="description" control={control} render={({ field }) => (
                        <Box>
                          <TextField
                            {...field} fullWidth multiline rows={5}
                            label="Description détaillée de l'écart *"
                            error={!!errors.description}
                            helperText={
                              errors.description?.message ??
                              'Décrivez précisément l\'écart constaté par rapport à la procédure, à la norme ou aux attendus'
                            }
                          />
                          <Typography
                            variant="caption"
                            color={(description?.length ?? 0) < 20 ? 'text.disabled' : 'success.main'}
                            sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}
                          >
                            {description?.length ?? 0} caractères
                            {(description?.length ?? 0) >= 20 && <CheckCircle sx={{ fontSize: 12, ml: 0.5, verticalAlign: 'middle' }} />}
                          </Typography>
                        </Box>
                      )} />
                    </Grid>
                    <Grid item xs={12}>
                      <Controller name="impact" control={control} render={({ field }) => (
                        <TextField
                          {...field} fullWidth multiline rows={3}
                          label="Impact (patients, résultats, délais…)"
                          helperText="Évaluation de l'impact sur les patients, les résultats et l'organisation"
                        />
                      )} />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* ── STEP 2 : Traitement immédiat ─────────────────────── */}
          {activeStep === 2 && (
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Traitement immédiat"
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                  sx={{ pb: 0 }}
                />
                <Divider sx={{ mt: 1 }} />
                <CardContent>
                  <Grid container spacing={2}>
                    {selectedDegre && (
                      <Grid item xs={12}>
                        <Alert
                          severity={
                            selectedDegre.value === 'critique' ? 'error'
                            : selectedDegre.value === 'majeur' ? 'warning'
                            : 'info'
                          }
                          sx={{ mb: 1 }}
                        >
                          NC de degré <strong>{selectedDegre.label}</strong> — un traitement immédiat{' '}
                          {selectedDegre.value === 'critique' ? 'est impératif avant toute diffusion de résultat'
                            : selectedDegre.value === 'majeur' ? 'doit être documenté et validé par un biologiste'
                            : 'peut être enregistré si réalisé'}.
                        </Alert>
                      </Grid>
                    )}

                    <Grid item xs={12}>
                      <Controller name="traitement_immediat" control={control} render={({ field }) => (
                        <TextField
                          {...field} fullWidth multiline rows={4}
                          label="Actions réalisées immédiatement"
                          helperText="Actions prises sur le champ pour corriger l'écart et protéger les patients"
                        />
                      )} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller name="date_traitement" control={control} render={({ field }) => (
                        <TextField {...field} fullWidth type="date" label="Date du traitement" InputLabelProps={{ shrink: true }} />
                      )} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller name="date_echeance" control={control} render={({ field }) => (
                        <TextField {...field} fullWidth type="date" label="Échéance analyse / CAPA" InputLabelProps={{ shrink: true }} />
                      )} />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Navigation buttons */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" gap={2} justifyContent="space-between" alignItems="center">
                <Box display="flex" gap={1}>
                  <Button variant="outlined" onClick={() => navigate('/nonconformities')}>
                    Annuler
                  </Button>
                  {activeStep > 0 && (
                    <Button
                      variant="outlined"
                      startIcon={<ArrowBack />}
                      onClick={() => setActiveStep(s => s - 1)}
                    >
                      Précédent
                    </Button>
                  )}
                </Box>

                {activeStep < STEPS.length - 1 ? (
                  <Button
                    variant="contained"
                    endIcon={<ArrowForward />}
                    onClick={handleNext}
                  >
                    Suivant
                  </Button>
                ) : (
                  <Tooltip title={selectedDegre ? `Déclarer la NC (${selectedDegre.label})` : ''}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="warning"
                      startIcon={<Send />}
                      disabled={createMutation.isPending}
                      sx={{
                        bgcolor: selectedDegre?.color,
                        '&:hover': { bgcolor: selectedDegre?.color, filter: 'brightness(0.9)' },
                      }}
                    >
                      {createMutation.isPending ? 'Enregistrement…' : 'Déclarer la NC'}
                    </Button>
                  </Tooltip>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </form>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

export default NCFormPage
