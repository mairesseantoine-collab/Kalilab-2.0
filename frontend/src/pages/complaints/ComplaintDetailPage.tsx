import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Box, Grid, Card, CardContent, CardHeader, Typography, Button, TextField,
  Divider, Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Link, Chip, Stack, alpha, useTheme, FormControl,
  InputLabel, Select, MenuItem, Stepper, Step, StepLabel,
} from "@mui/material"
import {
  ArrowBack as ArrowBackIcon, Lock as LockIcon,
  Save, ReportProblem, Autorenew, CheckCircle, PersonOutline,
  DateRange, Category, Add,
} from "@mui/icons-material"
import { complaintsApi } from "../../api/complaints"
import { usersApi } from "../../api/users"
import { actionsApi } from "../../api/actions"
import PageHeader from "../../components/common/PageHeader"
import StatusChip from "../../components/common/StatusChip"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import { useAuth } from "../../contexts/AuthContext"
import dayjs from "dayjs"

const STATUS_STEPS = ['ouverte', 'en_cours', 'cloturee']
const STATUS_LABELS = ['Ouverte', 'En cours', 'Clôturée']

const SOURCE_LABELS: Record<string, string> = {
  patient: 'Patient',
  medecin: 'Médecin',
  interne: 'Interne',
  organisme: 'Organisme',
}

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={0.5} alignItems="center" mb={0.25}>
        {icon && <Box sx={{ color: 'text.disabled', display: 'flex', '& svg': { fontSize: 13 } }}>{icon}</Box>}
        <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5}>
          {label}
        </Typography>
      </Stack>
      <Box>{value || <Typography variant="body2" color="text.disabled">—</Typography>}</Box>
    </Box>
  )
}

const ComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const theme = useTheme()

  const [analyseEdit, setAnalyseEdit] = useState("")
  const [actionDialog, setActionDialog] = useState(false)
  const [actionForm, setActionForm] = useState({
    description: '',
    type_action: 'corrective',
    echeance: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    responsable_id: 0,
  })
  const [closeDialog, setCloseDialog] = useState(false)
  const [progressDialog, setProgressDialog] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" })

  const { data: complaint, isLoading } = useQuery({
    queryKey: ["complaint", id],
    queryFn: () => complaintsApi.get(Number(id)).then(r => r.data),
    enabled: !!id,
  })

  const { data: personnelData } = useQuery({
    queryKey: ['personnel'],
    queryFn: () => usersApi.listPersonnel().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const { data: actionsData } = useQuery({
    queryKey: ['complaint-actions', id],
    queryFn: () => actionsApi.list({ plainte_id: Number(id) }).then(r => r.data),
    enabled: !!id,
  })

  const personnel = Array.isArray(personnelData) ? personnelData : []
  const actions: any[] = Array.isArray(actionsData) ? actionsData : (actionsData as any)?.items ?? []
  const nameById = (pid?: number | null) => {
    if (!pid) return null
    const p = personnel.find(u => u.id === pid)
    return p ? `${p.prenom} ${p.nom}` : `#${pid}`
  }

  const updateMutation = useMutation({
    mutationFn: (data: any) => complaintsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint", id] })
      setSnackbar({ open: true, message: "Analyse enregistrée", severity: "success" })
    },
    onError: () => setSnackbar({ open: true, message: "Erreur de sauvegarde", severity: "error" }),
  })

  const statusMutation = useMutation({
    mutationFn: (statut: string) => complaintsApi.changeStatus(Number(id), statut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint", id] })
      queryClient.invalidateQueries({ queryKey: ['complaints-all'] })
      setCloseDialog(false)
      setProgressDialog(false)
      setSnackbar({ open: true, message: "Statut mis à jour", severity: "success" })
    },
    onError: () => setSnackbar({ open: true, message: "Erreur", severity: "error" }),
  })

  const addActionMutation = useMutation({
    mutationFn: (data: any) => actionsApi.create({ ...data, plainte_id: Number(id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint-actions', id] })
      setActionDialog(false)
      setActionForm({ description: '', type_action: 'corrective', echeance: dayjs().add(30, 'day').format('YYYY-MM-DD'), responsable_id: 0 })
      setSnackbar({ open: true, message: 'Action ajoutée', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur', severity: 'error' }),
  })

  if (isLoading) return <LoadingSpinner message="Chargement de la plainte..." />
  if (!complaint) return <Alert severity="error">Plainte introuvable</Alert>

  const c = complaint as any
  const isClosed = c.statut === "cloturee"
  const isEnCours = c.statut === "en_cours"
  const currentStep = STATUS_STEPS.indexOf(c.statut)
  const isRQ = hasRole("qualiticien", "admin")

  return (
    <Box>
      <PageHeader
        title={`Plainte #${c.id} — ${SOURCE_LABELS[c.source] ?? c.source}`}
        breadcrumbs={[
          { label: 'Plaintes & Réclamations', path: '/complaints' },
          { label: `Plainte #${c.id}` },
        ]}
        actionButton={
          <Box display="flex" gap={1}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/complaints")}>
              Retour
            </Button>
            {!isClosed && isRQ && c.statut === 'ouverte' && (
              <Button variant="contained" color="warning" startIcon={<Autorenew />} onClick={() => setProgressDialog(true)}>
                Prendre en charge
              </Button>
            )}
            {!isClosed && isRQ && (
              <Button variant="contained" color="success" startIcon={<LockIcon />} onClick={() => setCloseDialog(true)}>
                Clôturer
              </Button>
            )}
          </Box>
        }
      />

      {/* Stepper */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Stepper activeStep={currentStep} alternativeLabel>
            {STATUS_LABELS.map((label, i) => (
              <Step key={label} completed={i < currentStep}>
                <StepLabel>
                  <Typography variant="caption" fontWeight={i === currentStep ? 700 : 400}>{label}</Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Info panel */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Informations"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={<StatusChip status={c.statut} />}
              sx={{ pb: 0 }}
            />
            <Divider sx={{ mt: 1 }} />
            <CardContent>
              <Stack spacing={2.5}>
                <InfoRow
                  label="Source"
                  icon={<Category />}
                  value={<Chip label={SOURCE_LABELS[c.source] ?? c.source} size="small" variant="outlined" />}
                />
                <InfoRow
                  label="Déclarant"
                  icon={<PersonOutline />}
                  value={<Typography variant="body2" fontWeight={500}>{nameById(c.declarant_id) ?? c.declarant_nom ?? '—'}</Typography>}
                />
                {c.responsable_id && (
                  <InfoRow
                    label="Responsable"
                    icon={<PersonOutline />}
                    value={<Typography variant="body2" fontWeight={500}>{nameById(c.responsable_id)}</Typography>}
                  />
                )}
                <Divider />
                <InfoRow
                  label="Déclarée le"
                  icon={<DateRange />}
                  value={<Typography variant="body2">{dayjs(c.created_at).format("DD/MM/YYYY [à] HH:mm")}</Typography>}
                />
                {c.date_echeance && (
                  <InfoRow
                    label="Échéance"
                    icon={<DateRange />}
                    value={
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        color={!isClosed && dayjs(c.date_echeance).isBefore(dayjs()) ? 'error.main' : 'text.primary'}
                      >
                        {dayjs(c.date_echeance).format("DD/MM/YYYY")}
                      </Typography>
                    }
                  />
                )}
                {c.nc_id && (
                  <>
                    <Divider />
                    <InfoRow
                      label="NC liée"
                      icon={<ReportProblem />}
                      value={
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => navigate("/nonconformities/" + c.nc_id)}
                        >
                          NC #{c.nc_id}
                        </Link>
                      }
                    />
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Main content */}
        <Grid item xs={12} md={8}>
          <Stack spacing={2.5}>
            {/* Description */}
            <Card>
              <CardHeader title="Description de la plainte" titleTypographyProps={{ variant: 'h6', fontWeight: 600 }} sx={{ pb: 0 }} />
              <Divider sx={{ mt: 1 }} />
              <CardContent>
                <Typography
                  variant="body1"
                  sx={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.8,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                    p: 2,
                    borderRadius: 1.5,
                  }}
                >
                  {c.description}
                </Typography>
              </CardContent>
            </Card>

            {/* Analyse */}
            <Card>
              <CardHeader
                title="Analyse & Actions correctives"
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                action={
                  !isClosed && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={updateMutation.isPending ? <CircularProgress size={14} /> : <Save />}
                      onClick={() => updateMutation.mutate({ analyse: analyseEdit || c.analyse })}
                      disabled={updateMutation.isPending}
                    >
                      Sauvegarder
                    </Button>
                  )
                }
                sx={{ pb: 0 }}
              />
              <Divider sx={{ mt: 1 }} />
              <CardContent>
                {isClosed ? (
                  <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                    {c.analyse || "Aucune analyse renseignée"}
                  </Typography>
                ) : (
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    placeholder="Analysez la plainte : causes identifiées, actions correctives mises en place, résultat attendu…"
                    value={analyseEdit !== "" ? analyseEdit : (c.analyse || "")}
                    onChange={e => setAnalyseEdit(e.target.value)}
                  />
                )}
              </CardContent>
            </Card>

            {/* Actions liées */}
            <Card>
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h6" fontWeight={600}>Actions liées</Typography>
                    {actions.length > 0 && <Chip label={actions.length} size="small" />}
                  </Stack>
                }
                action={
                  !isClosed && (
                    <Button size="small" startIcon={<Add />} variant="outlined" onClick={() => setActionDialog(true)}>
                      Ajouter
                    </Button>
                  )
                }
                sx={{ pb: 0 }}
              />
              <Divider sx={{ mt: 1 }} />
              <CardContent>
                {actions.length > 0 ? (
                  <Stack spacing={1}>
                    {actions.map((a: any) => {
                      const overdue = a.echeance && dayjs(a.echeance).isBefore(dayjs()) && a.statut !== 'cloturee'
                      return (
                        <Box
                          key={a.id}
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            border: `1px solid ${theme.palette.divider}`,
                            bgcolor: overdue ? alpha(theme.palette.error.main, 0.04) : 'background.paper',
                            borderLeft: `4px solid ${
                              a.type_action === 'corrective' ? theme.palette.error.main
                                : a.type_action === 'preventive' ? theme.palette.warning.main
                                : theme.palette.info.main
                            }`,
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box flex={1}>
                              <Typography variant="body2" fontWeight={600}>{a.description}</Typography>
                              <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
                                <Chip label={a.type_action} size="small" variant="outlined" />
                                {a.responsable_id && (
                                  <Typography variant="caption" color="text.secondary">
                                    👤 {nameById(a.responsable_id)}
                                  </Typography>
                                )}
                                {a.echeance && (
                                  <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'} fontWeight={overdue ? 700 : 400}>
                                    📅 {dayjs(a.echeance).format('DD/MM/YYYY')}
                                    {overdue && ' ⚠'}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                            <StatusChip status={a.statut} />
                          </Stack>
                        </Box>
                      )
                    })}
                  </Stack>
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
                      Aucune action enregistrée
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Dialog prise en charge */}
      <Dialog open={progressDialog} onClose={() => setProgressDialog(false)}>
        <DialogTitle>Prendre en charge la plainte</DialogTitle>
        <DialogContent>
          <Typography>
            Confirmer la prise en charge ? La plainte passera en statut <strong>En cours</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => statusMutation.mutate('en_cours')}
            disabled={statusMutation.isPending}
          >
            {statusMutation.isPending ? <CircularProgress size={20} /> : 'Prendre en charge'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog clôture */}
      <Dialog open={closeDialog} onClose={() => setCloseDialog(false)}>
        <DialogTitle>Clôturer la plainte</DialogTitle>
        <DialogContent>
          <Typography>
            Confirmez-vous la clôture de cette plainte ? Assurez-vous d'avoir renseigné l'analyse avant de clôturer.
          </Typography>
          {!c.analyse && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Attention : aucune analyse n'a été enregistrée pour cette plainte.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<LockIcon />}
            onClick={() => statusMutation.mutate('cloturee')}
            disabled={statusMutation.isPending}
          >
            {statusMutation.isPending ? <CircularProgress size={20} /> : 'Clôturer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog ajouter action */}
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
                  <MenuItem value={0}><em>Non assigné</em></MenuItem>
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
              responsable_id: actionForm.responsable_id || undefined,
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

export default ComplaintDetailPage
