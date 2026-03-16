import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Grid, Card, CardContent, CardHeader, Typography, Button, Tabs, Tab,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert, Snackbar, Tooltip,
  Paper, Stack, Divider, alpha, useTheme,
} from '@mui/material'
import {
  Add as AddIcon, School, Star, CheckCircle, Schedule,
  Groups, EmojiEvents,
} from '@mui/icons-material'
import { hrApi } from '../../api/hr'
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

const HRPage: React.FC = () => {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({
    titre: '', type: 'interne', date_debut: '', date_fin: '', description: '',
  })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success'|'error' })

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
