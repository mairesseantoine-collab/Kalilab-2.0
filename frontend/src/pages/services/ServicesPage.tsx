import React, { useState } from 'react';
import {
  Box, Typography, Paper, Chip, Grid, Card, CardContent,
  IconButton, Collapse, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, TextField, MenuItem,
  Select, FormControl, InputLabel, Alert, CircularProgress,
  ToggleButtonGroup, ToggleButton, Badge, alpha,
} from '@mui/material';
import {
  ExpandMore, ExpandLess, Add, Edit, Folder, FolderOpen,
  Science, AccountTree, Search, FilterList,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import PageHeader from '../../components/common/PageHeader';
import { servicesApi, Service, Localisation } from '../../api/services';
import { useAuth } from '../../hooks/useAuth';

// ── Couleurs par site ─────────────────────────────────────────────────────────
const SITE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  both:  { label: 'STE + STM', color: '#1F497D', bg: '#EFF6FF' },
  STE:   { label: 'STE',       color: '#7C3AED', bg: '#F5F3FF' },
  STM:   { label: 'STM',       color: '#059669', bg: '#ECFDF5' },
};

// ── Nœud zone récursif ────────────────────────────────────────────────────────
const ZoneNode: React.FC<{
  zone: Localisation;
  depth: number;
  serviceId: number;
  onAddChild: (parentId: number) => void;
  canEdit: boolean;
}> = ({ zone, depth, serviceId, onAddChild, canEdit }) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = zone.enfants && zone.enfants.length > 0;

  return (
    <Box>
      <Box
        display="flex" alignItems="center" gap={0.5}
        sx={{
          pl: depth * 2.5 + 0.5,
          py: 0.4,
          borderRadius: 1,
          '&:hover': { bgcolor: 'grey.50' },
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {hasChildren ? (
          open
            ? <FolderOpen sx={{ fontSize: 16, color: '#F59E0B', flexShrink: 0 }} />
            : <Folder sx={{ fontSize: 16, color: '#F59E0B', flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 16, height: 16, flexShrink: 0,
            borderLeft: '2px solid #E5E7EB', borderBottom: '2px solid #E5E7EB',
            ml: 0.25, mb: 0.5 }} />
        )}
        <Typography
          variant="body2"
          sx={{ flexGrow: 1, fontSize: depth === 0 ? '0.85rem' : '0.8rem',
            fontWeight: depth === 0 ? 500 : 400, color: zone.actif ? 'text.primary' : 'text.disabled',
            textDecoration: zone.actif ? 'none' : 'line-through' }}
        >
          {zone.nom}
        </Typography>
        {canEdit && zone.actif && (
          <Tooltip title="Ajouter une sous-zone">
            <IconButton
              size="small"
              onClick={e => { e.stopPropagation(); onAddChild(zone.id); }}
              sx={{ opacity: 0, '.MuiBox-root:hover > &': { opacity: 1 },
                width: 22, height: 22 }}
            >
              <Add sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {hasChildren && (
        <Collapse in={open}>
          {zone.enfants.map(child => (
            <ZoneNode key={child.id} zone={child} depth={depth + 1}
              serviceId={serviceId} onAddChild={onAddChild} canEdit={canEdit} />
          ))}
        </Collapse>
      )}
    </Box>
  );
};

// ── Carte service ─────────────────────────────────────────────────────────────
const ServiceCard: React.FC<{
  service: Service;
  canEdit: boolean;
  onAddZone: (serviceId: number, parentId?: number) => void;
}> = ({ service, canEdit, onAddZone }) => {
  const [expanded, setExpanded] = useState(true);
  const siteCfg = SITE_CONFIG[service.site] ?? SITE_CONFIG.both;

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: service.actif ? 'divider' : 'error.light',
        opacity: service.actif ? 1 : 0.6,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: `0 4px 16px ${alpha(siteCfg.color, 0.1)}` },
      }}
    >
      {/* Header du service */}
      <Box
        display="flex" alignItems="center" gap={1.5}
        sx={{
          px: 2, py: 1.5,
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          background: `linear-gradient(135deg, ${alpha(siteCfg.color, 0.04)} 0%, transparent 100%)`,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Label chip */}
        <Chip
          label={service.label}
          size="small"
          sx={{
            bgcolor: siteCfg.bg,
            color: siteCfg.color,
            fontWeight: 800,
            fontSize: '0.72rem',
            letterSpacing: '0.04em',
            border: `1px solid ${alpha(siteCfg.color, 0.2)}`,
            minWidth: 52,
          }}
        />

        {/* Nom */}
        <Typography variant="body2" fontWeight={700} flex={1} color="text.primary">
          {service.nom}
        </Typography>

        {/* Badge site */}
        <Chip
          label={siteCfg.label}
          size="small"
          variant="outlined"
          sx={{ color: siteCfg.color, borderColor: alpha(siteCfg.color, 0.3),
            fontSize: '0.68rem', fontWeight: 600, height: 20 }}
        />

        {/* Compteur zones */}
        {service.nb_zones > 0 && (
          <Chip
            label={`${service.nb_zones} zone${service.nb_zones > 1 ? 's' : ''}`}
            size="small"
            sx={{ bgcolor: 'grey.100', color: 'text.secondary', fontSize: '0.68rem', height: 20 }}
          />
        )}

        {/* Actions */}
        {canEdit && service.actif && (
          <Tooltip title="Ajouter une zone">
            <IconButton
              size="small"
              onClick={e => { e.stopPropagation(); onAddZone(service.id); }}
              sx={{ color: siteCfg.color, width: 28, height: 28 }}
            >
              <Add sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Expand icon */}
        {expanded ? <ExpandLess sx={{ fontSize: 18, color: 'text.disabled' }} />
                  : <ExpandMore sx={{ fontSize: 18, color: 'text.disabled' }} />}
      </Box>

      {/* Zones */}
      <Collapse in={expanded}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          {service.localisations.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ pl: 0.5 }}>
              Aucune zone définie
            </Typography>
          ) : (
            service.localisations.map(zone => (
              <ZoneNode
                key={zone.id}
                zone={zone}
                depth={0}
                serviceId={service.id}
                onAddChild={(parentId) => onAddZone(service.id, parentId)}
                canEdit={canEdit}
              />
            ))
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};

// ── Dialog ajout zone ─────────────────────────────────────────────────────────
interface ZoneDialogProps {
  open: boolean;
  onClose: () => void;
  serviceId: number | null;
  parentId: number | null;
  serviceName?: string;
}

const ZoneDialog: React.FC<ZoneDialogProps> = ({ open, onClose, serviceId, parentId, serviceName }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ nom: string }>();

  const mutation = useMutation({
    mutationFn: (data: { nom: string }) =>
      servicesApi.addLocalisation(serviceId!, { nom: data.nom, parent_id: parentId ?? undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      reset();
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {parentId ? 'Ajouter une sous-zone' : 'Ajouter une zone'}
        {serviceName && (
          <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
            Service : {serviceName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus fullWidth size="small" label="Nom de la zone"
          {...register('nom', { required: 'Nom requis' })}
          error={!!errors.nom}
          helperText={errors.nom?.message}
          sx={{ mt: 1 }}
        />
        {mutation.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>Erreur lors de l'ajout</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleSubmit(d => mutation.mutate(d))}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <CircularProgress size={18} /> : 'Ajouter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Page principale ───────────────────────────────────────────────────────────
const ServicesPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'qualiticien';

  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [zoneDialog, setZoneDialog] = useState<{
    open: boolean; serviceId: number | null; parentId: number | null; serviceName?: string;
  }>({ open: false, serviceId: null, parentId: null });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', siteFilter],
    queryFn: () => servicesApi.list(
      siteFilter !== 'all' ? { site: siteFilter, actif: true } : { actif: true }
    ).then(r => r.data),
  });

  const filtered = services.filter(s => {
    const matchSite = siteFilter === 'all' || s.site === siteFilter || s.site === 'both';
    const matchSearch = !search || s.nom.toLowerCase().includes(search.toLowerCase())
      || s.label.toLowerCase().includes(search.toLowerCase());
    return matchSite && matchSearch;
  });

  const openZoneDialog = (serviceId: number, parentId?: number) => {
    const svc = services.find(s => s.id === serviceId);
    setZoneDialog({ open: true, serviceId, parentId: parentId ?? null, serviceName: svc?.nom });
  };

  const statsChips = [
    { label: 'services', value: services.length, color: '#1F497D' },
    { label: 'zones', value: services.reduce((acc, s) => acc + s.nb_zones, 0), color: '#F59E0B' },
  ];

  return (
    <Box>
      <PageHeader
        title="Arborescence documentaire"
        subtitle="Services et zones/localisations — ISO 15189"
        breadcrumbs={[{ label: 'Qualité' }, { label: 'Arborescence' }]}
        stats={statsChips}
      />

      {/* Filtres */}
      <Paper
        elevation={0}
        sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider',
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
      >
        <AccountTree sx={{ color: 'text.secondary', fontSize: 20 }} />
        <TextField
          size="small" placeholder="Rechercher un service ou zone…"
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ fontSize: 16, mr: 0.5, color: 'text.disabled' }} /> }}
          sx={{ width: 260 }}
        />
        <ToggleButtonGroup
          value={siteFilter} exclusive
          onChange={(_, v) => v && setSiteFilter(v)}
          size="small"
        >
          <ToggleButton value="all" sx={{ px: 1.5, fontSize: '0.75rem' }}>Tous</ToggleButton>
          <ToggleButton value="STE" sx={{ px: 1.5, fontSize: '0.75rem' }}>STE uniquement</ToggleButton>
          <ToggleButton value="STM" sx={{ px: 1.5, fontSize: '0.75rem' }}>STM uniquement</ToggleButton>
          <ToggleButton value="both" sx={{ px: 1.5, fontSize: '0.75rem' }}>Communs</ToggleButton>
        </ToggleButtonGroup>

        {/* Légende */}
        <Box display="flex" gap={1} ml="auto" flexWrap="wrap">
          {Object.entries(SITE_CONFIG).map(([key, cfg]) => (
            <Chip key={key} label={cfg.label} size="small"
              sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600,
                border: `1px solid ${alpha(cfg.color, 0.2)}`, fontSize: '0.7rem' }} />
          ))}
        </Box>
      </Paper>

      {/* Grille services */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Science sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            {search ? 'Aucun service ne correspond à votre recherche' : 'Aucun service défini'}
          </Typography>
          {!search && (
            <Typography variant="caption" color="text.disabled" display="block" mt={1}>
              Lancez <code>python seed_arborescence.py</code> dans le dossier backend
            </Typography>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map(service => (
            <Grid item xs={12} md={6} xl={4} key={service.id}>
              <ServiceCard
                service={service}
                canEdit={canEdit}
                onAddZone={openZoneDialog}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog ajout zone */}
      <ZoneDialog
        open={zoneDialog.open}
        onClose={() => setZoneDialog(d => ({ ...d, open: false }))}
        serviceId={zoneDialog.serviceId}
        parentId={zoneDialog.parentId}
        serviceName={zoneDialog.serviceName}
      />
    </Box>
  );
};

export default ServicesPage;
