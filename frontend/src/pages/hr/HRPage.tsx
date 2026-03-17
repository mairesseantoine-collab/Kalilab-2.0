import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Grid, Card, CardContent, CardHeader, Typography, Button, Tabs, Tab,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert, Snackbar, Tooltip,
  Paper, Stack, Divider, alpha, useTheme, IconButton, Switch, FormControlLabel,
  Autocomplete, Checkbox, ListItemText, OutlinedInput, Menu,
  TableContainer, Badge,
} from '@mui/material'
import {
  Add as AddIcon, School, CheckCircle, Schedule,
  Groups, EmojiEvents, WorkspacePremium, Edit as EditIcon,
  Delete as DeleteIcon, NotificationsActive, Refresh, Person,
  ArrowDropDown, Warning, CheckCircleOutline, HourglassEmpty,
  FiberManualRecord,
} from '@mui/icons-material'
import { hrApi, Qualification, PersonnelRH, CritereEvaluation } from '../../api/hr'
import PageHeader from '../../components/common/PageHeader'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import dayjs from 'dayjs'

// ── Constants ─────────────────────────────────────────────────────────────────

const FONCTIONS_BASE = [
  'Adjoint',
  'Aide-laborantin/Secrétaire',
  'Biologiste',
  'Coordinateur Laboratoire',
  'Coordinatrice qualité',
  'Directeur du laboratoire',
  'Gestionnaire Biosécurité',
  'Infirmier',
  'Magasinier',
  'Référent Métrologie',
  'Référent Qualité',
  'Technologue',
  'Technologue de nuit',
  'Technologue Microbio',
]


const SITES = [
  { value: 'STE', label: 'E — STE' },
  { value: 'STM', label: 'M — STM' },
  { value: 'both', label: 'Les deux sites' },
]

const FORMATION_TYPE_COLORS: Record<string, string> = {
  interne: '#3b82f6',
  externe: '#f97316',
  'e-learning': '#8b5cf6',
  habilitation: '#10b981',
}

const HAB_STATUS_CONFIG = {
  valid: { color: '#16a34a', bg: '#f0fdf4', label: 'Habilité', icon: <CheckCircleOutline sx={{ fontSize: 14 }} /> },
  expiring_soon: { color: '#d97706', bg: '#fffbeb', label: 'Expire bientôt', icon: <Warning sx={{ fontSize: 14 }} /> },
  expired: { color: '#dc2626', bg: '#fef2f2', label: 'Expiré', icon: <Warning sx={{ fontSize: 14 }} /> },
  not_habilitated: { color: '#9ca3af', bg: '#f9fafb', label: 'Non habilité', icon: <HourglassEmpty sx={{ fontSize: 14 }} /> },
}

const EMPTY_QUAL: Partial<Qualification> = {
  libelle: '',
  duree_heures: null,
  description: '',
  reevaluation: false,
  validite_mois: null,
  responsable_id: null,
  sites: [],
  fonctions_concernees: [],
  personnel_concerne: [],
  criteres_evaluation: [],
}

const EMPTY_PERSONNEL: Partial<PersonnelRH> = {
  nom: '',
  prenom: '',
  telephone: '',
  site: 'STE',
  fonction: '',
}

// ── Qualification Dialog ───────────────────────────────────────────────────────

interface QualDialogProps {
  open: boolean
  initial: Partial<Qualification> | null
  onClose: () => void
  onSave: (data: Partial<Qualification>) => void
  loading: boolean
  biologistes: { id: number; label: string }[]
  personnelList: PersonnelRH[]
}

const QualDialog: React.FC<QualDialogProps> = ({
  open, initial, onClose, onSave, loading, biologistes, personnelList,
}) => {
  const [form, setForm] = useState<Partial<Qualification>>(initial ?? EMPTY_QUAL)
  const [fonctionMenuAnchor, setFonctionMenuAnchor] = useState<null | HTMLElement>(null)

  React.useEffect(() => {
    if (!initial) { setForm(EMPTY_QUAL); return }
    // Normalise les anciennes valeurs de fonctions_concernees avec suffixe [E]/[M]
    const normalized = { ...initial }
    if (normalized.fonctions_concernees) {
      normalized.fonctions_concernees = normalized.fonctions_concernees.map(
        (f: string) => f.replace(/\s*\[(E|M)\]$/, '')
      )
    }
    setForm(normalized)
  }, [initial, open])

  const set = (key: keyof Qualification, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }))

  const selectedPersonnelIds: number[] = form.personnel_concerne ?? []
  const selectedPersonnel: PersonnelRH[] = personnelList.filter(p => selectedPersonnelIds.includes(p.id))

  const togglePersonnel = (p: PersonnelRH) => {
    const ids = selectedPersonnelIds.includes(p.id)
      ? selectedPersonnelIds.filter(id => id !== p.id)
      : [...selectedPersonnelIds, p.id]
    set('personnel_concerne', ids)
  }

  const selectByFonction = (fonctionBase: string) => {
    const toAdd = personnelList
      .filter(p => p.fonction.replace(/\s*\[(E|M)\]$/, '') === fonctionBase)
      .map(p => p.id)
    const current = selectedPersonnelIds
    const merged = Array.from(new Set([...current, ...toAdd]))
    set('personnel_concerne', merged)
    setFonctionMenuAnchor(null)
  }

  const criteres: CritereEvaluation[] = form.criteres_evaluation ?? []

  const addCritere = () => {
    set('criteres_evaluation', [...criteres, { descriptif: '', obligatoire: false }])
  }

  const updateCritere = (idx: number, field: keyof CritereEvaluation, value: unknown) => {
    const updated = criteres.map((c, i) => i === idx ? { ...c, [field]: value } : c)
    set('criteres_evaluation', updated)
  }

  const removeCritere = (idx: number) => {
    set('criteres_evaluation', criteres.filter((_, i) => i !== idx))
  }

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

          {/* Ré-évaluation toggle */}
          <Grid item xs={12} sm={6} display="flex" alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={!!form.reevaluation}
                  onChange={e => {
                    set('reevaluation', e.target.checked)
                    if (!e.target.checked) set('validite_mois', null)
                  }}
                  color="warning"
                />
              }
              label="Ré-évaluation requise"
            />
          </Grid>

          {/* Durée de validité — only if reevaluation=true */}
          {form.reevaluation && (
            <Grid item xs={12} sm={6}>
              <TextField
                label="Durée de validité (mois)"
                type="number"
                fullWidth
                value={form.validite_mois ?? ''}
                onChange={e => set('validite_mois', e.target.value ? Number(e.target.value) : null)}
                inputProps={{ min: 1, step: 1 }}
                helperText="Durée pendant laquelle l'habilitation est valide"
              />
            </Grid>
          )}

          {/* Sites */}
          <Grid item xs={12} sm={6}>
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

          {/* Responsable (biologiste only) */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Responsable (biologiste)</InputLabel>
              <Select
                value={form.responsable_id ?? ''}
                onChange={e => set('responsable_id', e.target.value || null)}
                input={<OutlinedInput label="Responsable (biologiste)" />}
              >
                <MenuItem value=""><em>Aucun</em></MenuItem>
                {biologistes.map(b => (
                  <MenuItem key={b.id} value={b.id}>{b.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Description */}
          <Grid item xs={12}>
            <TextField
              label="Description"
              multiline
              rows={2}
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
                MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
              >
                {FONCTIONS_BASE.map(fn => (
                  <MenuItem key={fn} value={fn}>
                    <Checkbox checked={(form.fonctions_concernees ?? []).includes(fn)} />
                    <ListItemText primary={fn} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Personnel concerné */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Personnel concerné
            </Typography>
            <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
              {selectedPersonnel.map(p => (
                <Chip
                  key={p.id}
                  label={`${p.prenom} ${p.nom}`}
                  size="small"
                  onDelete={() => togglePersonnel(p)}
                  color="primary"
                  variant="outlined"
                />
              ))}
              {selectedPersonnel.length === 0 && (
                <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  Aucun personnel sélectionné
                </Typography>
              )}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Autocomplete
                options={personnelList}
                getOptionLabel={p => `${p.prenom} ${p.nom} — ${p.fonction}`}
                sx={{ flex: 1 }}
                value={null}
                onChange={(_, p) => {
                  if (p) togglePersonnel(p as PersonnelRH)
                }}
                renderInput={params => (
                  <TextField {...params} label="Ajouter une personne" size="small" />
                )}
              />
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowDropDown />}
                onClick={e => setFonctionMenuAnchor(e.currentTarget)}
              >
                Tout sélectionner par fonction
              </Button>
            </Stack>
            <Menu
              anchorEl={fonctionMenuAnchor}
              open={Boolean(fonctionMenuAnchor)}
              onClose={() => setFonctionMenuAnchor(null)}
              PaperProps={{ style: { maxHeight: 320 } }}
            >
              {FONCTIONS_BASE.map(fn => (
                <MenuItem key={fn} onClick={() => selectByFonction(fn)}>
                  <Groups fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  {fn}
                </MenuItem>
              ))}
            </Menu>
          </Grid>

          {/* Critères d'évaluation */}
          <Grid item xs={12}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                Critères d'évaluation
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addCritere}>
                Ajouter un critère
              </Button>
            </Stack>
            {criteres.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                Aucun critère défini
              </Typography>
            ) : (
              <Stack spacing={1}>
                {criteres.map((c, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      placeholder="Descriptif du critère"
                      value={c.descriptif}
                      onChange={e => updateCritere(idx, 'descriptif', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={c.obligatoire}
                          onChange={e => updateCritere(idx, 'obligatoire', e.target.checked)}
                          color="error"
                        />
                      }
                      label={<Typography variant="caption">Obligatoire</Typography>}
                      sx={{ mr: 0, whiteSpace: 'nowrap' }}
                    />
                    <IconButton size="small" color="error" onClick={() => removeCritere(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
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

// ── Personnel Dialog ──────────────────────────────────────────────────────────

interface PersonnelDialogProps {
  open: boolean
  initial: Partial<PersonnelRH> | null
  onClose: () => void
  onSave: (data: Partial<PersonnelRH>) => void
  loading: boolean
}

const PersonnelDialog: React.FC<PersonnelDialogProps> = ({ open, initial, onClose, onSave, loading }) => {
  const [form, setForm] = useState<Partial<PersonnelRH>>(initial ?? EMPTY_PERSONNEL)

  React.useEffect(() => {
    if (!initial) { setForm(EMPTY_PERSONNEL); return }
    // Normalise les anciennes valeurs de fonction avec suffixe [E]/[M]
    const normalized = { ...initial }
    if (normalized.fonction) {
      normalized.fonction = normalized.fonction.replace(/\s*\[(E|M)\]$/, '')
    }
    setForm(normalized)
  }, [initial, open])

  const set = (key: keyof PersonnelRH, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Person color="primary" />
          <Typography variant="h6">
            {initial?.id ? 'Modifier le personnel' : 'Ajouter un membre du personnel'}
          </Typography>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Nom *"
              fullWidth
              value={form.nom ?? ''}
              onChange={e => set('nom', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Prénom *"
              fullWidth
              value={form.prenom ?? ''}
              onChange={e => set('prenom', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Téléphone"
              fullWidth
              value={form.telephone ?? ''}
              onChange={e => set('telephone', e.target.value)}
              placeholder="+32 xxx xx xx xx"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Site *</InputLabel>
              <Select
                value={form.site ?? 'STE'}
                onChange={e => set('site', e.target.value)}
                label="Site *"
              >
                {SITES.map(s => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Fonction *</InputLabel>
              <Select
                value={form.fonction ?? ''}
                onChange={e => set('fonction', e.target.value)}
                label="Fonction *"
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
              >
                {FONCTIONS_BASE.map(fn => (
                  <MenuItem key={fn} value={fn}>{fn}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Annuler</Button>
        <Button
          variant="contained"
          onClick={() => onSave(form)}
          disabled={!form.nom || !form.prenom || !form.fonction || loading}
          startIcon={loading ? <CircularProgress size={18} /> : undefined}
        >
          {initial?.id ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Habilitation cell popover dialog ──────────────────────────────────────────

interface HabCellDialogProps {
  open: boolean
  personnelNom: string
  qualLibelle: string
  habStatus: any
  onClose: () => void
  onSave: (date: string) => void
  onDelete: (habId: number) => void
  loading: boolean
}

const HabCellDialog: React.FC<HabCellDialogProps> = ({
  open, personnelNom, qualLibelle, habStatus, onClose, onSave, onDelete, loading
}) => {
  const [dateHab, setDateHab] = useState('')

  React.useEffect(() => {
    if (open) {
      setDateHab(habStatus?.date_habilitation
        ? dayjs(habStatus.date_habilitation).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD'))
    }
  }, [open, habStatus])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Enregistrer l'habilitation</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          <strong>{personnelNom}</strong> — {qualLibelle}
        </Typography>
        <TextField
          label="Date d'habilitation"
          type="date"
          fullWidth
          value={dateHab}
          onChange={e => setDateHab(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        {habStatus?.date_echeance && (
          <Typography variant="caption" color="text.secondary" mt={1} display="block">
            Échéance calculée : {dayjs(habStatus.date_echeance).format('DD/MM/YYYY')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {habStatus?.habilitation_id && (
          <Button
            color="error"
            onClick={() => onDelete(habStatus.habilitation_id)}
            disabled={loading}
            sx={{ mr: 'auto' }}
          >
            Supprimer
          </Button>
        )}
        <Button onClick={onClose} disabled={loading}>Annuler</Button>
        <Button
          variant="contained"
          onClick={() => onSave(dateHab)}
          disabled={!dateHab || loading}
        >
          {loading ? <CircularProgress size={18} /> : 'Enregistrer'}
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

  // Formation state
  const [formationDialog, setFormationDialog] = useState(false)
  const [formationForm, setFormationForm] = useState({
    titre: '', type: 'interne', date_debut: '', date_fin: '', description: '',
  })

  // Qualification state
  const [qualDialog, setQualDialog] = useState(false)
  const [editingQual, setEditingQual] = useState<Partial<Qualification> | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [siteFilter, setSiteFilter] = useState<'all' | 'STE' | 'STM'>('all')

  // Personnel state
  const [personnelDialog, setPersonnelDialog] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<Partial<PersonnelRH> | null>(null)
  const [deletePersonnelConfirm, setDeletePersonnelConfirm] = useState<number | null>(null)

  // Matrix state
  const [matrixSiteFilter, setMatrixSiteFilter] = useState<string>('STE')
  const [habCellDialog, setHabCellDialog] = useState<{
    open: boolean; personnelId: number; qualificationId: number;
    personnelNom: string; qualLibelle: string; habStatus: any
  }>({ open: false, personnelId: 0, qualificationId: 0, personnelNom: '', qualLibelle: '', habStatus: null })

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  const showMsg = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity })

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: formations, isLoading: fl } = useQuery({
    queryKey: ['hr-formations'],
    queryFn: () => hrApi.listFormations().then(r => r.data),
  })
  const { data: qualifications, isLoading: ql } = useQuery({
    queryKey: ['hr-qualifications'],
    queryFn: () => hrApi.listQualifications().then(r => r.data),
  })
  const { data: biologistes = [] } = useQuery({
    queryKey: ['hr-biologistes'],
    queryFn: () => hrApi.listBiologistes().then(r => r.data),
  })
  const { data: personnelRH = [], isLoading: pl } = useQuery({
    queryKey: ['hr-personnel-rh'],
    queryFn: () => hrApi.listPersonnelRH().then(r => r.data),
  })
  const { data: habMatrix, isLoading: hl } = useQuery({
    queryKey: ['hr-hab-matrix', matrixSiteFilter],
    queryFn: () => hrApi.getHabilitationMatrix(matrixSiteFilter || undefined).then(r => r.data),
    enabled: tab === 0,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createFormation = useMutation({
    mutationFn: (d: any) => hrApi.createFormation(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-formations'] })
      setFormationDialog(false)
      showMsg('Formation créée avec succès')
    },
    onError: () => showMsg('Erreur lors de la création', 'error'),
  })

  const createQual = useMutation({
    mutationFn: (d: Partial<Qualification>) => hrApi.createQualification(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-qualifications'] })
      setQualDialog(false); setEditingQual(null)
      showMsg('Qualification créée')
    },
    onError: () => showMsg('Erreur lors de la création', 'error'),
  })

  const updateQual = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Qualification> }) =>
      hrApi.updateQualification(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-qualifications'] })
      setQualDialog(false); setEditingQual(null)
      showMsg('Qualification mise à jour')
    },
    onError: () => showMsg('Erreur lors de la mise à jour', 'error'),
  })

  const deleteQual = useMutation({
    mutationFn: (id: number) => hrApi.deleteQualification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-qualifications'] })
      setDeleteConfirm(null)
      showMsg('Qualification supprimée')
    },
  })

  const seedQuals = useMutation({
    mutationFn: () => hrApi.seedQualifications(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['hr-qualifications'] })
      const d = (res as any).data
      showMsg(`${d.created} qualifications créées (${d.skipped} déjà existantes)`)
    },
    onError: () => showMsg('Erreur lors du chargement', 'error'),
  })

  const createPersonnel = useMutation({
    mutationFn: (d: Partial<PersonnelRH>) => hrApi.createPersonnelRH(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-personnel-rh'] })
      setPersonnelDialog(false); setEditingPersonnel(null)
      showMsg('Personnel ajouté')
    },
    onError: () => showMsg('Erreur lors de l\'ajout', 'error'),
  })

  const updatePersonnel = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PersonnelRH> }) =>
      hrApi.updatePersonnelRH(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-personnel-rh'] })
      setPersonnelDialog(false); setEditingPersonnel(null)
      showMsg('Personnel mis à jour')
    },
    onError: () => showMsg('Erreur lors de la mise à jour', 'error'),
  })

  const deletePersonnel = useMutation({
    mutationFn: (id: number) => hrApi.deletePersonnelRH(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-personnel-rh'] })
      setDeletePersonnelConfirm(null)
      showMsg('Personnel supprimé')
    },
  })

  const createHabilitation = useMutation({
    mutationFn: (d: { personnel_id: number; qualification_id: number; date_habilitation: string }) =>
      hrApi.createHabilitation(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-hab-matrix'] })
      setHabCellDialog(h => ({ ...h, open: false }))
      showMsg('Habilitation enregistrée')
    },
    onError: () => showMsg('Erreur lors de l\'enregistrement', 'error'),
  })

  const deleteHabilitation = useMutation({
    mutationFn: (id: number) => hrApi.deleteHabilitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-hab-matrix'] })
      setHabCellDialog(h => ({ ...h, open: false }))
      showMsg('Habilitation supprimée')
    },
  })

  // ── Derived data ──────────────────────────────────────────────────────────
  const formationsList: any[] = Array.isArray(formations) ? formations : []
  const qualList: Qualification[] = Array.isArray(qualifications)
    ? (siteFilter === 'all' ? qualifications : qualifications.filter(
        (q: Qualification) => q.sites.includes(siteFilter)
      ))
    : []
  const personnelList: PersonnelRH[] = Array.isArray(personnelRH) ? personnelRH : []

  // Build habilitation matrix lookup
  const habLookup: Record<string, any> = {}
  if (habMatrix?.habilitations) {
    habMatrix.habilitations.forEach(h => {
      habLookup[`${h.personnel_id}_${h.qualification_id}`] = h
    })
  }

  const handleSaveQual = (data: Partial<Qualification>) => {
    if (editingQual?.id) updateQual.mutate({ id: editingQual.id, data })
    else createQual.mutate(data)
  }

  const handleSavePersonnel = (data: Partial<PersonnelRH>) => {
    if (editingPersonnel?.id) updatePersonnel.mutate({ id: editingPersonnel.id, data })
    else createPersonnel.mutate(data)
  }

  const openHabCell = (personnelId: number, qualId: number, personnelNom: string, qualLibelle: string) => {
    const habStatus = habLookup[`${personnelId}_${qualId}`] ?? null
    setHabCellDialog({ open: true, personnelId, qualificationId: qualId, personnelNom, qualLibelle, habStatus })
  }

  // Stats for matrix
  const expiredCount = habMatrix?.habilitations.filter(h => h.status === 'expired').length ?? 0
  const expiringSoonCount = habMatrix?.habilitations.filter(h => h.status === 'expiring_soon').length ?? 0

  return (
    <Box>
      <PageHeader
        title="Ressources humaines"
        subtitle="Compétences, habilitations et formations"
        actionButton={
          tab === 1 ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormationDialog(true)}>
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
          ) : tab === 3 ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setEditingPersonnel(null); setPersonnelDialog(true) }}
            >
              Ajouter du personnel
            </Button>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, '& .MuiTabs-indicator': { height: 3 }, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        <Tab
          icon={
            expiredCount > 0 || expiringSoonCount > 0
              ? <Badge badgeContent={expiredCount + expiringSoonCount} color="error"><Groups fontSize="small" /></Badge>
              : <Groups fontSize="small" />
          }
          iconPosition="start"
          label="Matrice des habilitations"
        />
        <Tab icon={<School fontSize="small" />} iconPosition="start" label="Formations" />
        <Tab icon={<WorkspacePremium fontSize="small" />} iconPosition="start" label="Suivi des Qualifications" />
        <Tab icon={<Person fontSize="small" />} iconPosition="start" label="Personnel" />
      </Tabs>

      {/* ── Tab 0: Habilitation matrix ── */}
      {tab === 0 && (
        <Box>
          {/* Site filter + legend */}
          <Stack direction="row" spacing={2} mb={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Site :</Typography>
              {(['STE', 'STM'] as const).map(s => (
                <Chip
                  key={s}
                  label={s === 'STE' ? 'E — STE' : 'M — STM'}
                  onClick={() => setMatrixSiteFilter(s)}
                  color={matrixSiteFilter === s ? 'primary' : 'default'}
                  variant={matrixSiteFilter === s ? 'filled' : 'outlined'}
                  size="small"
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ ml: 'auto !important' }}>
              {Object.entries(HAB_STATUS_CONFIG).map(([key, cfg]) => (
                <Chip
                  key={key}
                  icon={React.cloneElement(cfg.icon, { sx: { color: `${cfg.color} !important`, fontSize: 14 } })}
                  label={cfg.label}
                  size="small"
                  sx={{ bgcolor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, fontSize: 11 }}
                />
              ))}
            </Stack>
          </Stack>

          {expiredCount > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>{expiredCount}</strong> habilitation{expiredCount > 1 ? 's' : ''} expirée{expiredCount > 1 ? 's' : ''}
              {expiringSoonCount > 0 && ` · ${expiringSoonCount} expirant bientôt`}
            </Alert>
          )}
          {expiredCount === 0 && expiringSoonCount > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>{expiringSoonCount}</strong> habilitation{expiringSoonCount > 1 ? 's' : ''} expirant bientôt
            </Alert>
          )}

          {hl ? <LoadingSpinner message="Chargement de la matrice..." /> : (
            !habMatrix || habMatrix.personnel.length === 0 ? (
              <Paper sx={{ py: 6, textAlign: 'center', borderRadius: 2 }}>
                <Groups sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Aucune donnée d'habilitation
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  Ajoutez du personnel dans l'onglet "Personnel" et enregistrez des qualifications avec le personnel concerné.
                </Typography>
              </Paper>
            ) : (
              <Card sx={{ borderRadius: 2 }}>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            minWidth: 160,
                            position: 'sticky',
                            left: 0,
                            zIndex: 3,
                          }}
                        >
                          Personnel
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            minWidth: 120,
                            position: 'sticky',
                            left: 160,
                            zIndex: 3,
                          }}
                        >
                          Fonction
                        </TableCell>
                        {habMatrix.qualifications.map(q => (
                          <TableCell
                            key={q.id}
                            align="center"
                            sx={{
                              fontWeight: 600,
                              bgcolor: alpha(theme.palette.primary.main, 0.08),
                              minWidth: 110,
                              maxWidth: 140,
                              fontSize: 11,
                            }}
                          >
                            <Tooltip title={q.libelle} placement="top">
                              <Typography variant="caption" fontWeight={700} display="block" noWrap sx={{ maxWidth: 120 }}>
                                {q.libelle.replace(/^\[.\] - /, '')}
                              </Typography>
                            </Tooltip>
                            {q.reevaluation && q.validite_mois && (
                              <Typography variant="caption" color="text.disabled" display="block">
                                {q.validite_mois} mois
                              </Typography>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {habMatrix.personnel.map(p => (
                        <TableRow key={p.id} hover>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              position: 'sticky',
                              left: 0,
                              bgcolor: 'background.paper',
                              zIndex: 1,
                              minWidth: 160,
                            }}
                          >
                            {p.prenom} {p.nom}
                          </TableCell>
                          <TableCell
                            sx={{
                              position: 'sticky',
                              left: 160,
                              bgcolor: 'background.paper',
                              zIndex: 1,
                              minWidth: 120,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {p.fonction}
                            </Typography>
                          </TableCell>
                          {habMatrix.qualifications.map(q => {
                            const hab = habLookup[`${p.id}_${q.id}`]
                            if (!hab) {
                              // Person not concerned by this qualification
                              return (
                                <TableCell key={q.id} align="center" sx={{ bgcolor: '#fafafa' }}>
                                  <Typography variant="caption" color="text.disabled">—</Typography>
                                </TableCell>
                              )
                            }
                            const cfg = HAB_STATUS_CONFIG[hab.status as keyof typeof HAB_STATUS_CONFIG]
                            return (
                              <TableCell
                                key={q.id}
                                align="center"
                                sx={{
                                  bgcolor: cfg.bg,
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s',
                                  '&:hover': { filter: 'brightness(0.95)' },
                                }}
                                onClick={() => openHabCell(p.id, q.id, `${p.prenom} ${p.nom}`, q.libelle)}
                              >
                                <Tooltip
                                  title={
                                    hab.date_habilitation
                                      ? `Habilité le ${dayjs(hab.date_habilitation).format('DD/MM/YYYY')}${hab.date_echeance ? ` · Échéance: ${dayjs(hab.date_echeance).format('DD/MM/YYYY')}` : ''}`
                                      : 'Cliquer pour enregistrer'
                                  }
                                  placement="top"
                                >
                                  <Stack alignItems="center" spacing={0.2}>
                                    <FiberManualRecord sx={{ fontSize: 10, color: cfg.color }} />
                                    {hab.date_habilitation && (
                                      <Typography variant="caption" sx={{ color: cfg.color, fontSize: 10 }}>
                                        {dayjs(hab.date_habilitation).format('MM/YY')}
                                      </Typography>
                                    )}
                                    {hab.status === 'not_habilitated' && (
                                      <Typography variant="caption" sx={{ color: cfg.color, fontSize: 10 }}>
                                        +
                                      </Typography>
                                    )}
                                  </Stack>
                                </Tooltip>
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            )
          )}
        </Box>
      )}

      {/* ── Tab 1: Formations ── */}
      {tab === 1 && (fl ? <LoadingSpinner message="Chargement des formations..." /> : (
        formationsList.length === 0 ? (
          <Paper sx={{ py: 6, textAlign: 'center', borderRadius: 2 }}>
            <School sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>Aucune formation enregistrée</Typography>
            <Typography variant="body2" color="text.disabled" mb={3}>
              Commencez par créer une formation pour votre équipe.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormationDialog(true)}>
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
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )
      ))}

      {/* ── Tab 2: Suivi des Qualifications ── */}
      {tab === 2 && (ql ? <LoadingSpinner message="Chargement des qualifications..." /> : (
        <Box>
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
                Cliquez sur "Charger liste standard" pour pré-remplir avec les qualifications du laboratoire.
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
                    <TableCell sx={{ fontWeight: 700, width: 90 }} align="center">Validité</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 120 }} align="center">Sites</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 110 }} align="center">Ré-évaluation</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>Responsable</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Fonctions</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 80 }} align="center">Critères</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 90 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {qualList.map((q) => (
                    <TableRow key={q.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{q.libelle}</Typography>
                        {q.description && (
                          <Tooltip title={q.description}>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 260 }}>
                              {q.description}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {q.reevaluation && q.validite_mois ? (
                          <Chip label={`${q.validite_mois} mois`} size="small" color="warning" variant="outlined" />
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
                        {q.responsable_nom
                          ? <Typography variant="body2">{q.responsable_nom}</Typography>
                          : <Typography variant="body2" color="text.disabled">—</Typography>
                        }
                      </TableCell>
                      <TableCell>
                        {q.fonctions_concernees.length > 0 ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {q.fonctions_concernees.slice(0, 3).map(fn => (
                              <Chip key={fn} label={fn} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                            ))}
                            {q.fonctions_concernees.length > 3 && (
                              <Chip label={`+${q.fonctions_concernees.length - 3}`} size="small" sx={{ fontSize: 10, height: 20 }} />
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {q.criteres_evaluation.length > 0 ? (
                          <Tooltip title={q.criteres_evaluation.map(c => `${c.obligatoire ? '★' : '○'} ${c.descriptif}`).join('\n')}>
                            <Chip
                              label={q.criteres_evaluation.length}
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ fontSize: 11 }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Modifier">
                            <IconButton size="small" color="primary"
                              onClick={() => { setEditingQual(q); setQualDialog(true) }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" color="error"
                              onClick={() => setDeleteConfirm(q.id)}>
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

      {/* ── Tab 3: Personnel ── */}
      {tab === 3 && (pl ? <LoadingSpinner message="Chargement du personnel..." /> : (
        <Box>
          {personnelList.length === 0 ? (
            <Paper sx={{ py: 6, textAlign: 'center', borderRadius: 2 }}>
              <Person sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Aucun personnel enregistré
              </Typography>
              <Typography variant="body2" color="text.disabled" mb={3}>
                Enregistrez les membres du personnel pour les associer aux qualifications.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => { setEditingPersonnel(null); setPersonnelDialog(true) }}
              >
                Ajouter du personnel
              </Button>
            </Paper>
          ) : (
            <Card sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableCell sx={{ fontWeight: 700 }}>Nom</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Prénom</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Fonction</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 100 }} align="center">Site</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Téléphone</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 90 }} align="center">Statut</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 90 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {personnelList.map(p => (
                    <TableRow key={p.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{p.nom}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{p.prenom}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{p.fonction}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={p.site === 'both' ? 'E+M' : p.site === 'STE' ? 'E' : 'M'}
                          size="small"
                          color={p.site === 'STE' ? 'primary' : p.site === 'STM' ? 'secondary' : 'default'}
                          sx={{ fontSize: 10, height: 20, minWidth: 28 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={p.telephone ? 'text.primary' : 'text.disabled'}>
                          {p.telephone || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={p.actif ? 'Actif' : 'Inactif'}
                          size="small"
                          color={p.actif ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ fontSize: 11 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Modifier">
                            <IconButton size="small" color="primary"
                              onClick={() => { setEditingPersonnel(p); setPersonnelDialog(true) }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" color="error"
                              onClick={() => setDeletePersonnelConfirm(p.id)}>
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

      {/* ── Formation dialog ── */}
      <Dialog open={formationDialog} onClose={() => setFormationDialog(false)} maxWidth="sm" fullWidth>
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
              value={formationForm.titre}
              onChange={e => setFormationForm(f => ({ ...f, titre: e.target.value }))}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formationForm.type}
                label="Type"
                onChange={e => setFormationForm(f => ({ ...f, type: e.target.value }))}
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
                  value={formationForm.date_debut}
                  onChange={e => setFormationForm(f => ({ ...f, date_debut: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Date de fin"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={formationForm.date_fin}
                  onChange={e => setFormationForm(f => ({ ...f, date_fin: e.target.value }))}
                />
              </Grid>
            </Grid>
            <TextField
              label="Description"
              multiline
              rows={3}
              fullWidth
              value={formationForm.description}
              onChange={e => setFormationForm(f => ({ ...f, description: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormationDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => createFormation.mutate(formationForm)}
            disabled={!formationForm.titre || createFormation.isPending}
          >
            {createFormation.isPending ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Qualification dialog ── */}
      <QualDialog
        open={qualDialog}
        initial={editingQual}
        onClose={() => { setQualDialog(false); setEditingQual(null) }}
        onSave={handleSaveQual}
        loading={createQual.isPending || updateQual.isPending}
        biologistes={biologistes as { id: number; label: string }[]}
        personnelList={personnelList}
      />

      {/* ── Personnel dialog ── */}
      <PersonnelDialog
        open={personnelDialog}
        initial={editingPersonnel}
        onClose={() => { setPersonnelDialog(false); setEditingPersonnel(null) }}
        onSave={handleSavePersonnel}
        loading={createPersonnel.isPending || updatePersonnel.isPending}
      />

      {/* ── Habilitation cell dialog ── */}
      <HabCellDialog
        open={habCellDialog.open}
        personnelNom={habCellDialog.personnelNom}
        qualLibelle={habCellDialog.qualLibelle}
        habStatus={habCellDialog.habStatus}
        onClose={() => setHabCellDialog(h => ({ ...h, open: false }))}
        onSave={(dateHab) => createHabilitation.mutate({
          personnel_id: habCellDialog.personnelId,
          qualification_id: habCellDialog.qualificationId,
          date_habilitation: dateHab,
        })}
        onDelete={(habId) => deleteHabilitation.mutate(habId)}
        loading={createHabilitation.isPending || deleteHabilitation.isPending}
      />

      {/* ── Delete confirm dialogs ── */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Supprimer la qualification ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Cette action est irréversible.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button color="error" variant="contained"
            onClick={() => deleteConfirm !== null && deleteQual.mutate(deleteConfirm)}
            disabled={deleteQual.isPending}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deletePersonnelConfirm !== null} onClose={() => setDeletePersonnelConfirm(null)} maxWidth="xs">
        <DialogTitle>Supprimer ce membre du personnel ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Cette action est irréversible.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletePersonnelConfirm(null)}>Annuler</Button>
          <Button color="error" variant="contained"
            onClick={() => deletePersonnelConfirm !== null && deletePersonnel.mutate(deletePersonnelConfirm)}
            disabled={deletePersonnel.isPending}>
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
