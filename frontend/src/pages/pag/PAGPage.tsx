import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Select, FormControl, InputLabel, FormControlLabel, Checkbox,
  Snackbar, Alert, LinearProgress, Paper, Grid, Stack,
  ToggleButtonGroup, ToggleButton, InputAdornment, Divider,
  alpha,
} from '@mui/material';
import {
  Add, Edit, Delete, CheckCircle, RadioButtonUnchecked, Search,
  FilterList, Close, Save, PlaylistAddCheck,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pagApi, ActionPAG, ActionPAGCreate, PAGReferentiels } from '../../api/pag';

// ── Couleurs par priorité ──────────────────────────────────────────────────────
const PRIO_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  '1- Imp + Urg':        { bg: '#FDECEA', color: '#C62828', border: '#EF9A9A' },
  '2- Non imp - Urg':    { bg: '#FFF8E1', color: '#E65100', border: '#FFCC80' },
  '3- Imp - Non Urg':    { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
  '4- Non Imp - Non Urg':{ bg: '#F3F4F6', color: '#607D8B', border: '#CFD8DC' },
};

// ── Couleur avancement ────────────────────────────────────────────────────────
function avancementColor(pct: number): string {
  if (pct === 100) return '#2E7D32';
  if (pct >= 75)   return '#388E3C';
  if (pct >= 50)   return '#F57C00';
  if (pct >= 25)   return '#FFA726';
  return '#9E9E9E';
}

// ── Composant barre d'avancement ──────────────────────────────────────────────
const AvancementBar: React.FC<{ value: number }> = ({ value }) => (
  <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
    <Box sx={{ flex: 1 }}>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{
          height: 8, borderRadius: 4,
          bgcolor: '#E0E0E0',
          '& .MuiLinearProgress-bar': { bgcolor: avancementColor(value), borderRadius: 4 },
        }}
      />
    </Box>
    <Typography variant="caption" fontWeight={700} sx={{ minWidth: 32, color: avancementColor(value) }}>
      {value}%
    </Typography>
  </Box>
);

// ── Chip priorité ─────────────────────────────────────────────────────────────
const PrioChip: React.FC<{ value: string }> = ({ value }) => {
  const c = PRIO_COLOR[value] ?? { bg: '#F3F4F6', color: '#607D8B', border: '#CFD8DC' };
  return (
    <Chip
      label={value}
      size="small"
      sx={{
        bgcolor: c.bg, color: c.color,
        border: `1px solid ${c.border}`,
        fontWeight: 700, fontSize: 11,
        height: 22,
      }}
    />
  );
};

// ── Formulaire PAG ────────────────────────────────────────────────────────────
interface FormState extends ActionPAGCreate {
  date_fin_prevue: string;
}

const EMPTY_FORM: FormState = {
  tache: '',
  attribution: '',
  avancement_notes: '',
  avancement_pct: 0,
  priorite: '3- Imp - Non Urg',
  date_fin_prevue: '',
  cloture: false,
  verification_efficacite: null,
  groupe: '',
  annexe: '',
  famille: '',
  responsable_pag: '',
};

// ── Page principale ───────────────────────────────────────────────────────────
const PAGPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filtres
  const [search, setSearch] = useState('');
  const [filterPrio, setFilterPrio] = useState<string[]>([]);
  const [filterCloture, setFilterCloture] = useState<'all' | 'open' | 'closed'>('all');
  const [filterResp, setFilterResp] = useState('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: refs } = useQuery<PAGReferentiels>({
    queryKey: ['pag', 'referentiels'],
    queryFn: () => pagApi.getReferentiels().then(r => r.data),
  });

  const { data: actions = [], isLoading } = useQuery<ActionPAG[]>({
    queryKey: ['pag', 'list'],
    queryFn: () => pagApi.list({ limit: 500 }).then(r => r.data),
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (d: ActionPAGCreate) => pagApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pag'] });
      setSnack({ open: true, msg: 'Action créée avec succès', severity: 'success' });
      setDialogOpen(false);
    },
    onError: () => setSnack({ open: true, msg: 'Erreur lors de la création', severity: 'error' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ActionPAGCreate> }) =>
      pagApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pag'] });
      setSnack({ open: true, msg: 'Action mise à jour', severity: 'success' });
      setDialogOpen(false);
    },
    onError: () => setSnack({ open: true, msg: 'Erreur lors de la mise à jour', severity: 'error' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => pagApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pag'] });
      setSnack({ open: true, msg: 'Action supprimée', severity: 'success' });
    },
  });

  // Quick toggle clôture
  const toggleCloture = (row: ActionPAG) => {
    updateMut.mutate({ id: row.id, data: { cloture: !row.cloture } });
  };

  // ── Filtrage local ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...actions];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(a =>
        a.tache.toLowerCase().includes(s) ||
        (a.attribution ?? '').toLowerCase().includes(s) ||
        (a.avancement_notes ?? '').toLowerCase().includes(s) ||
        (a.famille ?? '').toLowerCase().includes(s)
      );
    }
    if (filterPrio.length > 0) {
      list = list.filter(a => filterPrio.includes(a.priorite));
    }
    if (filterCloture === 'open') list = list.filter(a => !a.cloture);
    if (filterCloture === 'closed') list = list.filter(a => a.cloture);
    if (filterResp) list = list.filter(a => (a.attribution ?? '') === filterResp);
    return list;
  }, [actions, search, filterPrio, filterCloture, filterResp]);

  // ── Attributions uniques pour filtre ────────────────────────────────────────
  const attributions = useMemo(() =>
    Array.from(new Set(actions.map(a => a.attribution).filter(Boolean))).sort() as string[],
    [actions]
  );

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: actions.length,
    open: actions.filter(a => !a.cloture).length,
    imp_urg: actions.filter(a => a.priorite === '1- Imp + Urg' && !a.cloture).length,
    done100: actions.filter(a => a.avancement_pct === 100).length,
  }), [actions]);

  // ── Dialog helpers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: ActionPAG) => {
    setEditId(row.id);
    setForm({
      tache: row.tache,
      attribution: row.attribution ?? '',
      avancement_notes: row.avancement_notes ?? '',
      avancement_pct: row.avancement_pct,
      priorite: row.priorite,
      date_fin_prevue: row.date_fin_prevue ?? '',
      cloture: row.cloture,
      verification_efficacite: row.verification_efficacite ?? null,
      groupe: row.groupe ?? '',
      annexe: row.annexe ?? '',
      famille: row.famille ?? '',
      responsable_pag: row.responsable_pag ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload: ActionPAGCreate = {
      ...form,
      attribution: form.attribution || undefined,
      avancement_notes: form.avancement_notes || undefined,
      date_fin_prevue: form.date_fin_prevue || undefined,
      groupe: form.groupe || undefined,
      annexe: form.annexe || undefined,
      famille: form.famille || undefined,
      responsable_pag: form.responsable_pag || undefined,
    };
    if (editId !== null) {
      updateMut.mutate({ id: editId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  // ── Colonnes DataGrid ────────────────────────────────────────────────────────
  const columns: GridColDef[] = [
    {
      field: 'priorite', headerName: 'Priorité', width: 160,
      renderCell: (p: GridRenderCellParams) => <PrioChip value={p.value} />,
    },
    {
      field: 'cloture', headerName: 'Clôturé', width: 80, align: 'center', headerAlign: 'center',
      renderCell: (p: GridRenderCellParams) => (
        <Tooltip title={p.value ? 'Marquer ouvert' : 'Marquer clôturé'}>
          <IconButton size="small" onClick={() => toggleCloture(p.row)}>
            {p.value
              ? <CheckCircle fontSize="small" color="success" />
              : <RadioButtonUnchecked fontSize="small" color="disabled" />}
          </IconButton>
        </Tooltip>
      ),
    },
    {
      field: 'tache', headerName: 'Tâche', flex: 2, minWidth: 260,
      renderCell: (p: GridRenderCellParams) => (
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'normal', lineHeight: 1.4,
            textDecoration: p.row.cloture ? 'line-through' : 'none',
            color: p.row.cloture ? 'text.disabled' : 'text.primary',
            py: 0.5,
          }}
        >
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'attribution', headerName: 'Attribution', width: 120,
      renderCell: (p: GridRenderCellParams) => p.value
        ? <Chip label={p.value} size="small" variant="outlined" />
        : null,
    },
    {
      field: 'avancement_pct', headerName: 'Avancement', width: 160,
      renderCell: (p: GridRenderCellParams) => <AvancementBar value={p.value} />,
    },
    {
      field: 'date_fin_prevue', headerName: 'Date fin prévue', width: 130,
      renderCell: (p: GridRenderCellParams) => {
        if (!p.value) return null;
        const d = new Date(p.value);
        const overdue = !p.row.cloture && d < new Date();
        return (
          <Typography variant="caption" sx={{ color: overdue ? 'error.main' : 'text.secondary', fontWeight: overdue ? 700 : 400 }}>
            {d.toLocaleDateString('fr-BE')}
          </Typography>
        );
      },
    },
    {
      field: 'groupe', headerName: 'Groupe', width: 140,
      renderCell: (p: GridRenderCellParams) => p.value
        ? <Typography variant="caption">{p.value}</Typography>
        : null,
    },
    {
      field: 'annexe', headerName: 'Annexe', width: 140,
      renderCell: (p: GridRenderCellParams) => p.value
        ? <Typography variant="caption">{p.value}</Typography>
        : null,
    },
    {
      field: 'avancement_notes', headerName: 'Commentaires', flex: 1.5, minWidth: 200,
      renderCell: (p: GridRenderCellParams) => p.value
        ? (
          <Typography variant="caption" sx={{ whiteSpace: 'normal', color: 'text.secondary', py: 0.5 }}>
            {p.value}
          </Typography>
        )
        : null,
    },
    {
      field: 'verification_efficacite', headerName: 'Vérif. efficacité', width: 130, align: 'center', headerAlign: 'center',
      renderCell: (p: GridRenderCellParams) => {
        if (p.value === null || p.value === undefined) return <Typography variant="caption" color="text.disabled">—</Typography>;
        return <Chip label={p.value ? 'Oui' : 'Non'} size="small" color={p.value ? 'success' : 'default'} />;
      },
    },
    {
      field: 'actions', headerName: '', width: 80, sortable: false,
      renderCell: (p: GridRenderCellParams) => (
        <Stack direction="row">
          <Tooltip title="Modifier">
            <IconButton size="small" onClick={() => openEdit(p.row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton size="small" color="error" onClick={() => {
              if (window.confirm('Supprimer cette action ?')) deleteMut.mutate(p.row.id);
            }}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      {/* En-tête */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>PAG — Plan d'Actions et de Gestion</Typography>
          <Typography variant="body2" color="text.secondary">ISO 15189 · Biologistes</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Nouvelle action
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} mb={2}>
        {[
          { label: 'Total actions', value: stats.total, color: '#1565C0' },
          { label: 'En cours', value: stats.open, color: '#F57C00' },
          { label: 'Imp + Urgentes', value: stats.imp_urg, color: '#C62828' },
          { label: 'Terminées (100%)', value: stats.done100, color: '#2E7D32' },
        ].map(s => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filtres */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start" flexWrap="wrap">
          <TextField
            placeholder="Rechercher dans les tâches…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 260 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Statut</InputLabel>
            <Select
              value={filterCloture}
              label="Statut"
              onChange={e => setFilterCloture(e.target.value as any)}
            >
              <MenuItem value="all">Tous</MenuItem>
              <MenuItem value="open">En cours</MenuItem>
              <MenuItem value="closed">Clôturés</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Attribution</InputLabel>
            <Select
              value={filterResp}
              label="Attribution"
              onChange={e => setFilterResp(e.target.value)}
            >
              <MenuItem value="">Toutes</MenuItem>
              {attributions.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Priorité
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={filterPrio}
              onChange={(_, v) => setFilterPrio(v)}
            >
              {Object.entries(PRIO_COLOR).map(([prio, c]) => (
                <ToggleButton
                  key={prio}
                  value={prio}
                  sx={{
                    fontSize: 10, px: 1, py: 0.25,
                    '&.Mui-selected': { bgcolor: c.bg, color: c.color, borderColor: c.border },
                  }}
                >
                  {prio.split('- ')[0].trim()}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {(search || filterPrio.length > 0 || filterCloture !== 'all' || filterResp) && (
            <Button
              size="small"
              startIcon={<Close />}
              onClick={() => { setSearch(''); setFilterPrio([]); setFilterCloture('all'); setFilterResp(''); }}
            >
              Réinitialiser
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Grille */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          loading={isLoading}
          autoHeight
          getRowHeight={() => 'auto'}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          getRowClassName={(p) => p.row.cloture ? 'row-cloture' : ''}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': { bgcolor: '#F5F6FA', fontWeight: 700, fontSize: 12 },
            '& .MuiDataGrid-cell': { alignItems: 'flex-start', py: 0.5 },
            '& .row-cloture': { opacity: 0.55 },
          }}
        />
      </Paper>

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaylistAddCheck />
          {editId !== null ? 'Modifier l\'action PAG' : 'Nouvelle action PAG'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {/* Tâche */}
            <TextField
              label="Tâche *"
              multiline
              minRows={3}
              value={form.tache}
              onChange={e => setForm(f => ({ ...f, tache: e.target.value }))}
              fullWidth
            />

            <Grid container spacing={2}>
              {/* Attribution */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Attribution"
                  value={form.attribution}
                  onChange={e => setForm(f => ({ ...f, attribution: e.target.value }))}
                  fullWidth size="small"
                />
              </Grid>

              {/* Responsable PAG */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Responsable PAG"
                  value={form.responsable_pag}
                  onChange={e => setForm(f => ({ ...f, responsable_pag: e.target.value }))}
                  fullWidth size="small"
                  helperText="Ex: Vanneste, Biologistes…"
                />
              </Grid>

              {/* Priorité */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priorité</InputLabel>
                  <Select
                    value={form.priorite}
                    label="Priorité"
                    onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                  >
                    {(refs?.priorites ?? Object.keys(PRIO_COLOR)).map(p => (
                      <MenuItem key={p} value={p}>
                        <PrioChip value={p} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Avancement % */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Avancement %</InputLabel>
                  <Select
                    value={form.avancement_pct}
                    label="Avancement %"
                    onChange={e => setForm(f => ({ ...f, avancement_pct: Number(e.target.value) }))}
                  >
                    {[0, 25, 50, 75, 100].map(v => (
                      <MenuItem key={v} value={v}>{v}%</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Date fin prévue */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date de fin prévue"
                  type="date"
                  value={form.date_fin_prevue}
                  onChange={e => setForm(f => ({ ...f, date_fin_prevue: e.target.value }))}
                  fullWidth size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Vérification efficacité */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Vérification d'efficacité</InputLabel>
                  <Select
                    value={form.verification_efficacite === null ? '' : form.verification_efficacite ? 'oui' : 'non'}
                    label="Vérification d'efficacité"
                    onChange={e => {
                      const v = e.target.value;
                      setForm(f => ({ ...f, verification_efficacite: v === '' ? null : v === 'oui' }));
                    }}
                  >
                    <MenuItem value="">Sans objet</MenuItem>
                    <MenuItem value="oui">Oui</MenuItem>
                    <MenuItem value="non">Non</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Groupe */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Groupe</InputLabel>
                  <Select
                    value={form.groupe}
                    label="Groupe"
                    onChange={e => setForm(f => ({ ...f, groupe: e.target.value }))}
                  >
                    <MenuItem value=""><em>Aucun</em></MenuItem>
                    {(refs?.groupes ?? []).map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Annexe */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Annexe / Type</InputLabel>
                  <Select
                    value={form.annexe}
                    label="Annexe / Type"
                    onChange={e => setForm(f => ({ ...f, annexe: e.target.value }))}
                  >
                    <MenuItem value=""><em>Aucune</em></MenuItem>
                    {(refs?.annexes ?? []).map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Famille ISO */}
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Famille (ISO 15189)</InputLabel>
                  <Select
                    value={form.famille}
                    label="Famille (ISO 15189)"
                    onChange={e => setForm(f => ({ ...f, famille: e.target.value }))}
                    MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                  >
                    <MenuItem value=""><em>Aucune</em></MenuItem>
                    {(refs?.familles ?? []).map(fam => (
                      <MenuItem key={fam} value={fam} sx={{ fontSize: 13 }}>{fam}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider />

            {/* Notes d'avancement */}
            <TextField
              label="Notes d'avancement (journal horodaté)"
              multiline
              minRows={4}
              value={form.avancement_notes}
              onChange={e => setForm(f => ({ ...f, avancement_notes: e.target.value }))}
              fullWidth
              helperText="Ajoutez la date devant chaque entrée, ex: 14/03/2024 — L'appareil a été installé…"
            />

            {/* Clôturé */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.cloture}
                  onChange={e => setForm(f => ({ ...f, cloture: e.target.checked }))}
                  color="success"
                />
              }
              label="Action clôturée"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} startIcon={<Close />}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!form.tache.trim() || createMut.isPending || updateMut.isPending}
            startIcon={<Save />}
          >
            {editId !== null ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PAGPage;
