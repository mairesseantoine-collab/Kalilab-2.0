import React, { useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Box, Card, CardContent, Typography, Button, Tabs, Tab, TextField,
  CircularProgress, Alert, Snackbar, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, MenuItem,
} from '@mui/material'
import { ArrowBack, Block } from '@mui/icons-material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { DatePicker } from '@mui/x-date-pickers'
import dayjs, { Dayjs } from 'dayjs'
import PageHeader from '../../components/common/PageHeader'
import StatusChip from '../../components/common/StatusChip'
import { equipmentApi } from '../../api/equipment'
import { AuthContext } from '../../contexts/AuthContext'
import { Equipement, Calibration, Maintenance } from '../../types'

interface TabPanelProps { children?: React.ReactNode; index: number; value: number }
function TabPanel({ children, index, value }: TabPanelProps) {
  return <div hidden={value !== index}>{value === index && <Box sx={{ pt: 2 }}>{children}</Box>}</div>
}

export default function EquipmentDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authCtx = useContext(AuthContext)
  const [tab, setTab] = useState(0)
  const [calibDialog, setCalibDialog] = useState(false)
  const [maintDialog, setMaintDialog] = useState(false)
  const [calibDate, setCalibDate] = useState<Dayjs | null>(dayjs())
  const [calibProchaine, setCalibProchaine] = useState<Dayjs | null>(dayjs().add(1, 'year'))
  const [calibRealise, setCalibRealise] = useState('')
  const [calibResultat, setCalibResultat] = useState('conforme')
  const [calibNotes, setCalibNotes] = useState('')
  const [maintType, setMaintType] = useState('preventive')
  const [maintDate, setMaintDate] = useState<Dayjs | null>(dayjs())
  const [maintDesc, setMaintDesc] = useState('')
  const [maintRealise, setMaintRealise] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const eqId = Number(id)

  const { data: eqData, isLoading, isError } = useQuery({
    queryKey: ['equipment', eqId],
    queryFn: () => equipmentApi.get(eqId),
    enabled: !!eqId,
  })
  const eq: Equipement | undefined = eqData?.data

  const calibMutation = useMutation({
    mutationFn: (data: Partial<Calibration>) => equipmentApi.addCalibration(eqId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', eqId] })
      setCalibDialog(false)
      setSnackbar({ open: true, message: t('equipment.calibAdded', 'Calibration ajoutee'), severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: t('common.error', 'Erreur'), severity: 'error' }),
  })

  const maintMutation = useMutation({
    mutationFn: (data: Partial<Maintenance>) => equipmentApi.addMaintenance(eqId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', eqId] })
      setMaintDialog(false)
      setSnackbar({ open: true, message: t('equipment.maintAdded', 'Maintenance ajoutee'), severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: t('common.error', 'Erreur'), severity: 'error' }),
  })

  const blockMutation = useMutation({
    mutationFn: () => equipmentApi.block(eqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', eqId] })
      setSnackbar({ open: true, message: t('equipment.blocked', 'Equipement bloque'), severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: t('common.error', 'Erreur'), severity: 'error' }),
  })

  const calibColumns: GridColDef[] = [
    { field: 'date_calibration', headerName: t('equipment.dateCalib', 'Date calib.'), width: 140,
      renderCell: (p) => dayjs(p.value as string).format('DD/MM/YYYY') },
    { field: 'date_prochaine', headerName: t('equipment.dateProchaine', 'Prochaine'), width: 130,
      renderCell: (p) => p.value ? dayjs(p.value as string).format('DD/MM/YYYY') : '-' },
    { field: 'realise_par', headerName: t('equipment.realise', 'Realise par'), flex: 1 },
    { field: 'resultat', headerName: t('equipment.resultat', 'Resultat'), width: 130,
      renderCell: (p) => <Chip label={p.value as string} color={p.value === 'conforme' ? 'success' : 'error'} size='small' /> },
    { field: 'notes', headerName: t('equipment.notes', 'Notes'), flex: 1 },
  ]

  const maintColumns: GridColDef[] = [
    { field: 'type_maintenance', headerName: t('equipment.typeMaint', 'Type'), width: 130 },
    { field: 'date_planifiee', headerName: t('equipment.datePlanifiee', 'Planifiee'), width: 130,
      renderCell: (p) => p.value ? dayjs(p.value as string).format('DD/MM/YYYY') : '-' },
    { field: 'date_realisation', headerName: t('equipment.dateRealisation', 'Realisee'), width: 130,
      renderCell: (p) => p.value ? dayjs(p.value as string).format('DD/MM/YYYY') : '-' },
    { field: 'realise_par', headerName: t('equipment.realise', 'Realise par'), flex: 1 },
    { field: 'statut', headerName: t('equipment.statut', 'Statut'), width: 130,
      renderCell: (p) => <StatusChip status={p.value as string} /> },
  ]

  const handleAddCalib = () => {
    if (!calibDate) return
    calibMutation.mutate({
      date_calibration: calibDate.format('YYYY-MM-DD'),
      date_prochaine: calibProchaine ? calibProchaine.format('YYYY-MM-DD') : undefined,
      realise_par: calibRealise,
      resultat: calibResultat,
      notes: calibNotes,
    })
  }

  const handleAddMaint = () => {
    if (!maintDate) return
    maintMutation.mutate({
      type_maintenance: maintType,
      date_planifiee: maintDate.format('YYYY-MM-DD'),
      description: maintDesc,
      realise_par: maintRealise,
      statut: 'planifiee',
    })
  }

  if (isLoading) return <Box display='flex' justifyContent='center' mt={4}><CircularProgress /></Box>
  if (isError || !eq) return <Alert severity='error'>{t('common.loadError', 'Erreur de chargement')}</Alert>

  const calibrations: Calibration[] = (eqData?.data as any)?.calibrations ?? []
  const maintenances: Maintenance[] = (eqData?.data as any)?.maintenances ?? []
  return (
    <Box>
      <PageHeader
        title={eq.nom}
        breadcrumbs={[
          { label: t("equipment.title", "Equipements"), path: "/equipements" },
          { label: eq.nom },
        ]}
        action={authCtx?.hasRole("admin", "responsable_technique") && eq.statut !== "hors_service" ? {
          label: t("equipment.block", "Bloquer"),
          onClick: () => blockMutation.mutate(),
          icon: <Block />,
        } : undefined}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t("equipment.tabs.fiche", "Fiche signaletique")} />
        <Tab label={t("equipment.tabs.calibrations", "Calibrations")} />
        <Tab label={t("equipment.tabs.maintenances", "Maintenances")} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant='h6' gutterBottom>{t('equipment.identification', 'Identification')}</Typography>
              <Box display='flex' justifyContent='space-between' mb={0.5}><Typography color='text.secondary'>{t('equipment.categorie', 'Categorie')}</Typography><Typography>{eq.categorie}</Typography></Box>
              <Box display='flex' justifyContent='space-between' mb={0.5}><Typography color='text.secondary'>{t('equipment.numero', 'N Inventaire')}</Typography><Typography>{eq.numero_inventaire}</Typography></Box>
              {eq.fabricant && <Box display='flex' justifyContent='space-between' mb={0.5}><Typography color='text.secondary'>{t('equipment.fabricant', 'Fabricant')}</Typography><Typography>{eq.fabricant}</Typography></Box>}
              {eq.modele && <Box display='flex' justifyContent='space-between' mb={0.5}><Typography color='text.secondary'>{t('equipment.modele', 'Modele')}</Typography><Typography>{eq.modele}</Typography></Box>}
              {eq.numero_serie && <Box display='flex' justifyContent='space-between' mb={0.5}><Typography color='text.secondary'>{t('equipment.serie', 'N Serie')}</Typography><Typography>{eq.numero_serie}</Typography></Box>}
              {eq.localisation && <Box display='flex' justifyContent='space-between' mb={0.5}><Typography color='text.secondary'>{t('equipment.localisation', 'Localisation')}</Typography><Typography>{eq.localisation}</Typography></Box>}
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant='h6' gutterBottom>{t('equipment.etat', 'Etat')}</Typography>
              <Box display='flex' justifyContent='space-between' mb={1}><Typography color='text.secondary'>{t('common.statut', 'Statut')}</Typography><StatusChip status={eq.statut} /></Box>
              {eq.prochaine_calibration && <Box display='flex' justifyContent='space-between' mb={1}><Typography color='text.secondary'>{t('equipment.prochCalib', 'Prochaine calib.')}</Typography><Typography>{dayjs(eq.prochaine_calibration).format('DD/MM/YYYY')}</Typography></Box>}
              {eq.prochaine_maintenance && <Box display='flex' justifyContent='space-between'><Typography color='text.secondary'>{t('equipment.prochMaint', 'Prochaine maint.')}</Typography><Typography>{dayjs(eq.prochaine_maintenance).format('DD/MM/YYYY')}</Typography></Box>}
            </CardContent></Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Box mb={2} display='flex' justifyContent='flex-end'>
          <Button variant='outlined' onClick={() => setCalibDialog(true)}>{t('equipment.addCalib', 'Ajouter calibration')}</Button>
        </Box>
        <DataGrid rows={calibrations} columns={calibColumns} autoHeight disableRowSelectionOnClick pageSizeOptions={[10, 25]} sx={{ border: 0 }} />
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Box mb={2} display='flex' justifyContent='flex-end'>
          <Button variant='outlined' onClick={() => setMaintDialog(true)}>{t('equipment.addMaint', 'Ajouter maintenance')}</Button>
        </Box>
        <DataGrid rows={maintenances} columns={maintColumns} autoHeight disableRowSelectionOnClick pageSizeOptions={[10, 25]} sx={{ border: 0 }} />
      </TabPanel>

      <Box mt={2}><Button startIcon={<ArrowBack />} onClick={() => navigate('/equipements')}>{t('common.back', 'Retour')}</Button></Box>

      <Dialog open={calibDialog} onClose={() => setCalibDialog(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{t('equipment.addCalib', 'Ajouter calibration')}</DialogTitle>
        <DialogContent>
          <Box display='flex' flexDirection='column' gap={2} mt={1}>
            <DatePicker label={t('equipment.dateCalib', 'Date calibration')} value={calibDate} onChange={setCalibDate} slotProps={{ textField: { fullWidth: true } }} />
            <DatePicker label={t('equipment.dateProchaine', 'Prochaine')} value={calibProchaine} onChange={setCalibProchaine} slotProps={{ textField: { fullWidth: true } }} />
            <TextField fullWidth label={t('equipment.realise', 'Realise par')} value={calibRealise} onChange={(e) => setCalibRealise(e.target.value)} />
            <TextField fullWidth select label={t('equipment.resultat', 'Resultat')} value={calibResultat} onChange={(e) => setCalibResultat(e.target.value)}>
              <MenuItem value='conforme'>Conforme</MenuItem>
              <MenuItem value='non_conforme'>Non conforme</MenuItem>
            </TextField>
            <TextField fullWidth multiline rows={2} label={t('equipment.notes', 'Notes')} value={calibNotes} onChange={(e) => setCalibNotes(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalibDialog(false)}>{t('common.cancel', 'Annuler')}</Button>
          <Button variant='contained' onClick={handleAddCalib} disabled={calibMutation.isPending}>{t('common.add', 'Ajouter')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={maintDialog} onClose={() => setMaintDialog(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{t('equipment.addMaint', 'Ajouter maintenance')}</DialogTitle>
        <DialogContent>
          <Box display='flex' flexDirection='column' gap={2} mt={1}>
            <TextField fullWidth select label={t('equipment.typeMaint', 'Type')} value={maintType} onChange={(e) => setMaintType(e.target.value)}>
              <MenuItem value='preventive'>Preventive</MenuItem>
              <MenuItem value='corrective'>Corrective</MenuItem>
            </TextField>
            <DatePicker label={t('equipment.datePlanifiee', 'Date planifiee')} value={maintDate} onChange={setMaintDate} slotProps={{ textField: { fullWidth: true } }} />
            <TextField fullWidth label={t('equipment.realise', 'Realise par')} value={maintRealise} onChange={(e) => setMaintRealise(e.target.value)} />
            <TextField fullWidth multiline rows={3} label={t('equipment.description', 'Description')} value={maintDesc} onChange={(e) => setMaintDesc(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaintDialog(false)}>{t('common.cancel', 'Annuler')}</Button>
          <Button variant='contained' onClick={handleAddMaint} disabled={maintMutation.isPending}>{t('common.add', 'Ajouter')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
