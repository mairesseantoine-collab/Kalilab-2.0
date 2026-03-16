import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Card, CardContent, CardHeader, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert, Snackbar, Divider, Typography,
} from '@mui/material'
import { QrCodeScanner as QrIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { stockApi } from '../../api/stock'
import PageHeader from '../../components/common/PageHeader'

interface FormValues {
  article_id: number | ''
  numero_lot: string
  quantite: number
  date_expiration: string
  fournisseur: string
  notes: string
}

const ReceptionPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [gs1Code, setGs1Code] = useState('')
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success'|'error' })

  const { data: articles } = useQuery({
    queryKey: ['articles'],
    queryFn: () => stockApi.listArticles().then(r => r.data),
  })

  const { control, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { article_id: '', numero_lot: '', quantite: 1, date_expiration: '', fournisseur: '', notes: '' },
  })

  const createLot = useMutation({
    mutationFn: (data: FormValues) => stockApi.createLot(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      setSnackbar({ open: true, message: 'Lot enregistre avec succes', severity: 'success' })
      reset()
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur enregistrement', severity: 'error' }),
  })

  const scanGs1 = useMutation({
    mutationFn: (code: string) => stockApi.scanGS1(code),
    onSuccess: (res) => {
      const d = res.data as any
      if (d.article_id) setValue('article_id', d.article_id)
      if (d.numero_lot) setValue('numero_lot', d.numero_lot)
      if (d.date_expiration) setValue('date_expiration', d.date_expiration)
      setSnackbar({ open: true, message: 'Code GS1 decode', severity: 'success' })
    },
    onError: () => setSnackbar({ open: true, message: 'Code GS1 non reconnu', severity: 'error' }),
  })

  const articlesList: any[] = Array.isArray(articles) ? articles : []

  return (
    <Box>
      <PageHeader title='Nouvelle reception de lot'
        actionButton={
          <Button variant='outlined' startIcon={<ArrowBackIcon />} onClick={() => navigate('/stock')}>
            Retour
          </Button>
        }
      />

      <Box display='flex' gap={2} mb={3} flexWrap='wrap'>
        <TextField size='small' label='Code GS1 / DataMatrix' value={gs1Code}
          onChange={e => setGs1Code(e.target.value)}
          placeholder='Scanner ou saisir le code-barres...'
          sx={{ minWidth: 300 }}
        />
        <Button variant='outlined' startIcon={<QrIcon />}
          onClick={() => scanGs1.mutate(gs1Code)} disabled={!gs1Code || scanGs1.isPending}>
          {scanGs1.isPending ? <CircularProgress size={16} /> : 'Decoder GS1'}
        </Button>
      </Box>

      <Card sx={{ maxWidth: 700 }}>
        <CardHeader title='Informations du lot' />
        <CardContent>
          <Box component='form' onSubmit={handleSubmit(d => createLot.mutate(d))}
            display='flex' flexDirection='column' gap={3}>

            <Controller name='article_id' control={control} rules={{ required: true }}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.article_id}>
                  <InputLabel>Article / Reactif *</InputLabel>
                  <Select {...field} label='Article / Reactif *'>
                    {articlesList.map(a => (
                      <MenuItem key={a.id} value={a.id}>{a.nom} ({a.code})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            <Controller name='numero_lot' control={control} rules={{ required: true }}
              render={({ field }) => (
                <TextField {...field} label='Numero de lot *' fullWidth error={!!errors.numero_lot} />
              )}
            />

            <Controller name='quantite' control={control} rules={{ required: true, min: 1 }}
              render={({ field }) => (
                <TextField {...field} label='Quantite *' type='number' fullWidth
                  error={!!errors.quantite}
                  onChange={e => field.onChange(Number(e.target.value))} />
              )}
            />

            <Controller name='date_expiration' control={control}
              render={({ field }) => (
                <TextField {...field} label="Date d'expiration" type='date' fullWidth
                  InputLabelProps={{ shrink: true }} />
              )}
            />

            <Controller name='fournisseur' control={control}
              render={({ field }) => (
                <TextField {...field} label='Fournisseur' fullWidth />
              )}
            />

            <Controller name='notes' control={control}
              render={({ field }) => (
                <TextField {...field} label='Notes / observations' multiline rows={3} fullWidth />
              )}
            />

            <Divider />
            <Box display='flex' gap={2} justifyContent='flex-end'>
              <Button onClick={() => navigate('/stock')}>Annuler</Button>
              <Button type='submit' variant='contained' disabled={createLot.isPending}>
                {createLot.isPending ? <CircularProgress size={20} /> : 'Enregistrer la reception'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

export default ReceptionPage
