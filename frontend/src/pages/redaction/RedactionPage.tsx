import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Grid, Card, CardContent, CardHeader, Typography, Button, Tabs, Tab,
  List, ListItem, ListItemText, ListItemButton, Divider, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Snackbar, Chip, IconButton, FormControl, InputLabel, Select, MenuItem,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Save as SaveIcon,
  Download as DownloadIcon, ExpandMore as ExpandMoreIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { redactionApi } from '../../api/redaction'
import PageHeader from '../../components/common/PageHeader'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// ── IPR color helper ──────────────────────────────────────────────────────────
const iprBg = (ipr: number) =>
  ipr <= 10 ? '#C6EFCE' : ipr <= 100 ? '#FFEB9C' : '#FFC7CE'

const SCORE_OPTIONS = [1, 5, 10]
const DECISION_OPTIONS = ['A', 'R', 'S', 'M', 'AS']
const DECISION_LABELS: Record<string, string> = {
  A: 'Accepter', R: 'Réduire', S: 'Supprimer', M: 'Maintenir', AS: 'À surveiller',
}
const STATUT_AMDEC: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' }> = {
  brouillon: { label: 'Brouillon', color: 'default' },
  en_verification: { label: 'En vérification', color: 'warning' },
  valide: { label: 'Validé', color: 'info' },
  approuve: { label: 'Approuvé', color: 'success' },
}

// ── AMDEC Risk Row ─────────────────────────────────────────────────────────────
const AmdecRow: React.FC<{
  item: any; onChange: (item: any) => void; onRemove: () => void
}> = ({ item, onChange, onRemove }) => {
  const G = Number(item.G ?? 1), F = Number(item.F ?? 1), D = Number(item.D ?? 1)
  const Gp = Number(item.Gp ?? G), Fp = Number(item.Fp ?? F), Dp = Number(item.Dp ?? D)
  const ipr = G * F * D
  const ipr_p = Gp * Fp * Dp
  const upd = (k: string, v: any) => onChange({ ...item, [k]: v })

  const scoreCell = (val: number, key: string) => (
    <TableCell sx={{ p: '2px', width: 42, minWidth: 42 }}>
      <Select value={val} size='small' onChange={e => upd(key, Number(e.target.value))}
        sx={{ fontSize: 11, height: 28, width: '100%', '.MuiSelect-select': { p: '2px 4px' } }}>
        {SCORE_OPTIONS.map(v => <MenuItem key={v} value={v} sx={{ fontSize: 11 }}>{v}</MenuItem>)}
      </Select>
    </TableCell>
  )

  const textCell = (val: string, key: string, width = 130) => (
    <TableCell sx={{ p: '2px', width, minWidth: width }}>
      <TextField value={val} onChange={e => upd(key, e.target.value)}
        size='small' multiline
        sx={{ width: '100%', '& .MuiInputBase-input': { fontSize: 11, p: '3px 6px' } }} />
    </TableCell>
  )

  return (
    <TableRow sx={{ verticalAlign: 'top' }}>
      {textCell(item.sous_item ?? '', 'sous_item', 140)}
      {textCell(item.consequence ?? '', 'consequence', 140)}
      {textCell(item.barriere ?? '', 'barriere', 140)}
      {scoreCell(G, 'G')}
      {scoreCell(F, 'F')}
      {scoreCell(D, 'D')}
      <TableCell sx={{ p: '2px', width: 44, minWidth: 44, bgcolor: iprBg(ipr), textAlign: 'center', fontWeight: 700, fontSize: 12 }}>{ipr}</TableCell>
      {textCell(item.action ?? '', 'action', 140)}
      <TableCell sx={{ p: '2px', width: 90, minWidth: 90 }}>
        <Select value={item.decision ?? 'A'} size='small' onChange={e => upd('decision', e.target.value)}
          sx={{ fontSize: 11, height: 28, width: '100%', '.MuiSelect-select': { p: '2px 4px' } }}>
          {DECISION_OPTIONS.map(d => <MenuItem key={d} value={d} sx={{ fontSize: 11 }}>{d} – {DECISION_LABELS[d]}</MenuItem>)}
        </Select>
      </TableCell>
      {scoreCell(Gp, 'Gp')}
      {scoreCell(Fp, 'Fp')}
      {scoreCell(Dp, 'Dp')}
      <TableCell sx={{ p: '2px', width: 44, minWidth: 44, bgcolor: iprBg(ipr_p), textAlign: 'center', fontWeight: 700, fontSize: 12 }}>{ipr_p}</TableCell>
      <TableCell sx={{ p: '2px', width: 36 }}>
        <IconButton size='small' onClick={onRemove} color='error'><DeleteIcon fontSize='small' /></IconButton>
      </TableCell>
    </TableRow>
  )
}

// ── AMDEC Category Table ───────────────────────────────────────────────────────
const AmdecCategoryTable: React.FC<{
  category: any; onUpdate: (cat: any) => void
}> = ({ category, onUpdate }) => {
  const items: any[] = category.items ?? []

  const updateItem = (i: number, newItem: any) => {
    const updated = items.map((it, idx) => idx === i ? newItem : it)
    onUpdate({ ...category, items: updated })
  }
  const removeItem = (i: number) => onUpdate({ ...category, items: items.filter((_, idx) => idx !== i) })
  const addItem = () => onUpdate({
    ...category,
    items: [...items, { sous_item: '', consequence: '', barriere: '', G: 1, F: 1, D: 1, action: '', decision: 'A', Gp: 1, Fp: 1, Dp: 1 }]
  })

  const TH_STYLE = { fontSize: 10, fontWeight: 700, bgcolor: '#1F497D', color: '#fff', p: '4px 6px', whiteSpace: 'nowrap' as const }

  return (
    <Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size='small' sx={{ minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...TH_STYLE, width: 140 }}>Sous-item / Risque</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 140 }}>Conséquence</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 140 }}>Barrières préventives</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 42 }}>G</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 42 }}>F</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 42 }}>D</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 44 }}>IPR</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 140 }}>Actions à mettre en œuvre</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 90 }}>Décision</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 42 }}>G'</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 42 }}>F'</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 42 }}>D'</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 44 }}>IPR'</TableCell>
              <TableCell sx={{ ...TH_STYLE, width: 36 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((it, i) => (
              <AmdecRow key={i} item={it} onChange={newItem => updateItem(i, newItem)} onRemove={() => removeItem(i)} />
            ))}
          </TableBody>
        </Table>
      </Box>
      <Button size='small' startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={addItem}>
        Ajouter un risque
      </Button>
    </Box>
  )
}

// ── AMDEC Tab ─────────────────────────────────────────────────────────────────
const AmdecTab: React.FC = () => {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [amdecData, setAmdecData] = useState<any>(null)
  const [catTab, setCatTab] = useState(0)
  const [newDialog, setNewDialog] = useState(false)
  const [newForm, setNewForm] = useState({ analyseur: '', type_analyseur: '' })
  const [workflowDialog, setWorkflowDialog] = useState(false)
  const [workflowNom, setWorkflowNom] = useState('')
  const [workflowComment, setWorkflowComment] = useState('')
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as 'success' | 'error' })
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data: amdecList, isLoading } = useQuery({
    queryKey: ['amdec-list'],
    queryFn: () => redactionApi.listAmdec().then(r => r.data),
  })
  const { data: detail } = useQuery({
    queryKey: ['amdec', selectedId],
    queryFn: () => redactionApi.getAmdec(selectedId!).then(r => r.data),
    enabled: !!selectedId,
  })

  React.useEffect(() => {
    if (detail?.data) setAmdecData(detail.data)
  }, [detail])

  const createMutation = useMutation({
    mutationFn: (d: any) => redactionApi.createAmdec(d),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['amdec-list'] })
      setNewDialog(false)
      setSelectedId(res.data.id)
      setSnack({ open: true, msg: 'AMDEC créée', sev: 'success' })
    },
  })
  const workflowMutation = useMutation({
    mutationFn: (body: any) => redactionApi.updateAmdecStatut(selectedId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amdec', selectedId] })
      queryClient.invalidateQueries({ queryKey: ['amdec-list'] })
      setWorkflowDialog(false)
      setSnack({ open: true, msg: 'Statut mis à jour', sev: 'success' })
    },
    onError: () => setSnack({ open: true, msg: 'Transition non autorisée', sev: 'error' }),
  })

  const handleSave = async () => {
    if (!selectedId || !amdecData) return
    setSaving(true)
    try {
      await redactionApi.saveAmdecData(selectedId, amdecData)
      queryClient.invalidateQueries({ queryKey: ['amdec', selectedId] })
      setSnack({ open: true, msg: 'AMDEC sauvegardée', sev: 'success' })
    } catch { setSnack({ open: true, msg: 'Erreur de sauvegarde', sev: 'error' }) }
    finally { setSaving(false) }
  }

  const handleExport = async () => {
    if (!selectedId) return
    setExporting(true)
    try {
      const res = await redactionApi.exportAmdecDocx(selectedId)
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }))
      const a = document.createElement('a')
      a.href = url
      a.download = `AMDEC_${amdecData?.analyseur?.replace(/\s+/g, '_') ?? 'rapport'}.docx`
      a.click()
      URL.revokeObjectURL(url)
      setSnack({ open: true, msg: 'AMDEC DOCX téléchargée', sev: 'success' })
    } catch { setSnack({ open: true, msg: 'Erreur export DOCX', sev: 'error' }) }
    finally { setExporting(false) }
  }

  const updateCategory = (catIdx: number, newCat: any) => {
    if (!amdecData) return
    const cats = [...(amdecData.categories ?? [])]
    cats[catIdx] = newCat
    setAmdecData({ ...amdecData, categories: cats })
  }

  const currentStatut = detail?.statut ?? 'brouillon'
  const nextStatutMap: Record<string, { label: string; next: string }> = {
    brouillon: { label: 'Soumettre à vérification', next: 'en_verification' },
    en_verification: { label: 'Marquer comme validé', next: 'valide' },
    valide: { label: 'Approuver (RQ)', next: 'approuve' },
  }
  const nextAction = nextStatutMap[currentStatut]
  const statInfo = STATUT_AMDEC[currentStatut] ?? { label: currentStatut, color: 'default' }
  const categories: any[] = amdecData?.categories ?? []

  return (
    <Grid container spacing={2} sx={{ height: 'calc(100vh - 280px)' }}>
      {/* Liste */}
      <Grid item xs={12} md={3}>
        <Card sx={{ height: '100%', overflow: 'auto' }}>
          <CardHeader title='Analyses AMDEC' titleTypographyProps={{ variant: 'subtitle1' }}
            action={<IconButton size='small' onClick={() => setNewDialog(true)}><AddIcon /></IconButton>} />
          <Divider />
          {isLoading ? <LoadingSpinner message='' /> : (
            <List dense>
              {(Array.isArray(amdecList) ? amdecList : []).map((a: any) => (
                <ListItem key={a.id} disablePadding>
                  <ListItemButton selected={selectedId === a.id} onClick={() => setSelectedId(a.id)}>
                    <ListItemText
                      primary={a.analyseur}
                      secondary={
                        <Chip label={STATUT_AMDEC[a.statut]?.label ?? a.statut}
                          color={STATUT_AMDEC[a.statut]?.color ?? 'default'}
                          size='small' />
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {(Array.isArray(amdecList) ? amdecList : []).length === 0 && (
                <ListItem><ListItemText primary='Aucune analyse' secondary='Cliquez + pour créer' /></ListItem>
              )}
            </List>
          )}
        </Card>
      </Grid>

      {/* Éditeur */}
      <Grid item xs={12} md={9}>
        {!selectedId || !amdecData ? (
          <Box display='flex' alignItems='center' justifyContent='center' height='100%'>
            <Typography color='text.secondary'>Sélectionnez ou créez une analyse AMDEC</Typography>
          </Box>
        ) : (
          <Card sx={{ height: '100%', overflow: 'auto' }}>
            <CardHeader
              title={
                <Box display='flex' alignItems='center' gap={1}>
                  <Typography variant='h6'>{amdecData.analyseur}</Typography>
                  <Chip label={statInfo.label} color={statInfo.color} size='small' />
                </Box>
              }
              action={
                <Box display='flex' gap={1} flexWrap='wrap'>
                  {nextAction && (
                    <Button size='small' variant='outlined' color='warning'
                      onClick={() => setWorkflowDialog(true)}>
                      {nextAction.label}
                    </Button>
                  )}
                  <Button size='small' variant='outlined' startIcon={<SaveIcon />}
                    onClick={handleSave} disabled={saving}>
                    {saving ? <CircularProgress size={16} /> : 'Sauvegarder'}
                  </Button>
                  <Button size='small' variant='contained' color='success' startIcon={<DownloadIcon />}
                    onClick={handleExport} disabled={exporting}>
                    {exporting ? <CircularProgress size={16} /> : 'Exporter DOCX'}
                  </Button>
                </Box>
              }
            />
            <Divider />
            <CardContent>
              {/* Infos générales */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>Informations générales</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {[
                      ['Analyseur / Équipement', 'analyseur'],
                      ["Type d'analyseur", 'type_analyseur'],
                      ['Rédacteur', 'redacteur'],
                      ['Date rédaction', 'date_redaction'],
                      ['Vérificateur', 'verificateur'],
                      ['Date vérification', 'date_verification'],
                      ['Validateur', 'validateur'],
                      ['Date validation', 'date_validation'],
                      ['Approbateur (RQ)', 'approbateur'],
                      ['Date approbation', 'date_approbation'],
                    ].map(([label, key]) => (
                      <Grid item xs={12} sm={6} key={key}>
                        <TextField label={label} fullWidth size='small'
                          value={amdecData[key] ?? ''}
                          onChange={e => setAmdecData({ ...amdecData, [key]: e.target.value })} />
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Légende IPR */}
              <Box display='flex' gap={1} my={1} flexWrap='wrap' alignItems='center'>
                <Typography variant='caption' fontWeight={600}>Légende IPR :</Typography>
                <Box sx={{ bgcolor: '#C6EFCE', px: 1, borderRadius: 1, fontSize: 11 }}>≤10 : Acceptable</Box>
                <Box sx={{ bgcolor: '#FFEB9C', px: 1, borderRadius: 1, fontSize: 11 }}>11–100 : À surveiller</Box>
                <Box sx={{ bgcolor: '#FFC7CE', px: 1, borderRadius: 1, fontSize: 11 }}>&gt;100 : Action requise</Box>
              </Box>

              {/* Tabs catégories */}
              <Tabs value={catTab} onChange={(_, v) => setCatTab(v)} variant='scrollable' scrollButtons='auto' sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}>
                {categories.map((cat: any, i: number) => (
                  <Tab key={i} label={`${cat.code} — ${cat.libelle}`} sx={{ fontSize: 12 }} />
                ))}
              </Tabs>
              {categories.map((cat: any, i: number) =>
                catTab === i ? (
                  <Box key={i}>
                    <AmdecCategoryTable category={cat} onUpdate={newCat => updateCategory(i, newCat)} />
                  </Box>
                ) : null
              )}

              {/* Synthèse */}
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>Synthèse et conclusions</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField label='Synthèse' fullWidth multiline rows={5}
                    value={amdecData.synthese ?? ''}
                    onChange={e => setAmdecData({ ...amdecData, synthese: e.target.value })} />
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        )}
      </Grid>

      {/* Dialog créer AMDEC */}
      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Nouvelle analyse AMDEC</DialogTitle>
        <DialogContent>
          <Box display='flex' flexDirection='column' gap={2} mt={1}>
            <TextField label="Nom de l'analyseur *" fullWidth value={newForm.analyseur}
              onChange={e => setNewForm(f => ({ ...f, analyseur: e.target.value }))} />
            <TextField label="Type d'analyseur (ex: Electrophorèse, Biochimie...)" fullWidth value={newForm.type_analyseur}
              onChange={e => setNewForm(f => ({ ...f, type_analyseur: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Annuler</Button>
          <Button variant='contained' onClick={() => createMutation.mutate(newForm)}
            disabled={!newForm.analyseur || createMutation.isPending}>
            {createMutation.isPending ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog avancement workflow */}
      <Dialog open={workflowDialog} onClose={() => setWorkflowDialog(false)} maxWidth='xs' fullWidth>
        <DialogTitle>{nextAction?.label ?? 'Avancement'}</DialogTitle>
        <DialogContent>
          <Box display='flex' flexDirection='column' gap={2} mt={1}>
            <TextField label='Votre nom (responsable)' fullWidth value={workflowNom}
              onChange={e => setWorkflowNom(e.target.value)}
              placeholder={nextAction?.next === 'approuve' ? 'Responsable Qualité' : ''} />
            <TextField label='Commentaire (optionnel)' fullWidth multiline rows={2}
              value={workflowComment} onChange={e => setWorkflowComment(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkflowDialog(false)}>Annuler</Button>
          <Button variant='contained' color='primary'
            onClick={() => workflowMutation.mutate({ statut: nextAction!.next, responsable_nom: workflowNom, commentaire: workflowComment })}
            disabled={workflowMutation.isPending}>
            {workflowMutation.isPending ? <CircularProgress size={20} /> : 'Confirmer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev}>{snack.msg}</Alert>
      </Snackbar>
    </Grid>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Critere { parametre: string; critere: string; source: string }
interface VerifData {
  type_methode: string
  introduction: Record<string, string>
  description: Record<string, string>
  motivation: string
  litterature: string
  criteres: Critere[]
  resultats: Record<string, string>
  risques: string
  validation_informatique: string
  conclusion: Record<string, string>
  mise_en_routine: Record<string, string>
  annexes: string
}

const EMPTY_DATA: VerifData = {
  type_methode: 'qualitatif',
  introduction: { nom_methode: '', equipe: '', operateurs: '', procedure_ref: 'SOPG0003', version_procedure: '', periode_debut: '', periode_fin: '' },
  description: { nom_methode: '', type: '', principe: '', matrice: '', pretraitement: '', unites: '', intervalles_reference: '', automate: '', kit_reactifs: '', materiau_etalonnage: '', type_etalonnage: '', marquage_ce: 'Oui', localisation: '', nb_analyses_an: '', objectif: '' },
  motivation: '',
  litterature: '',
  criteres: [],
  resultats: { donnees_brutes: '', specificite_analytique: '', specificite_diagnostique: '', sensibilite_analytique: '', sensibilite_diagnostique: '', fidelite_repetabilite: '', fidelite_intermediaire: '', justesse: '', exactitude: '', contamination: '', interferences: '', stabilite_reactifs: '', robustesse: '', comparaison_methode_precedente: '', comparaison_nb_mesures: '', comparaison_exploitation: '', comparaison_discordances: '', comparaison_autres: '', intervalle_reference: '', incertitude: '', intervalle_mesure_lod: '', intervalle_mesure_loq: '', intervalle_mesure_linearite: '' },
  risques: '',
  validation_informatique: '',
  conclusion: { repond_exigences: '', est_validee: '', commentaires: '', autorisateur: '', date_autorisation: '', autorisateur_caq: '', date_caq: '' },
  mise_en_routine: { date: '', autorise_par: '' },
  annexes: '',
}

// ── Composant champ de formulaire simple ─────────────────────────────────────
const FieldBlock: React.FC<{ label: string; value: string; onChange: (v: string) => void; multiline?: boolean; rows?: number }> = ({ label, value, onChange, multiline = false, rows = 3 }) => (
  <TextField
    label={label} value={value} onChange={e => onChange(e.target.value)}
    fullWidth size='small' multiline={multiline} rows={multiline ? rows : undefined}
    sx={{ mb: 1.5 }}
  />
)

// ── Formulaire vérification ───────────────────────────────────────────────────
const VerifForm: React.FC<{ data: VerifData; onChange: (d: VerifData) => void }> = ({ data, onChange }) => {
  const isQuant = data.type_methode === 'quantitatif'

  const setIntro = (k: string, v: string) => onChange({ ...data, introduction: { ...data.introduction, [k]: v } })
  const setDesc = (k: string, v: string) => onChange({ ...data, description: { ...data.description, [k]: v } })
  const setRes = (k: string, v: string) => onChange({ ...data, resultats: { ...data.resultats, [k]: v } })
  const setConc = (k: string, v: string) => onChange({ ...data, conclusion: { ...data.conclusion, [k]: v } })
  const setMR = (k: string, v: string) => onChange({ ...data, mise_en_routine: { ...data.mise_en_routine, [k]: v } })

  const addCritere = () => onChange({ ...data, criteres: [...data.criteres, { parametre: '', critere: '', source: '' }] })
  const setCritere = (i: number, k: keyof Critere, v: string) => {
    const updated = data.criteres.map((c, idx) => idx === i ? { ...c, [k]: v } : c)
    onChange({ ...data, criteres: updated })
  }
  const removeCritere = (i: number) => onChange({ ...data, criteres: data.criteres.filter((_, idx) => idx !== i) })

  return (
    <Box>
      <FormControl fullWidth size='small' sx={{ mb: 2 }}>
        <InputLabel>Type de méthode</InputLabel>
        <Select value={data.type_methode} label='Type de méthode'
          onChange={e => onChange({ ...data, type_methode: e.target.value })}>
          <MenuItem value='qualitatif'>Qualitatif (ENR04654)</MenuItem>
          <MenuItem value='quantitatif'>Quantitatif (ENR04653)</MenuItem>
        </Select>
      </FormControl>

      {/* 1. Introduction */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>1. Introduction</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FieldBlock label="Nom de la méthode/analyse/équipement" value={data.introduction.nom_methode} onChange={v => setIntro('nom_methode', v)} />
          <FieldBlock label="Équipe de mise en œuvre" value={data.introduction.equipe} onChange={v => setIntro('equipe', v)} />
          <FieldBlock label="Nom(s) opérateur(s)" value={data.introduction.operateurs} onChange={v => setIntro('operateurs', v)} />
          <Grid container spacing={1}>
            <Grid item xs={6}><FieldBlock label="Réf. procédure (ex: SOPG0003)" value={data.introduction.procedure_ref} onChange={v => setIntro('procedure_ref', v)} /></Grid>
            <Grid item xs={6}><FieldBlock label="Version" value={data.introduction.version_procedure} onChange={v => setIntro('version_procedure', v)} /></Grid>
            <Grid item xs={6}><FieldBlock label="Période – début (jj/mm/aa)" value={data.introduction.periode_debut} onChange={v => setIntro('periode_debut', v)} /></Grid>
            <Grid item xs={6}><FieldBlock label="Période – fin (jj/mm/aa)" value={data.introduction.periode_fin} onChange={v => setIntro('periode_fin', v)} /></Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 2. Description */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>2. Description de la méthode</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1}>
            {[
              ['Nom de la méthode/analyse', 'nom_methode'], ['Type de méthode', 'type'],
              ['Principe / Technique', 'principe'], ['Matrice (+ volume et stabilité)', 'matrice'],
              ['Prétraitement de l\'échantillon', 'pretraitement'], ['Unités', 'unites'],
              ['Intervalles de référence / Critères d\'interprétation', 'intervalles_reference'],
              ['Automate (marque, modèle, référence)', 'automate'],
              ['Kit / Matériels et réactifs', 'kit_reactifs'],
              ['Matériau d\'étalonnage', 'materiau_etalonnage'],
              ['Type d\'étalonnage, niveaux et valeurs', 'type_etalonnage'],
              ['Marquage CE-IVDR (Oui/Non)', 'marquage_ce'],
              ['Localisation (+ site)', 'localisation'],
              ['Nombre d\'analyses / an', 'nb_analyses_an'],
              ['Objectif / Utilisation prévue', 'objectif'],
            ].map(([label, key]) => (
              <Grid item xs={12} sm={6} key={key as string}>
                <FieldBlock label={label as string} value={data.description[key as string] ?? ''} onChange={v => setDesc(key as string, v)} />
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 3. Motivation */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>3. Motivation du changement</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FieldBlock label="Motivation" value={data.motivation} onChange={v => onChange({ ...data, motivation: v })} multiline rows={4} />
        </AccordionDetails>
      </Accordion>

      {/* 4. Littérature */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>4. Littérature</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FieldBlock label="Références (inserts, kits, publications...)" value={data.litterature} onChange={v => onChange({ ...data, litterature: v })} multiline rows={4} />
        </AccordionDetails>
      </Accordion>

      {/* 5. Critères */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>5. Exigences / Critères d'acceptabilité</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Table size='small' sx={{ mb: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Paramètre</TableCell>
                <TableCell>Critère d'acceptabilité</TableCell>
                <TableCell>Source / Référence</TableCell>
                <TableCell width={40}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.criteres.map((c, i) => (
                <TableRow key={i}>
                  <TableCell><TextField value={c.parametre} onChange={e => setCritere(i, 'parametre', e.target.value)} size='small' fullWidth /></TableCell>
                  <TableCell><TextField value={c.critere} onChange={e => setCritere(i, 'critere', e.target.value)} size='small' fullWidth /></TableCell>
                  <TableCell><TextField value={c.source} onChange={e => setCritere(i, 'source', e.target.value)} size='small' fullWidth /></TableCell>
                  <TableCell><IconButton size='small' onClick={() => removeCritere(i)}><DeleteIcon fontSize='small' /></IconButton></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button size='small' startIcon={<AddIcon />} onClick={addCritere}>Ajouter un critère</Button>
        </AccordionDetails>
      </Accordion>

      {/* 6. Résultats */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>6. Résultats de l'évaluation des performances</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FieldBlock label="Données brutes conservées (référence)" value={data.resultats.donnees_brutes} onChange={v => setRes('donnees_brutes', v)} />
          <Divider sx={{ my: 1 }} />
          {[
            ['6.1 Spécificité analytique (réactions croisées)', 'specificite_analytique'],
            ['6.2 Spécificité diagnostique ou clinique', 'specificite_diagnostique'],
            ['6.3 Sensibilité analytique', 'sensibilite_analytique'],
            ['6.4 Sensibilité diagnostique ou clinique', 'sensibilite_diagnostique'],
            ['6.5.1 Répétabilité (fidélité)', 'fidelite_repetabilite'],
            ['6.5.2 Fidélité intermédiaire', 'fidelite_intermediaire'],
            ['6.6 Justesse', 'justesse'],
            ['6.7 Exactitude', 'exactitude'],
            ['6.8 Contamination (carry-over)', 'contamination'],
            ['6.9 Interférences', 'interferences'],
            ['6.10 Stabilité des réactifs', 'stabilite_reactifs'],
            ['6.11 Robustesse', 'robustesse'],
            ['6.12 – Méthode précédente / autre méthode', 'comparaison_methode_precedente'],
            ['6.12 – Nombre de mesures / échantillons', 'comparaison_nb_mesures'],
            ['6.12 – Méthode d\'exploitation (concordances)', 'comparaison_exploitation'],
            ['6.12 – Résultats / interprétations discordances', 'comparaison_discordances'],
            ['6.13 Comparaison avec autres méthodes (POCT...)', 'comparaison_autres'],
            ['6.14 Intervalle de référence', 'intervalle_reference'],
            ['6.15 Incertitude de mesure / facteurs de variabilité', 'incertitude'],
            ...(isQuant ? [
              ['6.16 – Limites de détection (LOD)', 'intervalle_mesure_lod'],
              ['6.16 – Limites de quantification (LOQ)', 'intervalle_mesure_loq'],
              ['6.16 – Limites de linéarité', 'intervalle_mesure_linearite'],
            ] : []),
          ].map(([label, key]) => (
            <FieldBlock key={key as string} label={label as string} value={data.resultats[key as string] ?? ''} onChange={v => setRes(key as string, v)} multiline rows={3} />
          ))}
        </AccordionDetails>
      </Accordion>

      {/* 7. Risques */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>7. Maîtrise / Analyse des risques</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FieldBlock label="Analyse des risques (Ishikawa, plan de mitigation...)" value={data.risques} onChange={v => onChange({ ...data, risques: v })} multiline rows={5} />
        </AccordionDetails>
      </Accordion>

      {/* 8. Validation informatique */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>8. Validation informatique et transfert électronique</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FieldBlock label="Description de la validation informatique" value={data.validation_informatique} onChange={v => onChange({ ...data, validation_informatique: v })} multiline rows={3} />
        </AccordionDetails>
      </Accordion>

      {/* 9. Conclusion */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>9. Conclusion</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1}>
            <Grid item xs={6}><FieldBlock label="Répond aux exigences (OUI/NON)" value={data.conclusion.repond_exigences} onChange={v => setConc('repond_exigences', v)} /></Grid>
            <Grid item xs={6}><FieldBlock label="Méthode validée (OUI/NON)" value={data.conclusion.est_validee} onChange={v => setConc('est_validee', v)} /></Grid>
          </Grid>
          <FieldBlock label="Commentaires éventuels" value={data.conclusion.commentaires} onChange={v => setConc('commentaires', v)} multiline rows={2} />
          <FieldBlock label="Personne autorisant la vérification" value={data.conclusion.autorisateur} onChange={v => setConc('autorisateur', v)} />
          <FieldBlock label="Date d'autorisation" value={data.conclusion.date_autorisation} onChange={v => setConc('date_autorisation', v)} />
          <FieldBlock label="Autorisation par CAQ" value={data.conclusion.autorisateur_caq} onChange={v => setConc('autorisateur_caq', v)} />
          <FieldBlock label="Date autorisation CAQ" value={data.conclusion.date_caq} onChange={v => setConc('date_caq', v)} />
        </AccordionDetails>
      </Accordion>

      {/* 10. Mise en routine */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>10. Mise en routine</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FieldBlock label="Date de mise en routine" value={data.mise_en_routine.date} onChange={v => setMR('date', v)} />
          <FieldBlock label="Autorisé par" value={data.mise_en_routine.autorise_par} onChange={v => setMR('autorise_par', v)} />
        </AccordionDetails>
      </Accordion>

      {/* 11. Annexes */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>11. Annexes</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FieldBlock label="Annexes / références complémentaires" value={data.annexes} onChange={v => onChange({ ...data, annexes: v })} multiline rows={3} />
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
const RedactionPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)

  // ── Procédures (tab 0) ────────────────────────────────────────────────────
  const [selectedProc, setSelectedProc] = useState<any>(null)
  const [editSection, setEditSection] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [newProcDialog, setNewProcDialog] = useState(false)
  const [newProc, setNewProc] = useState({ titre: '', type: 'procedure', referentiel: '' })

  const { data: procedures, isLoading: procLoading } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => redactionApi.listProcedures().then(r => r.data),
  })
  const { data: procDetail } = useQuery({
    queryKey: ['procedure', selectedProc?.id],
    queryFn: () => redactionApi.getProcedure(selectedProc.id).then(r => r.data),
    enabled: !!selectedProc,
  })
  const createProcMutation = useMutation({
    mutationFn: (d: any) => redactionApi.createProcedure(d),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['procedures'] }); setNewProcDialog(false); setSelectedProc(res.data) },
  })
  const addSectionMutation = useMutation({
    mutationFn: ({ id, titre, contenu, ordre }: any) => redactionApi.addSection(id, { titre, contenu, ordre }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['procedure', selectedProc?.id] }); setEditSection(null) },
  })

  // ── Vérification de méthodes (tab 1) ─────────────────────────────────────
  const [selectedDossier, setSelectedDossier] = useState<any>(null)
  const [verifData, setVerifData] = useState<VerifData>(EMPTY_DATA)
  const [newDossierDialog, setNewDossierDialog] = useState(false)
  const [newDossier, setNewDossier] = useState({ titre: '', type_methode: 'qualitatif' })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  const [exportLoading, setExportLoading] = useState(false)

  const { data: dossiers, isLoading: dossierLoading } = useQuery({
    queryKey: ['dossiers-verification'],
    queryFn: () => redactionApi.listDossiers().then(r => r.data),
  })
  const { data: dossierDetail } = useQuery({
    queryKey: ['dossier-verification', selectedDossier?.id],
    queryFn: () => redactionApi.getDossier(selectedDossier.id).then(r => r.data),
    enabled: !!selectedDossier,
    onSuccess: (d: any) => {
      const loaded = d.data && Object.keys(d.data).length > 0 ? d.data : { ...EMPTY_DATA, type_methode: d.type_methode || 'qualitatif' }
      setVerifData(loaded as VerifData)
    },
  } as any)

  const createDossierMutation = useMutation({
    mutationFn: (d: any) => redactionApi.createDossier(d),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['dossiers-verification'] })
      setNewDossierDialog(false)
      setSelectedDossier(res.data)
      setVerifData({ ...EMPTY_DATA, type_methode: newDossier.type_methode })
      setSnackbar({ open: true, message: 'Dossier créé', severity: 'success' })
    },
  })

  const saveDossierMutation = useMutation({
    mutationFn: () => redactionApi.updateDossierData(selectedDossier.id, verifData as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dossiers-verification'] })
      setSnackbar({ open: true, message: 'Dossier sauvegardé', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur de sauvegarde', severity: 'error' }),
  })

  const handleExportDocx = async () => {
    if (!selectedDossier) return
    setExportLoading(true)
    try {
      const res = await redactionApi.exportDocx(selectedDossier.id)
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }))
      const ref = verifData.type_methode === 'quantitatif' ? 'ENR04653' : 'ENR04654'
      const a = document.createElement('a')
      a.href = url
      a.download = `${ref}_${selectedDossier.titre?.replace(/\s+/g, '_') ?? 'rapport'}.docx`
      a.click()
      URL.revokeObjectURL(url)
      setSnackbar({ open: true, message: 'Document DOCX téléchargé', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Erreur lors de la génération du DOCX', severity: 'error' })
    } finally {
      setExportLoading(false)
    }
  }

  const procList: any[] = Array.isArray(procedures) ? procedures : []
  const dossierList: any[] = Array.isArray(dossiers) ? dossiers : []
  const sections: any[] = (procDetail as any)?.sections ?? []

  return (
    <Box>
      <PageHeader title='Rédaction documentaire'
        subtitle='Procédures, modes opératoires et rapports de vérification'
        actionButton={
          tab === 0 ? (
            <Button variant='contained' startIcon={<AddIcon />} onClick={() => setNewProcDialog(true)}>
              Nouveau document
            </Button>
          ) : tab === 1 ? (
            <Button variant='contained' startIcon={<AddIcon />} onClick={() => setNewDossierDialog(true)}>
              Nouveau dossier
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label='Procédures / Modes opératoires' />
        <Tab label='Vérification de méthodes (ENR04653/54)' />
        <Tab label='Analyses des risques AMDEC' />
      </Tabs>

      {/* ── TAB 0 : Procédures ──────────────────────────────────────────── */}
      {tab === 0 && (
        <Grid container spacing={2} sx={{ height: 'calc(100vh - 280px)' }}>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%', overflow: 'auto' }}>
              <CardHeader title='Documents' titleTypographyProps={{ variant: 'subtitle1' }} />
              <Divider />
              {procLoading ? <LoadingSpinner message='' /> : (
                <List dense>
                  {procList.map(p => (
                    <ListItem key={p.id} disablePadding>
                      <ListItemButton selected={selectedProc?.id === p.id} onClick={() => setSelectedProc(p)}>
                        <ListItemText primary={p.titre} secondary={<Chip label={p.type || 'procedure'} size='small' />} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  {procList.length === 0 && <ListItem><ListItemText primary='Aucun document' /></ListItem>}
                </List>
              )}
            </Card>
          </Grid>
          <Grid item xs={12} md={9}>
            {!selectedProc ? (
              <Box display='flex' alignItems='center' justifyContent='center' height='100%'>
                <Typography color='text.secondary'>Sélectionnez un document pour commencer</Typography>
              </Box>
            ) : (
              <Card sx={{ height: '100%', overflow: 'auto' }}>
                <CardHeader
                  title={(procDetail as any)?.titre ?? selectedProc.titre}
                  subheader={(procDetail as any)?.referentiel}
                  action={
                    <Button startIcon={<AddIcon />} size='small'
                      onClick={() => { setEditSection(-1); setEditContent('') }}>
                      Section
                    </Button>
                  }
                />
                <Divider />
                <CardContent>
                  {sections.map((s: any, i: number) => (
                    <Box key={s.id ?? i} mb={3}>
                      <Box display='flex' alignItems='center' gap={1} mb={1}>
                        <Typography variant='h6' fontWeight={600}>{s.titre}</Typography>
                        <IconButton size='small' onClick={() => { setEditSection(i); setEditContent(s.contenu) }}>
                          <EditIcon fontSize='small' />
                        </IconButton>
                      </Box>
                      {editSection === i ? (
                        <Box>
                          <TextField fullWidth multiline rows={6} value={editContent} onChange={e => setEditContent(e.target.value)} />
                          <Box display='flex' gap={1} mt={1}>
                            <Button size='small' onClick={() => setEditSection(null)}>Annuler</Button>
                            <Button size='small' variant='contained' startIcon={<SaveIcon />}
                              onClick={() => addSectionMutation.mutate({ id: selectedProc.id, titre: s.titre, contenu: editContent, ordre: s.ordre })}>
                              Enregistrer
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant='body1' sx={{ whiteSpace: 'pre-wrap' }}>{s.contenu}</Typography>
                      )}
                      <Divider sx={{ mt: 2 }} />
                    </Box>
                  ))}
                  {editSection === -1 && (
                    <Box mt={2}>
                      <TextField fullWidth label='Titre de la section' sx={{ mb: 1 }}
                        onChange={e => setEditContent(prev => e.target.value + '|||' + (prev.split('|||')[1] ?? ''))} />
                      <TextField fullWidth multiline rows={5} label='Contenu'
                        onChange={e => setEditContent(prev => (prev.split('|||')[0] ?? '') + '|||' + e.target.value)} />
                      <Box display='flex' gap={1} mt={1}>
                        <Button size='small' onClick={() => setEditSection(null)}>Annuler</Button>
                        <Button size='small' variant='contained'
                          onClick={() => {
                            const [titre, contenu] = editContent.split('|||')
                            addSectionMutation.mutate({ id: selectedProc.id, titre, contenu: contenu ?? '', ordre: sections.length + 1 })
                          }}>
                          Ajouter
                        </Button>
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* ── TAB 1 : Vérification de méthodes ──────────────────────────── */}
      {tab === 1 && (
        <Grid container spacing={2} sx={{ height: 'calc(100vh - 280px)' }}>
          {/* Liste dossiers */}
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%', overflow: 'auto' }}>
              <CardHeader title='Dossiers' titleTypographyProps={{ variant: 'subtitle1' }} />
              <Divider />
              {dossierLoading ? <LoadingSpinner message='' /> : (
                <List dense>
                  {dossierList.map(d => (
                    <ListItem key={d.id} disablePadding>
                      <ListItemButton selected={selectedDossier?.id === d.id} onClick={() => setSelectedDossier(d)}>
                        <ListItemText
                          primary={d.titre}
                          secondary={
                            <Chip
                              label={d.methode === 'quantitatif' ? 'ENR04653' : 'ENR04654'}
                              size='small'
                              color={d.methode === 'quantitatif' ? 'primary' : 'secondary'}
                            />
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  {dossierList.length === 0 && <ListItem><ListItemText primary='Aucun dossier' /></ListItem>}
                </List>
              )}
            </Card>
          </Grid>

          {/* Formulaire */}
          <Grid item xs={12} md={9}>
            {!selectedDossier ? (
              <Box display='flex' alignItems='center' justifyContent='center' height='100%'>
                <Typography color='text.secondary'>Sélectionnez un dossier ou créez-en un nouveau</Typography>
              </Box>
            ) : (
              <Card sx={{ height: '100%', overflow: 'auto' }}>
                <CardHeader
                  title={selectedDossier.titre}
                  action={
                    <Box display='flex' gap={1}>
                      <Tooltip title='Sauvegarder le dossier'>
                        <Button size='small' variant='outlined' startIcon={<SaveIcon />}
                          onClick={() => saveDossierMutation.mutate()}
                          disabled={saveDossierMutation.isPending}>
                          {saveDossierMutation.isPending ? <CircularProgress size={16} /> : 'Sauvegarder'}
                        </Button>
                      </Tooltip>
                      <Tooltip title={`Générer ${verifData.type_methode === 'quantitatif' ? 'ENR04653' : 'ENR04654'} DOCX`}>
                        <Button size='small' variant='contained' color='success' startIcon={<DownloadIcon />}
                          onClick={handleExportDocx} disabled={exportLoading}>
                          {exportLoading ? <CircularProgress size={16} /> : 'Exporter DOCX'}
                        </Button>
                      </Tooltip>
                    </Box>
                  }
                />
                <Divider />
                <CardContent>
                  <VerifForm data={verifData} onChange={setVerifData} />
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* ── Dialog nouveau document ───────────────────────────────────── */}
      <Dialog open={newProcDialog} onClose={() => setNewProcDialog(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Nouveau document</DialogTitle>
        <DialogContent>
          <Box display='flex' flexDirection='column' gap={2} mt={1}>
            <TextField label='Titre *' fullWidth value={newProc.titre}
              onChange={e => setNewProc(p => ({ ...p, titre: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={newProc.type} label='Type'
                onChange={e => setNewProc(p => ({ ...p, type: e.target.value }))}>
                {['procedure', 'mode_operatoire', 'instruction', 'formulaire', 'enregistrement'].map(tp => (
                  <MenuItem key={tp} value={tp}>{tp}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label='Référentiel (ex: ISO 15189 §5.4)' fullWidth value={newProc.referentiel}
              onChange={e => setNewProc(p => ({ ...p, referentiel: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewProcDialog(false)}>Annuler</Button>
          <Button variant='contained' onClick={() => createProcMutation.mutate(newProc)}
            disabled={!newProc.titre || createProcMutation.isPending}>
            {createProcMutation.isPending ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog nouveau dossier vérification ───────────────────────── */}
      <Dialog open={newDossierDialog} onClose={() => setNewDossierDialog(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Nouveau dossier de vérification</DialogTitle>
        <DialogContent>
          <Box display='flex' flexDirection='column' gap={2} mt={1}>
            <TextField label='Titre / Nom de la méthode *' fullWidth value={newDossier.titre}
              onChange={e => setNewDossier(p => ({ ...p, titre: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Type de méthode</InputLabel>
              <Select value={newDossier.type_methode} label='Type de méthode'
                onChange={e => setNewDossier(p => ({ ...p, type_methode: e.target.value }))}>
                <MenuItem value='qualitatif'>Qualitatif — ENR04654</MenuItem>
                <MenuItem value='quantitatif'>Quantitatif — ENR04653</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDossierDialog(false)}>Annuler</Button>
          <Button variant='contained'
            onClick={() => createDossierMutation.mutate({ titre: newDossier.titre, type_methode: newDossier.type_methode, methode: newDossier.type_methode })}
            disabled={!newDossier.titre || createDossierMutation.isPending}>
            {createDossierMutation.isPending ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── TAB 2 : AMDEC ──────────────────────────────────────────────── */}
      {tab === 2 && <AmdecTab />}

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

export default RedactionPage
