import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Card, CardContent, CardHeader, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert, Snackbar,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { complaintsApi } from '../../api/complaints'
import { usersApi } from '../../api/users'
import PageHeader from '../../components/common/PageHeader'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'

interface FormValues { source: string; description: string; responsable_id: number | null }

const ComplaintFormPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'success' as 'success'|'error' })

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { source: 'patient', description: '', responsable_id: null },
  })

  const { data: personnelData } = useQuery({
    queryKey: ['personnel'],
    queryFn: () => usersApi.listPersonnel().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = { ...data, responsable_id: data.responsable_id ?? undefined }
      return complaintsApi.create(payload)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      setSnackbar({ open: true, message: 'Plainte enregistree', severity: 'success' })
      setTimeout(() => navigate(`/complaints/${(res.data as any).id}`), 1000)
    },
    onError: () => setSnackbar({ open: true, message: 'Erreur enregistrement', severity: 'error' }),
  })

  return (
    <Box>
      <PageHeader title={t('complaints.new')}
        actionButton={
          <Button variant='outlined' startIcon={<ArrowBackIcon />} onClick={() => navigate('/complaints')}>
            {t('common.back')}
          </Button>
        }
      />
      <Card sx={{ maxWidth: 700 }}>
        <CardHeader title='Nouvelle reclamation / plainte' />
        <CardContent>
          <Box component='form' onSubmit={handleSubmit(d => createMutation.mutate(d))}
            display='flex' flexDirection='column' gap={3}>
            <Controller name='source' control={control} rules={{ required: true }}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.source}>
                  <InputLabel>{t('complaints.source')} *</InputLabel>
                  <Select {...field} label={`${t('complaints.source')} *`}>
                    {['patient', 'medecin', 'interne', 'organisme'].map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller name='description' control={control} rules={{ required: true, minLength: 10 }}
              render={({ field }) => (
                <TextField {...field} label={`${t('complaints.description')} *`}
                  multiline rows={6} fullWidth error={!!errors.description}
                  helperText={errors.description ? 'Description requise (min. 10 caracteres)' : ''}
                  placeholder='Decrivez precisement la plainte...' />
              )}
            />
            <Controller name='responsable_id' control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Responsable du traitement</InputLabel>
                  <Select
                    {...field}
                    value={field.value ?? ''}
                    label='Responsable du traitement'
                    onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                  >
                    <MenuItem value=''><em>Non attribué</em></MenuItem>
                    {(personnelData ?? []).map(p => (
                      <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Box display='flex' gap={2} justifyContent='flex-end'>
              <Button onClick={() => navigate('/complaints')}>{t('common.cancel')}</Button>
              <Button type='submit' variant='contained' disabled={createMutation.isPending}>
                {createMutation.isPending ? <CircularProgress size={20} /> : t('common.save')}
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

export default ComplaintFormPage
