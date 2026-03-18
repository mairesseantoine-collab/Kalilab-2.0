import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Tabs, Tab, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Chip, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, Snackbar,
  Stack, CircularProgress, Tooltip, LinearProgress, Divider,
  ToggleButton, ToggleButtonGroup, Card, CardContent, Badge,
} from '@mui/material'
import {
  Search, Download, Upload, Add, Edit, Delete, Person,
  CheckCircle, Cancel, FileDownload, Refresh, CloudUpload,
  TableChart, Warning,
} from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import dayjs from 'dayjs'
import { hrApi, PersonnelAnnuaire, ImportReport } from '../../api/hr'
import PageHeader from '../../components/common/PageHeader'

// ── Validation schema ─────────────────────────────────────────────────────────

const memberSchema = z.object({
  nom: z.string().min(1, 'Champ requis'),
  prenom: z.string().min(1, 'Champ requis'),
  fonction: z.string().min(1, 'Champ requis'),
  service: z.string().optional().or(z.literal('')),
  telephone_fixe: z.string().optional().or(z.literal('')),
  telephone_gsm: z.string().optional().or(z.literal('')),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  date_entree: z.string().min(1, 'Date d\'entrée requise'),
  date_sortie: z.string().optional().or(z.literal('')),
  badge: z.string().optional().or(z.literal('')),
  charte: z.string().optional().or(z.literal('')),
})

type MemberForm = z.infer<typeof memberSchema>

// ── Tab panel ─────────────────────────────────────────────────────────────────

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null
}

// ── Statut chip ───────────────────────────────────────────────────────────────

function StatutChip({ actif }: { actif: boolean }) {
  return actif
    ? <Chip label="Actif" color="success" size="small" icon={<CheckCircle />} />
    : <Chip label="Inactif" color="default" size="small" icon={<Cancel />} />
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HRAnnuairePage() {
  const [tab, setTab] = useState(0)
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' | 'info' }>({
    open: false, msg: '', severity: 'success',
  })

  const showSnack = (msg: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnack({ open: true, msg, severity })

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Annuaire RH"
        subtitle="Gestion du personnel — annuaire, import Excel, nouveau membre"
        icon={<Person fontSize="large" />}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Annuaire" />
          <Tab label="Nouveau membre" />
          <Tab label="Importer Excel" />
        </Tabs>
      </Box>

      <TabPanel value={tab} index={0}>
        <AnnuaireTab showSnack={showSnack} />
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <NouveauMembreTab showSnack={showSnack} onCreated={() => setTab(0)} />
      </TabPanel>
      <TabPanel value={tab} index={2}>
        <ImporterTab showSnack={showSnack} onImported={() => setTab(0)} />
      </TabPanel>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET 1 — ANNUAIRE
// ═══════════════════════════════════════════════════════════════════════════════

function AnnuaireTab({ showSnack }: { showSnack: (msg: string, sev?: any) => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterService, setFilterService] = useState('')
  const [filterActif, setFilterActif] = useState<string>('all')
  const [editMember, setEditMember] = useState<PersonnelAnnuaire | null>(null)
  const [deleteMember, setDeleteMember] = useState<PersonnelAnnuaire | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['annuaire', search, filterService, filterActif],
    queryFn: () => hrApi.listAnnuaire({
      search: search || undefined,
      service: filterService || undefined,
      actif: filterActif === 'all' ? undefined : filterActif,
    }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrApi.deleteAnnuaire(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annuaire'] })
      setDeleteMember(null)
      showSnack('Membre supprimé.')
    },
    onError: () => showSnack('Erreur lors de la suppression.', 'error'),
  })

  const handleExport = async () => {
    try {
      const resp = await hrApi.exportAnnuaireCsv({
        search: search || undefined,
        service: filterService || undefined,
        actif: filterActif === 'all' ? undefined : filterActif,
      })
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'annuaire_rh.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      showSnack('Erreur lors de l\'export.', 'error')
    }
  }

  const items = data?.items ?? []
  const services = data?.services ?? []

  return (
    <Box>
      {/* Filtres */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          size="small"
          placeholder="Recherche (nom, prénom, fonction…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Service</InputLabel>
          <Select value={filterService} label="Service" onChange={e => setFilterService(e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            {services.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <ToggleButtonGroup
          size="small"
          value={filterActif}
          exclusive
          onChange={(_, v) => v && setFilterActif(v)}
        >
          <ToggleButton value="all">Tous</ToggleButton>
          <ToggleButton value="true">Actifs</ToggleButton>
          <ToggleButton value="false">Inactifs</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          startIcon={<FileDownload />}
          onClick={handleExport}
          variant="outlined"
        >
          Exporter CSV
        </Button>
      </Stack>

      {/* Compteur */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {data?.total ?? 0} membre(s) trouvé(s)
      </Typography>

      {isLoading && <LinearProgress sx={{ mb: 1 }} />}

      {/* Tableau */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><strong>Nom</strong></TableCell>
              <TableCell><strong>Prénom</strong></TableCell>
              <TableCell><strong>Fonction</strong></TableCell>
              <TableCell><strong>Service</strong></TableCell>
              <TableCell><strong>GSM</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Entrée</strong></TableCell>
              <TableCell><strong>Sortie</strong></TableCell>
              <TableCell><strong>Badge</strong></TableCell>
              <TableCell><strong>Charte</strong></TableCell>
              <TableCell align="center"><strong>Statut</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={12} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    Aucun membre trouvé.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {items.map(p => (
              <TableRow key={p.id} hover>
                <TableCell>{p.nom}</TableCell>
                <TableCell>{p.prenom}</TableCell>
                <TableCell>{p.fonction}</TableCell>
                <TableCell>{p.service ?? <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                <TableCell>{p.telephone_gsm ?? '—'}</TableCell>
                <TableCell>
                  {p.email
                    ? <a href={`mailto:${p.email}`} style={{ color: 'inherit' }}>{p.email}</a>
                    : '—'}
                </TableCell>
                <TableCell>{p.date_entree ? dayjs(p.date_entree).format('DD/MM/YYYY') : '—'}</TableCell>
                <TableCell>{p.date_sortie ? dayjs(p.date_sortie).format('DD/MM/YYYY') : '—'}</TableCell>
                <TableCell>{p.badge ?? '—'}</TableCell>
                <TableCell>{p.charte ?? '—'}</TableCell>
                <TableCell align="center"><StatutChip actif={p.statut_actif} /></TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Tooltip title="Modifier">
                      <IconButton size="small" onClick={() => setEditMember(p)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" color="error" onClick={() => setDeleteMember(p)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog édition */}
      {editMember && (
        <EditMemberDialog
          member={editMember}
          services={services}
          onClose={() => setEditMember(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['annuaire'] })
            setEditMember(null)
            showSnack('Membre mis à jour.')
          }}
          onError={() => showSnack('Erreur lors de la mise à jour.', 'error')}
        />
      )}

      {/* Dialog suppression */}
      <Dialog open={!!deleteMember} onClose={() => setDeleteMember(null)} maxWidth="xs">
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Supprimer <strong>{deleteMember?.prenom} {deleteMember?.nom}</strong> de l'annuaire ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteMember(null)}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteMember && deleteMutation.mutate(deleteMember.id)}
            disabled={deleteMutation.isPending}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ── Dialog édition ────────────────────────────────────────────────────────────

function EditMemberDialog({
  member, services, onClose, onSaved, onError,
}: {
  member: PersonnelAnnuaire
  services: string[]
  onClose: () => void
  onSaved: () => void
  onError: () => void
}) {
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      nom: member.nom,
      prenom: member.prenom,
      fonction: member.fonction,
      service: member.service ?? '',
      telephone_fixe: member.telephone_fixe ?? '',
      telephone_gsm: member.telephone_gsm ?? '',
      email: member.email ?? '',
      date_entree: member.date_entree,
      date_sortie: member.date_sortie ?? '',
      badge: member.badge ?? '',
      charte: member.charte ?? '',
    },
  })

  const onSubmit = async (data: MemberForm) => {
    try {
      await hrApi.updateAnnuaire(member.id, {
        ...data,
        service: data.service || undefined,
        telephone_fixe: data.telephone_fixe || undefined,
        telephone_gsm: data.telephone_gsm || undefined,
        email: data.email || undefined,
        date_sortie: data.date_sortie || undefined,
        badge: data.badge || undefined,
        charte: data.charte || undefined,
      } as any)
      onSaved()
    } catch {
      onError()
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Modifier le membre</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <MemberFields register={register} control={control} errors={errors} services={services} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : 'Enregistrer'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET 2 — NOUVEAU MEMBRE
// ═══════════════════════════════════════════════════════════════════════════════

function NouveauMembreTab({
  showSnack, onCreated,
}: { showSnack: (msg: string, sev?: any) => void; onCreated: () => void }) {
  const qc = useQueryClient()

  const { data: annuaireData } = useQuery({
    queryKey: ['annuaire', '', '', 'all'],
    queryFn: () => hrApi.listAnnuaire({ limit: 1 }).then(r => r.data),
  })
  const services = annuaireData?.services ?? []

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      nom: '', prenom: '', fonction: '', service: '', telephone_fixe: '',
      telephone_gsm: '', email: '', date_entree: '', date_sortie: '', badge: '', charte: '',
    },
  })

  const onSubmit = async (data: MemberForm) => {
    try {
      await hrApi.createAnnuaire({
        ...data,
        service: data.service || undefined,
        telephone_fixe: data.telephone_fixe || undefined,
        telephone_gsm: data.telephone_gsm || undefined,
        email: data.email || undefined,
        date_sortie: data.date_sortie || undefined,
        badge: data.badge || undefined,
        charte: data.charte || undefined,
      } as any)
      qc.invalidateQueries({ queryKey: ['annuaire'] })
      showSnack('Membre créé avec succès.')
      reset()
      onCreated()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      showSnack(detail || 'Erreur lors de la création.', 'error')
    }
  }

  return (
    <Box maxWidth={680}>
      <Typography variant="h6" sx={{ mb: 2 }}>Nouveau membre du personnel</Typography>
      <form onSubmit={handleSubmit(onSubmit)}>
        <MemberFields register={register} control={control} errors={errors} services={services} />
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button type="submit" variant="contained" startIcon={<Add />} disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : 'Créer le membre'}
          </Button>
          <Button onClick={() => reset()} variant="outlined">Réinitialiser</Button>
        </Stack>
      </form>
    </Box>
  )
}

// ── Champs partagés (création + édition) ──────────────────────────────────────

function MemberFields({
  register, control, errors, services,
}: {
  register: any; control: any; errors: any; services: string[]
}) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          {...register('nom')}
          label="Nom *"
          fullWidth
          error={!!errors.nom}
          helperText={errors.nom?.message}
        />
        <TextField
          {...register('prenom')}
          label="Prénom *"
          fullWidth
          error={!!errors.prenom}
          helperText={errors.prenom?.message}
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          {...register('fonction')}
          label="Fonction *"
          fullWidth
          error={!!errors.fonction}
          helperText={errors.fonction?.message}
        />
        <Controller
          name="service"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel>Service</InputLabel>
              <Select {...field} label="Service">
                <MenuItem value="">— Non défini —</MenuItem>
                {services.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                <MenuItem value="BIOLOGISTES">BIOLOGISTES</MenuItem>
                <MenuItem value="INFIRMIERS">INFIRMIERS</MenuItem>
                <MenuItem value="TECHNOLOGUES DE LABORATOIRE MEDICAL">TECHNOLOGUES DE LABORATOIRE MEDICAL</MenuItem>
                <MenuItem value="COORDINATEUR QUALITE">COORDINATEUR QUALITE</MenuItem>
                <MenuItem value="INTERIMAIRES/ETUDIANTS">INTERIMAIRES/ETUDIANTS</MenuItem>
              </Select>
            </FormControl>
          )}
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          {...register('telephone_fixe')}
          label="Tél. fixe"
          fullWidth
          placeholder="02/555.12.34"
        />
        <TextField
          {...register('telephone_gsm')}
          label="GSM"
          fullWidth
          placeholder="0476/12.34.56"
        />
      </Stack>
      <TextField
        {...register('email')}
        label="Adresse mail"
        fullWidth
        type="email"
        error={!!errors.email}
        helperText={errors.email?.message}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          {...register('date_entree')}
          label="Date d'entrée *"
          fullWidth
          type="date"
          InputLabelProps={{ shrink: true }}
          error={!!errors.date_entree}
          helperText={errors.date_entree?.message}
        />
        <TextField
          {...register('date_sortie')}
          label="Date de sortie"
          fullWidth
          type="date"
          InputLabelProps={{ shrink: true }}
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          {...register('badge')}
          label="N° badge"
          fullWidth
        />
        <TextField
          {...register('charte')}
          label="Charte"
          fullWidth
          placeholder="ok, signée, oui…"
        />
      </Stack>
    </Stack>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET 3 — IMPORTER EXCEL
// ═══════════════════════════════════════════════════════════════════════════════

function ImporterTab({
  showSnack, onImported,
}: { showSnack: (msg: string, sev?: any) => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string[][] | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setReport(null)
    setPreview(null)
    if (f && (f.name.endsWith('.csv'))) {
      // CSV preview
      const text = await f.text()
      const lines = text.split('\n').slice(0, 11).map(l => l.split(','))
      setPreview(lines)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const resp = await hrApi.importAnnuaire(fd)
      setReport(resp.data)
      if (resp.data.errors.length === 0) {
        showSnack(`Import terminé : ${resp.data.created} créé(s), ${resp.data.updated} mis à jour.`)
        onImported()
      } else {
        showSnack(
          `Import terminé : ${resp.data.created} créé(s), ${resp.data.updated} mis à jour, ${resp.data.errors.length} erreur(s).`,
          'info',
        )
      }
    } catch (err: any) {
      showSnack(err?.response?.data?.detail || 'Erreur lors de l\'import.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadErrors = () => {
    if (!report?.error_csv_b64) return
    const bytes = atob(report.error_csv_b64)
    const blob = new Blob([bytes], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'erreurs_import.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadTemplate = async () => {
    try {
      const resp = await hrApi.downloadTemplate()
      const url = URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'template_annuaire_rh.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showSnack('Erreur lors du téléchargement.', 'error')
    }
  }

  return (
    <Box maxWidth={720}>
      <Typography variant="h6" sx={{ mb: 1 }}>Importer un fichier Excel ou CSV</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Colonnes attendues : Nom, Prénom, Fonction, N° téléphone fixe, N° téléphone GSM, Adresse mail,
        Entré(e) le, Date de sortie, N° badge, Charte. Les variantes d'intitulés sont acceptées.
      </Typography>

      {/* Télécharger template */}
      <Button
        startIcon={<TableChart />}
        variant="outlined"
        size="small"
        onClick={handleDownloadTemplate}
        sx={{ mb: 3 }}
      >
        Télécharger le modèle Excel
      </Button>

      {/* Upload zone */}
      <Card variant="outlined" sx={{ mb: 3, border: '2px dashed', borderColor: 'divider', cursor: 'pointer' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" sx={{ mb: 1 }}>
            {file ? file.name : 'Glissez un fichier .xlsx ou .csv ici'}
          </Typography>
          <Button variant="contained" component="label" startIcon={<Upload />}>
            Choisir un fichier
            <input
              type="file"
              hidden
              accept=".xlsx,.csv"
              onChange={handleFileChange}
            />
          </Button>
        </CardContent>
      </Card>

      {/* Aperçu CSV */}
      {preview && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Aperçu (10 premières lignes)</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
            <Table size="small">
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i} sx={{ backgroundColor: i === 0 ? 'action.hover' : 'inherit' }}>
                    {row.map((cell, j) => (
                      <TableCell key={j} sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Bouton import */}
      <Button
        variant="contained"
        color="primary"
        startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <FileDownload />}
        onClick={handleImport}
        disabled={!file || uploading}
        sx={{ mb: 3 }}
      >
        {uploading ? 'Import en cours…' : 'Lancer l\'import'}
      </Button>

      {/* Rapport */}
      {report && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            Rapport d'import
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Chip
              label={`${report.created} créé(s)`}
              color="success"
              icon={<CheckCircle />}
            />
            <Chip
              label={`${report.updated} mis à jour`}
              color="info"
              icon={<Refresh />}
            />
            {report.errors.length > 0 && (
              <Chip
                label={`${report.errors.length} erreur(s)`}
                color="error"
                icon={<Warning />}
              />
            )}
          </Stack>

          {report.errors.length > 0 && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {report.errors.length} ligne(s) ont été rejetées.
                <Button
                  size="small"
                  sx={{ ml: 2 }}
                  startIcon={<Download />}
                  onClick={handleDownloadErrors}
                >
                  Télécharger les erreurs (CSV)
                </Button>
              </Alert>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Ligne</strong></TableCell>
                      <TableCell><strong>Raison</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.ligne}</TableCell>
                        <TableCell sx={{ color: 'error.main' }}>{e.raison}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}
