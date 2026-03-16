import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, Box, TextField, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Chip, Divider, InputAdornment, alpha, useTheme,
} from '@mui/material';
import {
  Search, Dashboard, ReportProblem, Chat, Gavel, Warning, BarChart,
  FolderOpen, Edit, Build, People, Inventory, Assignment,
  Add, ArrowForward, Keyboard, Mail,
} from '@mui/icons-material';

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
  group: string;
  shortcut?: string;
  color?: string;
  tags?: string[];
}

const ALL_COMMANDS: CommandItem[] = [
  // Navigation
  { id: 'dashboard', label: 'Tableau de bord', sublabel: 'Vue générale', icon: <Dashboard />, path: '/dashboard', group: 'Navigation', color: '#1F497D' },
  { id: 'nc', label: 'Non-Conformités', sublabel: 'Liste des NC', icon: <ReportProblem />, path: '/nonconformities', group: 'Navigation', color: '#ef4444', tags: ['nc', 'nonconformite', 'ecart'] },
  { id: 'complaints', label: 'Plaintes & Réclamations', sublabel: 'Suivi des plaintes', icon: <Chat />, path: '/complaints', group: 'Navigation', color: '#f97316', tags: ['plainte', 'reclamation'] },
  { id: 'audits', label: 'Audits', sublabel: 'Planification et suivi', icon: <Gavel />, path: '/audits', group: 'Navigation', color: '#3b82f6', tags: ['audit'] },
  { id: 'risks', label: 'Risques', sublabel: 'Analyse des risques', icon: <Warning />, path: '/risks', group: 'Navigation', color: '#8b5cf6', tags: ['risque', 'risk'] },
  { id: 'kpi', label: 'Indicateurs qualité', sublabel: 'KPI et mesures', icon: <BarChart />, path: '/kpi', group: 'Navigation', color: '#10b981', tags: ['kpi', 'indicateur', 'qualite'] },
  { id: 'documents', label: 'Documents qualité', sublabel: 'Gestion documentaire', icon: <FolderOpen />, path: '/documents', group: 'Navigation', color: '#06b6d4', tags: ['document', 'procedure', 'sop'] },
  { id: 'redaction', label: 'Rédaction', sublabel: 'AMDEC et dossiers', icon: <Edit />, path: '/redaction', group: 'Navigation', color: '#64748b', tags: ['amdec', 'redaction', 'dossier'] },
  { id: 'equipment', label: 'Équipements', sublabel: 'Parc matériel et calibrations', icon: <Build />, path: '/equipment', group: 'Navigation', color: '#0ea5e9', tags: ['equipement', 'calibration', 'materiel'] },
  { id: 'hr', label: 'Ressources humaines', sublabel: 'Compétences et formations', icon: <People />, path: '/hr', group: 'Navigation', color: '#ec4899', tags: ['rh', 'competence', 'formation'] },
  { id: 'stock', label: 'Stocks', sublabel: 'Lots et réactifs', icon: <Inventory />, path: '/stock', group: 'Navigation', color: '#84cc16', tags: ['stock', 'lot', 'reactif'] },
  { id: 'audit-trail', label: 'Journal d\'audit', sublabel: 'Traçabilité des actions', icon: <Assignment />, path: '/audit-trail', group: 'Navigation', color: '#94a3b8', tags: ['audit trail', 'journal', 'log'] },
  { id: 'messagerie', label: 'Messagerie', sublabel: 'Boîte de réception interne', icon: <Mail />, path: '/messagerie', group: 'Navigation', color: '#3b82f6', tags: ['message', 'messagerie', 'email', 'inbox', 'mail'] },

  // Actions rapides
  { id: 'new-nc', label: 'Déclarer une NC', sublabel: 'Nouvelle non-conformité', icon: <Add />, path: '/nonconformities/new', group: 'Créer', color: '#ef4444', shortcut: 'N' },
  { id: 'new-complaint', label: 'Enregistrer une plainte', sublabel: 'Nouvelle plainte', icon: <Add />, path: '/complaints/new', group: 'Créer', color: '#f97316', shortcut: 'P' },
  { id: 'new-audit', label: 'Planifier un audit', sublabel: 'Nouvel audit', icon: <Add />, path: '/audits/new', group: 'Créer', color: '#3b82f6' },
  { id: 'new-risk', label: 'Ajouter un risque', sublabel: 'Nouveau risque', icon: <Add />, path: '/risks/new', group: 'Créer', color: '#8b5cf6' },
  { id: 'new-document', label: 'Créer un document', sublabel: 'Nouveau document qualité', icon: <Add />, path: '/documents/new', group: 'Créer', color: '#06b6d4' },
  { id: 'new-equipment', label: 'Ajouter un équipement', sublabel: 'Nouvel équipement', icon: <Add />, path: '/equipment/new', group: 'Créer', color: '#0ea5e9' },
  { id: 'new-reception', label: 'Réception de lot', sublabel: 'Enregistrer une réception', icon: <Add />, path: '/stock/reception', group: 'Créer', color: '#84cc16' },
  { id: 'new-message', label: 'Nouveau message', sublabel: 'Envoyer un message interne', icon: <Mail />, path: '/messagerie?compose=1', group: 'Créer', color: '#3b82f6', shortcut: 'G', tags: ['message', 'envoyer', 'mail'] },
];

const GROUP_ORDER = ['Créer', 'Navigation'];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter commands based on query
  const filtered = query.trim()
    ? ALL_COMMANDS.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.sublabel?.toLowerCase().includes(q) ||
          cmd.tags?.some((t) => t.includes(q)) ||
          cmd.group.toLowerCase().includes(q)
        );
      })
    : ALL_COMMANDS;

  // Group filtered results
  const grouped = GROUP_ORDER.reduce<Record<string, CommandItem[]>>((acc, g) => {
    const items = filtered.filter((c) => c.group === g);
    if (items.length > 0) acc[g] = items;
    return acc;
  }, {});

  // Flat list for keyboard nav
  const flatList = Object.values(grouped).flat();

  const execute = useCallback((cmd: CommandItem) => {
    onClose();
    setQuery('');
    setSelectedIndex(0);
    if (cmd.action) cmd.action();
    else if (cmd.path) navigate(cmd.path);
  }, [navigate, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flatList[selectedIndex];
        if (cmd) execute(cmd);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flatList, selectedIndex, execute, onClose]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  let flatIndex = 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 600,
          maxWidth: '95vw',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          position: 'fixed',
          top: '15vh',
          m: 0,
        },
      }}
      BackdropProps={{
        sx: { backdropFilter: 'blur(4px)', bgcolor: 'rgba(0,0,0,0.4)' },
      }}
    >
      {/* Search input */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
        }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="Rechercher une page ou une action…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          variant="standard"
          InputProps={{
            disableUnderline: true,
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'text.secondary', fontSize: 22 }} />
              </InputAdornment>
            ),
            sx: { fontSize: '1.1rem', py: 0.5 },
          }}
        />
      </Box>

      {/* Results */}
      <Box
        sx={{
          maxHeight: '60vh',
          overflowY: 'auto',
          bgcolor: 'background.paper',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.palette.primary.main, 0.2), borderRadius: 3 },
        }}
      >
        {flatList.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Search sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">Aucun résultat pour « {query} »</Typography>
          </Box>
        ) : (
          <List ref={listRef} disablePadding>
            {Object.entries(grouped).map(([group, items]) => (
              <React.Fragment key={group}>
                <Box
                  sx={{
                    px: 2, py: 0.75,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={1}>
                    {group}
                  </Typography>
                </Box>
                {items.map((cmd) => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <ListItemButton
                      key={cmd.id}
                      data-index={idx}
                      selected={isSelected}
                      onClick={() => execute(cmd)}
                      sx={{
                        px: 2, py: 1,
                        borderLeft: isSelected ? `3px solid ${cmd.color || theme.palette.primary.main}` : '3px solid transparent',
                        bgcolor: isSelected ? alpha(cmd.color || theme.palette.primary.main, 0.06) : 'transparent',
                        '&:hover': {
                          bgcolor: alpha(cmd.color || theme.palette.primary.main, 0.06),
                          borderLeftColor: cmd.color || theme.palette.primary.main,
                        },
                        transition: 'all 0.1s',
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36,
                          color: cmd.color || theme.palette.primary.main,
                        }}
                      >
                        <Box
                          sx={{
                            bgcolor: alpha(cmd.color || theme.palette.primary.main, 0.12),
                            borderRadius: 1,
                            p: 0.5,
                            display: 'flex',
                            '& svg': { fontSize: 18 },
                          }}
                        >
                          {cmd.icon}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={isSelected ? 600 : 500}>
                            {cmd.label}
                          </Typography>
                        }
                        secondary={
                          cmd.sublabel && (
                            <Typography variant="caption" color="text.secondary">{cmd.sublabel}</Typography>
                          )
                        }
                      />
                      {cmd.shortcut && (
                        <Chip
                          label={cmd.shortcut}
                          size="small"
                          sx={{
                            fontSize: 10,
                            height: 20,
                            bgcolor: alpha(theme.palette.action.selected, 0.5),
                            fontFamily: 'monospace',
                            fontWeight: 700,
                          }}
                        />
                      )}
                      {isSelected && (
                        <ArrowForward sx={{ fontSize: 16, color: cmd.color || theme.palette.primary.main, ml: 0.5 }} />
                      )}
                    </ListItemButton>
                  );
                })}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 2, py: 1,
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.action.hover, 0.5),
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {[
          { keys: ['↑', '↓'], label: 'Naviguer' },
          { keys: ['↵'], label: 'Ouvrir' },
          { keys: ['Esc'], label: 'Fermer' },
        ].map(({ keys, label }) => (
          <Box key={label} display="flex" alignItems="center" gap={0.5}>
            {keys.map((k) => (
              <Box
                key={k}
                component="kbd"
                sx={{
                  px: 0.75, py: 0.25,
                  bgcolor: 'background.paper',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 0.75,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: 'text.secondary',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.1)',
                }}
              >
                {k}
              </Box>
            ))}
            <Typography variant="caption" color="text.disabled">{label}</Typography>
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <Box display="flex" alignItems="center" gap={0.5}>
          <Keyboard sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled">Ctrl+K</Typography>
        </Box>
      </Box>
    </Dialog>
  );
};

export default CommandPalette;
