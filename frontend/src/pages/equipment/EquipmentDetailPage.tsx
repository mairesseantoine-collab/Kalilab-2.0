import React, { useState, useContext, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Box, Card, CardContent, Typography, Button, Tabs, Tab, TextField,
  CircularProgress, Alert, Snackbar, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, MenuItem, Stack, Tooltip,
  IconButton, Paper, Divider, Select, FormControl, InputLabel,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
} from '@mui/material'
import {
  ArrowBack, Block, QrCode2, Download, Add, Delete,
  Warning, CheckCircle, Build, AccessTime,
} from '@mui/icons-material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { DatePicker } from '@mui/x-date-pickers'
import dayjs, { Dayjs } from 'dayjs'
import QRCode from 'react-qr-code'
import PageHeader from '../../components/common/PageHeader'
import StatusChip from '../../components/common/StatusChip'
import { equipmentApi, Panne, Piece } from '../../api/equipment'
import { AuthContext } from '../../contexts/AuthContext'
import { Equipement, Calibration, Maintenance } from '../../types'

interface TabPanelProps { children?: React.ReactNode; index: number; value: number }
function TabPanel({ children, index, value }: TabPanelProps) {
  return <div hidden={value !== index}>{value === index && <Box sx={{ pt: 2 }}>{children}</Box>}</div>
}

const IMPACT_CONFIG = {
  faible:   { color: 'success' as const, label: 'Faible' },
  moyen:    { color: 'warning' as const, label: 'Moyen' },
  critique: { color: 'error'   as const, label: 'Critique' },
}

export default function EquipmentDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authCtx = useContext(AuthContext)
  const [tab, setTab] = useState(0)
  const qrRef = useRef<HTMLDivElement>(null)

  // ── Dialogs state ──────────────────────────────────────────────────────────
  const [calibDialog, setCalibDialog] = useState(false)
  const [maintDialog, setMaintDialog] = useState(false)
  const [qrDialog, setQrDialog]       = useState(false)
  const [panneDialog, setPanneDialog] = useState(false)
  const [resolvePanne, setResolvePanne] = useState<Panne | null>(null)
  const [pieceDialog, setPieceDialog] = useState(false)

  // ── Calibration form ───────────────────────────────────────────────────────
  const [calibDate, setCalibDate]         = useState<Dayjs | null>(dayjs())
  const [calibProchaine, setCalibProchaine] = useState<Dayjs | null>(dayjs().add(1, 'year'))
  const [calibRealise, setCalibRealise]   = useState('')
  const [calibResultat, setCalibResultat] = useState('conforme')
  const [calibNotes, setCalibNotes]       = useState('')

  // ── Maintenance form ───────────────────────────────────────────────────────
  const [maintType, setMaintType]   = useState('preventive')
  const [maintDate, setMaintDate]   = useState<Dayjs | null>(dayjs())
  const [maintDesc, setMaintDesc]   = useState('')
  const [maintRealise, setMaintRealise] = useState('')

  // ── Panne form ─────────────────────────────────────────────────────────────
  const [panneDebut, setPanneDebut]   = useState<Dayjs | null>(dayjs())
  const [panneDesc, setPanneDesc]     = useState('')
  const [panneCause, setPanneCause]   = useState('')
  const [panneImpact, setPanneImpact] = useState('moyen')
  const [panneSig, setPanneSig]       = useState('')
  const [resolveFin, setResolveFin]   = useState<Dayjs | null>(dayjs())
  const [resolveRes, setResolveRes]   = useState('')

  // ── Pièce form ─────────────────────────────────────────────────────────────
  const [pieceDesig, setPieceDesig] = useState('')
  const [pieceRef, setPieceRef]     = useState('')
  const [pieceQty, setPieceQty]     = useState('')
  const [pieceNotes, setPieceNotes] = useState('')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })
  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity })

  const eqId = Number(id)

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: eqData, isLoading, isError } = useQuery({
    queryKey: ['equipment', eqId],
    queryFn: () => equipmentApi.get(eqId),
    enabled: !!eqId,
  })
  const eq: Equipement | undefined = eqData?.data

  const { data: pannesData } = useQuery({
    queryKey: ['equipment-pannes', eqId],
    queryFn: () => equipmentApi.listPannes(eqId).then(r => r.data),
    enabled: !!eqId,
  })

  const { data: piecesData } = useQuery({
    queryKey: ['equipment-pieces', eqId],
    queryFn: () => equipmentApi.listPieces(eqId).then(r => r.data),
    enabled: !!eqId,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const calibMutation = useMutation({
    mutationFn: (data: Partial<Calibration>) => equipmentApi.addCalibration(eqId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', eqId] })
      setCalibDialog(false)
      showSnack('Calibration ajoutée.')
    },
    onError: () => showSnack('Erreur', 'error'),
  })

  const maintMutation = useMutation({
    mutationFn: (data: Partial<Maintenance>) => equipmentApi.addMaintenance(eqId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', eqId] })
      setMaintDialog(false)
      showSnack('Maintenance ajoutée.')
    },
    onError: () => showSnack('Erreur', 'error'),
  })

  const blockMutation = useMutation({
    mutationFn: () => equipmentApi.block(eqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', eqId] })
      showSnack('Équipement bloqué.')
    },
    onError: () => showSnack('Erreur', 'error'),
  })

  const panneMutation = useMutation({
    mutationFn: (data: any) => equipmentApi.createPanne(eqId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-pannes', eqId] })
      queryClient.invalidateQueries({ queryKey: ['equipment', eqId] })
      setPanneDialog(false)
      setPanneDesc(''); setPanneCause(''); setPanneSig('')
      showSnack('Panne enregistrée.')
    },
    onError: () => showSnack('Erreur', 'error'),
  })

  const resolveMutation = useMutation({
    mutationFn: (data: any) => equipmentApi.updatePanne(eqId, data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-pannes', eqId] })
      queryClient.invalidateQueries({ queryKey: ['equipment', eqId] })
      setResolvePanne(null)
      showSnack('Panne résolue, équipement remis en service.')
    },
    onError: () => showSnack('Erreur', 'error'),
  })

  const deletePanneMutation = useMutation({
    mutationFn: (panneId: number) => equipmentApi.deletePanne(eqId, panneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-pannes', eqId] })
      showSnack('Panne supprimée.')
    },
    onError: () => showSnack('Erreur', 'error'),
  })

  const pieceMutation = useMutation({
    mutationFn: (data: any) => equipmentApi.createPiece(eqId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-pieces', eqId] })
      setPieceDialog(false)
      setPieceDesig(''); setPieceRef(''); setPieceQty(''); setPieceNotes('')
      showSnack('Pièce ajoutée.')
    },
    onError: () => showSnack('Erreur', 'error'),
  })

  const deletePieceMutation = useMutation({
    mutationFn: (pieceId: number) => equipmentApi.deletePiece(eqId, pieceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-pieces', eqId] })
      showSnack('Pièce supprimée.')
    },
    onError: () => showSnack('Erreur', 'error'),
  })

  // ── Columns ────────────────────────────────────────────────────────────────
  const calibColumns: GridColDef[] = [
    { field: 'date_calibration', headerName: 'Date calib.', width: 130,
      renderCell: (p) => dayjs(p.value as string).format('DD/MM/YYYY') },
    { field: 'date_prochaine', headerName: 'Prochaine', width: 120,
      renderCell: (p) => p.value ? dayjs(p.value as string).format('DD/MM/YYYY') : '—' },
    { field: 'realise_par', headerName: 'Réalisé par', flex: 1 },
    { field: 'resultat', headerName: 'Résultat', width: 130,
      renderCell: (p) => <Chip label={p.value as string} color={p.value === 'conforme' ? 'success' : 'error'} size="small" /> },
    { field: 'notes', headerName: 'Notes', flex: 1 },
  ]

  const maintColumns: GridColDef[] = [
    { field: 'type_maintenance', headerName: 'Type', width: 120 },
    { field: 'date_planifiee', headerName: 'Planifiée', width: 120,
      renderCell: (p) => p.value ? dayjs(p.value as string).format('DD/MM/YYYY') : '—' },
    { field: 'date_realisation', headerName: 'Réalisée', width: 120,
      renderCell: (p) => p.value ? dayjs(p.value as string).format('DD/MM/YYYY') : '—' },
    { field: 'realise_par', headerName: 'Réalisé par', flex: 1 },
    { field: 'statut', headerName: 'Statut', width: 120,
      renderCell: (p) => <StatusChip status={p.value as string} /> },
  ]

  // ── QR Code download ───────────────────────────────────────────────────────
  const handleQrDownload = () => {
    if (!qrRef.current) return
    const svg = qrRef.current.querySelector('svg')
    if (!svg) return
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const img = new Image()
    img.onload = () => {
      canvas.getContext('2d')?.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.download = `QR_${eq?.numero_inventaire ?? eqId}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))
  }

  const qrUrl = `${window.location.origin}/equipment/${eqId}`

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (isError || !eq) return <Alert severity="error">Erreur de chargement</Alert>

  const calibrations: Calibration[] = (eqData?.data as any)?.calibrations ?? []
  const maintenances: Maintenance[] = (eqData?.data as any)?.maintenances ?? []
  const pannes: Panne[] = pannesData?.pannes ?? []
  const pieces: Piece[] = piecesData ?? []
  const mtbf = pannesData?.mtbf_jours

  return (
    <Box>
      <PageHeader
        title={eq.nom}
        breadcrumbs={[
          { label: 'Équipements', path: '/equipment' },
          { label: eq.nom },
        ]}
        action={authCtx?.hasRole('admin', 'responsable_technique') && eq.statut !== 'hors_service' ? {
          label: 'Bloquer',
          onClick: () => blockMutation.mutate(),
          icon: <Block />,
        } : undefined}
      />

      {/* Bouton QR code en-tête */}
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Button startIcon={<QrCode2 />} variant="outlined" size="small" onClick={() => setQrDialog(true)}>
          QR Code
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Fiche signalétique" />
        <Tab label="Calibrations" />
        <Tab label="Maintenances" />
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            Pannes
            {pannesData && pannesData.pannes_en_cours > 0 && (
              <Chip label={pannesData.pannes_en_cours} color="error" size="small" sx={{ ml: 0.5 }} />
            )}
          </Box>
        } />
        <Tab label="Pièces de rechange" />
      </Tabs>

      {/* ── Tab 0 : Fiche ─────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="h6" gutterBottom>Identification</Typography>
              {[
                ['Catégorie', eq.categorie],
                ['N° Inventaire', eq.numero_inventaire],
                ['Fabricant', eq.fabricant],
                ['Modèle', eq.modele],
                ['N° Série', eq.numero_serie],
                ['Localisation', eq.localisation],
              ].filter(([, v]) => v).map(([label, value]) => (
                <Box key={label as string} display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography color="text.secondary">{label}</Typography>
                  <Typography>{value}</Typography>
                </Box>
              ))}
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="h6" gutterBottom>État</Typography>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography color="text.secondary">Statut</Typography>
                <StatusChip status={eq.statut} />
              </Box>
              {eq.prochaine_calibration && (
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="text.secondary">Prochaine calibration</Typography>
                  <Typography>{dayjs(eq.prochaine_calibration).format('DD/MM/YYYY')}</Typography>
                </Box>
              )}
              {eq.prochaine_maintenance && (
                <Box display="flex" justifyContent="space-between">
                  <Typography color="text.secondary">Prochaine maintenance</Typography>
                  <Typography>{dayjs(eq.prochaine_maintenance).format('DD/MM/YYYY')}</Typography>
                </Box>
              )}
              {mtbf !== null && mtbf !== undefined && (
                <Box display="flex" justifyContent="space-between" mt={1}>
                  <Typography color="text.secondary">MTBF</Typography>
                  <Chip label={`${mtbf} j`} size="small" color={mtbf > 180 ? 'success' : mtbf > 60 ? 'warning' : 'error'} icon={<AccessTime />} />
                </Box>
              )}
            </CardContent></Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ── Tab 1 : Calibrations ──────────────────────────────────────────── */}
      <TabPanel value={tab} index={1}>
        <Box mb={2} display="flex" justifyContent="flex-end">
          <Button variant="outlined" onClick={() => setCalibDialog(true)}>Ajouter calibration</Button>
        </Box>
        <DataGrid rows={calibrations} columns={calibColumns} autoHeight disableRowSelectionOnClick pageSizeOptions={[10, 25]} sx={{ border: 0 }} />
      </TabPanel>

      {/* ── Tab 2 : Maintenances ──────────────────────────────────────────── */}
      <TabPanel value={tab} index={2}>
        <Box mb={2} display="flex" justifyContent="flex-end">
          <Button variant="outlined" onClick={() => setMaintDialog(true)}>Ajouter maintenance</Button>
        </Box>
        <DataGrid rows={maintenances} columns={maintColumns} autoHeight disableRowSelectionOnClick pageSizeOptions={[10, 25]} sx={{ border: 0 }} />
      </TabPanel>

      {/* ── Tab 3 : Pannes & MTBF ─────────────────────────────────────────── */}
      <TabPanel value={tab} index={3}>
        {/* KPI pannes */}
        {pannesData && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total pannes', value: pannesData.total_pannes, color: 'default' },
              { label: 'En cours', value: pannesData.pannes_en_cours, color: pannesData.pannes_en_cours > 0 ? 'error' : 'default' },
              { label: 'Temps d\'arrêt total', value: `${pannesData.total_downtime_heures} h`, color: 'default' },
              { label: 'MTBF', value: mtbf ? `${mtbf} jours` : 'N/A', color: 'default' },
            ].map(kpi => (
              <Grid item xs={6} md={3} key={kpi.label}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h5" color={kpi.color === 'error' ? 'error.main' : 'text.primary'}>
                    {kpi.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        <Box mb={2} display="flex" justifyContent="flex-end">
          <Button variant="outlined" color="error" startIcon={<Add />} onClick={() => setPanneDialog(true)}>
            Signaler une panne
          </Button>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Début</TableCell>
                <TableCell>Fin</TableCell>
                <TableCell>Durée</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Cause</TableCell>
                <TableCell>Impact</TableCell>
                <TableCell>Signalé par</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pannes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Aucune panne enregistrée</Typography>
                  </TableCell>
                </TableRow>
              )}
              {pannes.map(p => (
                <TableRow key={p.id} sx={{ backgroundColor: p.en_cours ? 'error.50' : 'inherit' }}>
                  <TableCell>{dayjs(p.date_debut).format('DD/MM/YYYY HH:mm')}</TableCell>
                  <TableCell>{p.date_fin ? dayjs(p.date_fin).format('DD/MM/YYYY HH:mm') : <Chip label="En cours" color="error" size="small" />}</TableCell>
                  <TableCell>{p.duree_heures ? `${p.duree_heures} h` : '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</TableCell>
                  <TableCell>{p.cause ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={IMPACT_CONFIG[p.impact]?.label ?? p.impact}
                      color={IMPACT_CONFIG[p.impact]?.color ?? 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{p.signale_par ?? '—'}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      {p.en_cours && (
                        <Tooltip title="Marquer résolue">
                          <IconButton size="small" color="success" onClick={() => setResolvePanne(p)}>
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={() => deletePanneMutation.mutate(p.id)}>
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
      </TabPanel>

      {/* ── Tab 4 : Pièces de rechange ────────────────────────────────────── */}
      <TabPanel value={tab} index={4}>
        <Box mb={2} display="flex" justifyContent="flex-end">
          <Button variant="outlined" startIcon={<Add />} onClick={() => setPieceDialog(true)}>
            Ajouter une pièce
          </Button>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Désignation</TableCell>
                <TableCell>Référence</TableCell>
                <TableCell>Qté min.</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="center">Suppr.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pieces.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Aucune pièce enregistrée</Typography>
                  </TableCell>
                </TableRow>
              )}
              {pieces.map(p => (
                <TableRow key={p.id} hover>
                  <TableCell>{p.designation}</TableCell>
                  <TableCell>{p.reference ?? '—'}</TableCell>
                  <TableCell>{p.quantite_min ?? '—'}</TableCell>
                  <TableCell>{p.notes ?? '—'}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => deletePieceMutation.mutate(p.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <Box mt={2}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/equipment')}>Retour</Button>
      </Box>

      {/* ── Dialog QR Code ─────────────────────────────────────────────────── */}
      <Dialog open={qrDialog} onClose={() => setQrDialog(false)} maxWidth="xs">
        <DialogTitle>QR Code — {eq.nom}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            N° inventaire : <strong>{eq.numero_inventaire}</strong>
          </Typography>
          <Box ref={qrRef} sx={{ display: 'inline-block', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <QRCode value={qrUrl} size={200} />
          </Box>
          <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
            {qrUrl}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialog(false)}>Fermer</Button>
          <Button variant="contained" startIcon={<Download />} onClick={handleQrDownload}>
            Télécharger PNG
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog Calibration ─────────────────────────────────────────────── */}
      <Dialog open={calibDialog} onClose={() => setCalibDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter calibration</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <DatePicker label="Date calibration" value={calibDate} onChange={setCalibDate} slotProps={{ textField: { fullWidth: true } }} />
            <DatePicker label="Prochaine" value={calibProchaine} onChange={setCalibProchaine} slotProps={{ textField: { fullWidth: true } }} />
            <TextField fullWidth label="Réalisé par" value={calibRealise} onChange={e => setCalibRealise(e.target.value)} />
            <TextField fullWidth select label="Résultat" value={calibResultat} onChange={e => setCalibResultat(e.target.value)}>
              <MenuItem value="conforme">Conforme</MenuItem>
              <MenuItem value="non_conforme">Non conforme</MenuItem>
            </TextField>
            <TextField fullWidth multiline rows={2} label="Notes" value={calibNotes} onChange={e => setCalibNotes(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalibDialog(false)}>Annuler</Button>
          <Button variant="contained" onClick={() => calibMutation.mutate({
            date_calibration: calibDate?.format('YYYY-MM-DD'),
            date_prochaine: calibProchaine?.format('YYYY-MM-DD'),
            realise_par: calibRealise, resultat: calibResultat, notes: calibNotes,
          })} disabled={calibMutation.isPending}>Ajouter</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog Maintenance ─────────────────────────────────────────────── */}
      <Dialog open={maintDialog} onClose={() => setMaintDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter maintenance</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField fullWidth select label="Type" value={maintType} onChange={e => setMaintType(e.target.value)}>
              <MenuItem value="preventive">Préventive</MenuItem>
              <MenuItem value="corrective">Corrective</MenuItem>
            </TextField>
            <DatePicker label="Date planifiée" value={maintDate} onChange={setMaintDate} slotProps={{ textField: { fullWidth: true } }} />
            <TextField fullWidth label="Réalisé par" value={maintRealise} onChange={e => setMaintRealise(e.target.value)} />
            <TextField fullWidth multiline rows={3} label="Description" value={maintDesc} onChange={e => setMaintDesc(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaintDialog(false)}>Annuler</Button>
          <Button variant="contained" onClick={() => maintMutation.mutate({
            type_maintenance: maintType, date_planifiee: maintDate?.format('YYYY-MM-DD'),
            description: maintDesc, realise_par: maintRealise, statut: 'planifiee',
          })} disabled={maintMutation.isPending}>Ajouter</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog Signaler panne ──────────────────────────────────────────── */}
      <Dialog open={panneDialog} onClose={() => setPanneDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>Signaler une panne</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <DatePicker label="Date/heure de début" value={panneDebut} onChange={setPanneDebut} slotProps={{ textField: { fullWidth: true } }} />
            <TextField fullWidth label="Description *" value={panneDesc} onChange={e => setPanneDesc(e.target.value)} multiline rows={2} />
            <TextField fullWidth label="Cause supposée" value={panneCause} onChange={e => setPanneCause(e.target.value)} />
            <TextField fullWidth select label="Impact" value={panneImpact} onChange={e => setPanneImpact(e.target.value)}>
              <MenuItem value="faible">Faible</MenuItem>
              <MenuItem value="moyen">Moyen</MenuItem>
              <MenuItem value="critique">Critique</MenuItem>
            </TextField>
            <TextField fullWidth label="Signalé par" value={panneSig} onChange={e => setPanneSig(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPanneDialog(false)}>Annuler</Button>
          <Button variant="contained" color="error" onClick={() => {
            if (!panneDesc) return
            panneMutation.mutate({
              date_debut: panneDebut?.toISOString() ?? new Date().toISOString(),
              description: panneDesc,
              cause: panneCause || undefined,
              impact: panneImpact,
              signale_par: panneSig || undefined,
            })
          }} disabled={panneMutation.isPending || !panneDesc}>Signaler</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog Résoudre panne ──────────────────────────────────────────── */}
      <Dialog open={!!resolvePanne} onClose={() => setResolvePanne(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'success.main' }}>Résoudre la panne</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <DatePicker label="Date/heure de résolution" value={resolveFin} onChange={setResolveFin} slotProps={{ textField: { fullWidth: true } }} />
            <TextField fullWidth label="Résolution / Action menée" value={resolveRes} onChange={e => setResolveRes(e.target.value)} multiline rows={3} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolvePanne(null)}>Annuler</Button>
          <Button variant="contained" color="success" onClick={() => {
            if (!resolvePanne) return
            resolveMutation.mutate({
              id: resolvePanne.id,
              date_fin: resolveFin?.toISOString() ?? new Date().toISOString(),
              resolution: resolveRes || undefined,
            })
          }} disabled={resolveMutation.isPending}>Marquer résolue</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog Pièce de rechange ───────────────────────────────────────── */}
      <Dialog open={pieceDialog} onClose={() => setPieceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter une pièce de rechange</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField fullWidth label="Désignation *" value={pieceDesig} onChange={e => setPieceDesig(e.target.value)} />
            <TextField fullWidth label="Référence fabricant" value={pieceRef} onChange={e => setPieceRef(e.target.value)} />
            <TextField fullWidth label="Quantité minimale" type="number" value={pieceQty} onChange={e => setPieceQty(e.target.value)} />
            <TextField fullWidth label="Notes" value={pieceNotes} onChange={e => setPieceNotes(e.target.value)} multiline rows={2} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPieceDialog(false)}>Annuler</Button>
          <Button variant="contained" onClick={() => {
            if (!pieceDesig) return
            pieceMutation.mutate({
              designation: pieceDesig,
              reference: pieceRef || undefined,
              quantite_min: pieceQty ? parseFloat(pieceQty) : undefined,
              notes: pieceNotes || undefined,
              article_id: undefined,
            })
          }} disabled={pieceMutation.isPending || !pieceDesig}>Ajouter</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
