import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Grid, Card, CardContent, CardHeader, Typography, Button, Tabs, Tab,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert, Snackbar, Tooltip,
  Paper, Stack, Divider, alpha, useTheme, IconButton, Switch, FormControlLabel,
  Autocomplete, Checkbox, ListItemText, OutlinedInput, FormHelperText,
} from '@mui/material'
import {
  Add as AddIcon, School, Star, CheckCircle, Schedule,
  Groups, EmojiEvents, WorkspacePremium, Edit as EditIcon,
  Delete as DeleteIcon, NotificationsActive, Refresh,
} from '@mui/icons-material'
import { hrApi, Qualification } from '../../api/hr'
import PageHeader from '../../components/common/PageHeader'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import dayjs from 'dayjs'

const NIVEAUX: Record<number, { label: string; color: 'default'|'warning'|'primary'|'success'|'error'; bg: string }> = {
  0: { label: 'Non évalué', color: 'default', bg: '#f1f5f9' },
  1: { label: 'Notions', color: 'warning', bg: '#fffbeb' },
  2: { label: 'Pratique', color: 'primary', bg: '#eff6ff' },
  3: { label: 'Maîtrise', color: 'success', bg: '#f0fdf4' },
  4: { label: 'Expert', color: 'error', bg: '#fdf2f8' },
}

const FORMATION_TYPE_COLORS: Record<string, string> = {
  interne: '#3b82f6',
  externe: '#f97316',
  'e-learning': '#8b5cf6',
  habilitation: '#10b981',
}

const FONCTIONS = [
  'Aide-laborantin/Secrétaire [E]',
  'Aide-laborantin/Secrétaire [M]',
  'Infirmier [E]',
  'Infirmier [M]',
]

const EMPTY_QUAL: Partial<Qualification> = {
  libelle: '',
  duree_heures: null,
  description: '',
  reevaluation: false,
  responsable_id: null,
  sites: [],
  fonctions_concernees: [],
  personnel_concerne: [],
}

// ── Qualification dialog ──────────────────────────────────────────────────────

interface QualDialogProps {
  open: boolean
  initial: Partial<Qualification> | null
  onClose: () => void
  onSave: (data: Partial<Qualification>) => void
  loading: boolean
}

const QualDialog: React.FC<QualDialogProps> = ({ open, initial, onClose, onSave, loading }) => {
  const [form, setForm] = useState<Partial<Qualification>>(initial ?? EMPTY_QUAL)

  React.useEffect(() => {
    setForm(initial ?? EMPTY_QUAL)
  }, [initial, open])

  const set = (key: keyof Qualification, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WorkspacePremium color="primary" />
          <Typography variant="h6">
            {initial?.id ? 'Modifier la qualification' : 'Nouvelle qualification'}
          </Typography>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {/* Libellé */}
          <Grid item xs={12}>
            <TextField
              label="Libellé *"
              fullWidth
              value={form.libelle ?? ''}
              onChange={e => set('libelle', e.target.value)}
            />
          </Grid>

          {/* Durée + Ré-évaluation */}
          <Grid item xs={12} sm={4}>
            <TextField
              label="Durée (heures)"
              type="number"
              fullWidth
              value={form.duree_heures ?? ''}
              onChange={e => set('duree_heures', e.target.value ? Number(e.target.value) : null)}
              inputProps={{ min: 0, step: 0.5 }}
            />
          </Grid>
          <Grid item xs={12} sm={4} display="flex" alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={!!form.reevaluation}
                  onChange={e => set('reevaluation', e.target.checked)}
                  color="warning"
                />
              }
              label="Ré-évaluation requise"
            />
          </Grid>

          {/* Sites */}
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Sites concernés</InputLabel>
              <Select
                multiple
                value={form.sites ?? []}
                onChange={e => set('sites', e.target.value)}
                input={<OutlinedInput label="Sites concernés" />}
                renderValue={(sel: string[]) => sel.map(s => s === 'STE' ? 'E — STE' : 'M — STM').join(', ')}
              >
                <MenuItem value="STE">
                  <Checkbox checked={(form.sites ?? []).includes('STE')} />
                  <ListItemText primary="E — STE" />
                </MenuItem>
                <MenuItem value="STM">
                  <Checkbox checked={(form.sites ?? []).includes('STM')} />
                  <ListItemText primary="M — STM" />
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Description */}
          <Grid item xs={12}>
            <TextField
              label="Description"
              multiline
              rows={3}
              fullWidth
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Objectifs, contenu, modalités d'évaluation…"
            />
          </Grid>

          {/* Fonctions concernées */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Fonctions concernées</InputLabel>
              <Select
                multiple
                value={form.fonctions_concernees ?? []}
                onChange={e => set('fonctions_concernees', e.target.value)}
                input={<OutlinedInput label="Fonctions concernées" />}
                renderValue={(sel: string[]) => sel.join(', ')}
              >
                {FONCTIONS.map(fn => (
                  <MenuItem key={fn} value={fn}>
                    <Checkbox checked={(form.fonctions_concernees ?? []).includes(fn)} />
                    <ListItemText primary={fn} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Personnel concerné (tags libres) */}
          <Grid item xs={12}>
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={form.personnel_concerne ?? []}
              onChange={(_, val) => set('personnel_concerne', val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Personnel concerné"
                  helperText="Entrez un nom ou identifiant et appuyez sur Entrée"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Annuler</Button>
        <Button
          variant="contained"
          onClick={() => onSave(form)}
          disabled={!form.libelle || loading}
          startIcon={loading ? <CircularProgress size={18} /> : undefined}
        >
          {initial?.id ? 'Enregistrer' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Main HRPage ───────────────────────────────────────────────────────────────

const HRPage: React.FC = () => {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({
    titre: '', type: 'interne', date_debut: '', date_fin: '', description: '',
  })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success'|'error' })

  // ── Qualification state ──────────────────────────────────────────────────
  const [qualDialog, setQualDialog] = useState(false)
  const [editingQual, setEditingQual] = useState<Partial<Qualification> | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [siteFilter, setSiteFilter] = useState<'all'|'STE'|'STM'>('all')

  const { data: matrix, isLoading: ml } = useQuery({
    queryKey: ['hr-matrix'],
    queryFn: () => hrApi.getMatrix().then(r => r.data),
  })
  const { data: competences } = useQuery({
    queryKey: ['hr-competences'],
    queryFn: () => hrApi.listCompetences().then(r => r.data),
  })
  const { data: formations, isLoading: fl } = useQuery({
    queryKey: ['hr-formations'],
    queryFn: () => hrApi.listFormations().then(r => r.data),
  })
  const { data: qualifications, isLoading: ql } = useQuery({
    queryKey: ['hr-qualifications'],
    queryFn: () => hrApi.listQualifications().then(r => r.data),
  })

  const createFormation = useMutation({
    mutationFn: (d: any) => hrApi.createFormation(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-formations'] })
      setDialog(false)
      setSnackbar({ open: true, message: 'Formation créée avec succès', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur lors de la création', severity: 'error' }),
  })

  const updateNiveau = useMutation({
    mutationFn: ({ pid, cid, niveau }: { pid: number; cid: number; niveau: number }) =>
      hrApi.updateCompetence(pid, cid, niveau),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-matrix'] }),
  })

  const createQual = useMutation({
    mutationFn: (d: Partial<Qualification>) => hrApi.createQualification(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-qualifications'] })
      setQualDialog(false)
      setEditingQual(null)
      setSnackbar({ open: true, message: 'Qualification créée', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur lors de la création', severity: 'error' }),
  })

  const updateQual = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Qualification> }) =>
      hrApi.updateQualification(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-qualifications'] })
      setQualDialog(false)
      setEditingQual(null)
      setSnackbar({ open: true, message: 'Qualification mise à jour', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur lors de la mise à jour', severity: 'error' }),
  })

  const deleteQual = useMutation({
    mutationFn: (id: number) => hrApi.deleteQualification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-qualifications'] })
      setDeleteConfirm(null)
      setSnackbar({ open: true, message: 'Qualification supprimée', severity: 'success' })
    },
  })

  const seedQuals = useMutation({
    mutationFn: () => hrApi.seedQualifications(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['hr-qualifications'] })
      const d = (res as any).data
      setSnackbar({ open: true, message: `${d.created} qualifications créées (${d.skipped} déjà existantes)`, severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur lors du chargement', severity: 'error' }),
  })

  const competenceList: any[] = (competences as any[]) ?? []
  const personnel: any[] = []
  const matrixMap: Record<string, number> = {}
  if (Array.isArray(matrix)) {
    (matrix as any[]).forEach((row: any) => {
      matrixMap[`${row.personnel_id}_${row.competence_id}`] = row.niveau
      if (!personnel.find(p => p.id === row.personnel_id))
        personnel.push({ id: row.personnel_id, nom: row.personnel_nom ?? `P${row.personnel_id}` })
    })
  }

  const formationsList: any[] = Array.isArray(formations) ? formations : []

  const qualList: Qualification[] = Array.isArray(qualifications)
    ? (siteFilter === 'all' ? qualifications : qualifications.filter((q: Qualification) => q.sites.includes(siteFilter)))
    : []

  const handleSaveQual = (data: Partial<Qualification>) => {
    if (editingQual?.id) {
      updateQual.mutate({ id: editingQual.id, data })
    } else {
      createQual.mutate(data)
    }
  }

  return (
    <Box>
      <PageHeader
        title="Ressources humaines"
        subtitle="Compétences, habilitations et formations"
        actionButton={
          tab === 1 ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog(true)}>
              Nouvelle formation
            </Button>
          ) : tab === 2 ? (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => seedQuals.mutate()}
                disabled={seedQuals.isPending}
                size="small"
              >
                Charger liste standard
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => { setEditingQual(null); setQualDialog(true) }}
              >
                Nouvelle qualification
              </Button>
            </Stack>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          '& .MuiTabs-indicator': { height: 3 },
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Tab icon={<Groups fontSize="small" />} iconPosition="start" label="Matrice des compétences" />
        <Tab icon={<School fontSize="small" />} iconPosition="start" label="Formations" />
        <Tab icon={<WorkspacePremium fontSize="small" />} iconPosition="start" label="Suivi des Qualifications" />
      </Tabs>

      {/* Tab 0: Compétences matrix */}
      {tab === 0 && (ml ? <LoadingSpinner message="Chargement de la matrice..." /> : (
        <Card sx={{ borderRadius: 2 }}>
          <CardHeader
            title={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6" fontWeight={600}>Matrice de compétences</Typography>
                <Chip label={`${personnel.length} agents`} size="small" variant="outlined" />
                <Chip label={`${competenceList.length} compétences`} size="small" variant="outlined" />
              </Stack>
            }
          />
          <Divider />
          <CardContent sx={{ overflowX: 'auto', p: 0 }}>
            {competenceList.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Groups sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">Aucune donnée de compétences disponible</Typography>
              </Box>
            ) : (
              <>
                {/* Legend */}
                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {Object.entries(NIVEAUX).map(([v, { label, color, bg }]) => (
                      <Chip
                        key={v}
                        label={`${v} — ${label}`}
                        size="small"
                        color={color as any}
                        variant="outlined"
                        sx={{ bgcolor: bg, fontSize: 11 }}
                      />
                    ))}
                  </Stack>
                </Box>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                          minWidth: 150,
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                        }}
                      >
                        Agent / Compétence
                      </TableCell>
                      {competenceList.map((c: any) => (
                        <TableCell
                          key={c.id}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            bgcolor: alpha(theme.palette.primary.main, 0.06),
                            minWidth: 120,
                          }}
                        >
                          <Tooltip title={c.description || ''} placement="top">
                            <Typography variant="caption" fontWeight={700} display="block">
                              {c.nom}
                            </Typography>
                          </Tooltip>
                          {c.obligatoire && (
                            <Chip label="Obligatoire" size="small" color="error" sx={{ fontSize: 9, height: 16 }} />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {personnel.map(p => (
                      <TableRow key={p.id} hover>
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            position: 'sticky',
                            left: 0,
                            bgcolor: 'background.paper',
                            zIndex: 1,
                          }}
                        >
                          {p.nom}
                        </TableCell>
                        {competenceList.map((c: any) => {
                          const nv = matrixMap[`${p.id}_${c.id}`] ?? 0
                          const info = NIVEAUX[nv] ?? NIVEAUX[0]
                          return (
                            <TableCell
                              key={c.id}
                              align="center"
                              sx={{ bgcolor: info.bg, transition: 'background-color 0.2s' }}
                            >
                              <Select
                                value={nv}
                                size="small"
                                variant="standard"
                                onChange={e => updateNiveau.mutate({
                                  pid: p.id,
                                  cid: c.id,
                                  niveau: Number(e.target.value),
                                })}
                                renderValue={(v) => (
                                  <Chip
                                    label={NIVEAUX[v as number]?.label}
                                    size="small"
                                    color={NIVEAUX[v as number]?.color}
                                    sx={{ fontSize: 11 }}
                                  />
                                )}
                                sx={{ fontSize: 12, minWidth: 90 }}
                                disableUnderline
                              >
                                {Object.entries(NIVEAUX).map(([v, { label }]) => (
                                  <MenuItem key={v} value={Number(v)}>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                                        {v}
                                      </Typography>
                                      <Typography variant="body2">{label}</Typography>
                                    </Stack>
                                  </MenuItem>
                                ))}
                              </Select>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Tab 1: Formations */}
      {tab === 1 && (fl ? <LoadingSpinner message="Chargement des formations..." /> : (
        formationsList.length === 0 ? (
          <Paper sx={{ py: 6, textAlign: 'center', borderRadius: 2 }}>
            <School sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>Aucune formation enregistrée</Typography>
            <Typography variant="body2" color="text.disabled" mb={3}>
              Commencez par créer une formation pour votre équipe.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog(true)}>
              Créer une formation
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={2.5}>
            {formationsList.map((f: any) => {
              const typeColor = FORMATION_TYPE_COLORS[f.type] ?? '#6b7280'
              const isFuture = f.date_debut && dayjs(f.date_debut).isAfter(dayjs())
              const isPast = f.date_fin && dayjs(f.date_fin).isBefore(dayjs())
              return (
                <Grid item xs={12} md={6} lg={4} key={f.id}>
                  <Card
                    sx={{
                      borderRadius: 2,
                      borderTop: `3px solid ${typeColor}`,
                      height: '100%',
                      '&:hover': { boxShadow: 3 },
                      transition: 'box-shadow 0.2s',
                    }}
                  >
                    <CardHeader
                      title={
                        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>
                          {f.titre}
                        </Typography>
                      }
                      subheader={
                        <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                          <Schedule fontSize="small" sx={{ color: 'text.disabled', fontSize: 14 }} />
                          <Typography variant="caption" color="text.secondary">
                            {f.date_debut ? dayjs(f.date_debut).format('DD/MM/YYYY') : '—'}
                            {f.date_fin ? ` → ${dayjs(f.date_fin).format('DD/MM/YYYY')}` : ''}
                          </Typography>
                        </Stack>
                      }
                      action={
                        <Stack spacing={0.5} alignItems="flex-end">
                          <Chip
                            label={f.type}
                            size="small"
                            sx={{
                              bgcolor: alpha(typeColor, 0.12),
                              color: typeColor,
                              fontWeight: 700,
                              fontSize: 11,
                              border: `1px solid ${alpha(typeColor, 0.3)}`,
                            }}
                          />
                          {isPast && <Chip icon={<CheckCircle />} label="Terminée" size="small" color="success" variant="outlined" sx={{ fontSize: 10 }} />}
                          {isFuture && <Chip icon={<EmojiEvents />} label="À venir" size="small" color="info" variant="outlined" sx={{ fontSize: 10 }} />}
                        </Stack>
                      }
                      sx={{ pb: 0, alignItems: 'flex-start' }}
                    />
                    {f.description && (
                      <CardContent sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          {f.description}
                        </Typography>
                      </CardContent>
                    )}
                    {f.participants_ids?.length > 0 && (
                      <Box sx={{ px: 2, pb: 2 }}>
                        <Chip
                          icon={<Groups fontSize="small" />}
                          label={`${f.participants_ids.length} participant${f.participants_ids.length > 1 ? 's' : ''}`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    )}
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )
      ))}

      {/* Tab 2: Suivi des Qualifications */}
      {tab === 2 && (ql ? <LoadingSpinner message="Chargement des qualifications..." /> : (
        <Box>
          {/* Filters */}
          <Stack direction="row" spacing={1} mb={2} alignItems="center">
            <Typography variant="body2" color="text.secondary">Filtrer par site :</Typography>
            {(['all', 'STE', 'STM'] as const).map(s => (
              <Chip
                key={s}
                label={s === 'all' ? 'Tous' : s === 'STE' ? 'E — STE' : 'M — STM'}
                onClick={() => setSiteFilter(s)}
                color={siteFilter === s ? 'primary' : 'default'}
                variant={siteFilter === s ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto !important' }}>
              {qualList.length} qualification{qualList.length !== 1 ? 's' : ''}
            </Typography>
          </Stack>

          {qualList.length === 0 ? (
            <Paper sx={{ py: 6, textAlign: 'center', borderRadius: 2 }}>
              <WorkspacePremium sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Aucune qualification enregistrée
              </Typography>
              <Typography variant="body2" color="text.disabled" mb={3}>
                Cliquez sur "Charger liste standard" pour pré-remplir avec les qualifications du laboratoire,
                ou créez des qualifications manuellement.
              </Typography>
              <Stack direction="row" spacing={2} justifyContent="center">
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => seedQuals.mutate()}
                  disabled={seedQuals.isPending}
                >
                  {seedQuals.isPending ? <CircularProgress size={18} /> : 'Charger liste standard'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => { setEditingQual(null); setQualDialog(true) }}
                >
                  Nouvelle qualification
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Card sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableCell sx={{ fontWeight: 700, minWidth: 280 }}>Libellé</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 90 }} align="center">Durée (h)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 120 }} align="center">Sites</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 110 }} align="center">Ré-évaluation</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>Responsable</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Fonctions</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 90 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {qualList.map((q) => (
                    <TableRow key={q.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{q.libelle}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        {q.duree_heures != null ? (
                          <Chip label={`${q.duree_heures}h`} size="small" variant="outlined" />
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          {q.sites.map(s => (
                            <Chip
                              key={s}
                              label={s === 'STE' ? 'E' : 'M'}
                              size="small"
                              color={s === 'STE' ? 'primary' : 'secondary'}
                              sx={{ fontSize: 10, height: 20, minWidth: 24 }}
                            />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        {q.reevaluation ? (
                          <Chip
                            icon={<NotificationsActive sx={{ fontSize: 14 }} />}
                            label="Oui"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ fontSize: 11 }}
                          />
                        ) : (
                          <Chip label="Non" size="small" color="default" variant="outlined" sx={{ fontSize: 11 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {q.responsable_nom ? (
                          <Typography variant="body2">{q.responsable_nom}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {q.fonctions_concernees.length > 0 ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {q.fonctions_concernees.map(fn => (
                              <Chip key={fn} label={fn} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {q.description ? (
                          <Tooltip title={q.description}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                              {q.description}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Modifier">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => { setEditingQual(q); setQualDialog(true) }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteConfirm(q.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </Box>
      ))}

      {/* Dialog nouvelle formation */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <School color="primary" />
            <Typography variant="h6">Nouvelle formation</Typography>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Titre *"
              fullWidth
              value={form.titre}
              onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={form.type}
                label="Type"
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {['interne', 'externe', 'e-learning', 'habilitation'].map(tp => (
                  <MenuItem key={tp} value={tp} sx={{ textTransform: 'capitalize' }}>{tp}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Date de début"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={form.date_debut}
                  onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Date de fin"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={form.date_fin}
                  onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                />
              </Grid>
            </Grid>
            <TextField
              label="Description"
              multiline
              rows={3}
              fullWidth
              placeholder="Objectifs, contenu, organisateur..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => createFormation.mutate(form)}
            disabled={!form.titre || createFormation.isPending}
          >
            {createFormation.isPending ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Qualification dialog */}
      <QualDialog
        open={qualDialog}
        initial={editingQual}
        onClose={() => { setQualDialog(false); setEditingQual(null) }}
        onSave={handleSaveQual}
        loading={createQual.isPending || updateQual.isPending}
      />

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Supprimer la qualification ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteConfirm !== null && deleteQual.mutate(deleteConfirm)}
            disabled={deleteQual.isPending}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default HRPage
