import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Paper, Typography, Avatar, Chip, Divider, TextField,
  Button, IconButton, Tooltip, Alert, CircularProgress, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, MenuItem, alpha, useTheme, Badge, Stack,
  InputAdornment, List, ListItem, ListItemButton, ListItemAvatar,
  ListItemText, Skeleton,
} from '@mui/material';
import {
  Send, Reply, Delete, Inbox, Outbox, Add,
  MarkEmailRead, Search, Clear, Email, CheckCircle,
  ArrowBack, AttachEmail,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagerieApi } from '../../api/messagerie';
import { usersApi } from '../../api/users';
import { useAuth } from '../../hooks/useAuth';
import { Message } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';

dayjs.extend(relativeTime);
dayjs.locale('fr');

// ── Helpers ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#1F497D', '#2E7D32', '#1565C0', '#6A1B9A', '#AD1457',
  '#00695C', '#E65100', '#37474F',
];
const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

function formatDate(iso: string) {
  const d = dayjs(iso);
  if (d.isAfter(dayjs().subtract(1, 'day'))) return d.fromNow();
  if (d.isAfter(dayjs().subtract(7, 'day'))) return d.format('dddd [à] HH:mm');
  return d.format('DD/MM/YYYY [à] HH:mm');
}

// ── Compose Dialog ─────────────────────────────────────────────────────────────

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  replyTo?: Message | null;
}

const ComposeDialog: React.FC<ComposeDialogProps> = ({ open, onClose, replyTo }) => {
  const queryClient = useQueryClient();
  const [destinataireId, setDestinataire] = useState<number | ''>('');
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [sent, setSent] = useState(false);

  const { data: personnelData } = useQuery({
    queryKey: ['personnel'],
    queryFn: () => usersApi.listPersonnel().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (open) {
      if (replyTo) {
        setDestinataire(replyTo.expediteur.id);
        setSujet(replyTo.sujet.startsWith('Re:') ? replyTo.sujet : `Re: ${replyTo.sujet}`);
        setCorps('');
      } else {
        setDestinataire('');
        setSujet('');
        setCorps('');
      }
      setSent(false);
    }
  }, [open, replyTo]);

  const sendMutation = useMutation({
    mutationFn: () =>
      replyTo
        ? messagerieApi.reply(replyTo.id, { corps, destinataire_id: Number(destinataireId), sujet })
        : messagerieApi.send({ destinataire_id: Number(destinataireId), sujet, corps }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messagerie'] });
      setSent(true);
      setTimeout(onClose, 1500);
    },
  });

  const canSend = destinataireId !== '' && sujet.trim().length > 0 && corps.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Email color="primary" />
        <Typography variant="h6" fontWeight={700}>
          {replyTo ? `Répondre à ${replyTo.expediteur.prenom} ${replyTo.expediteur.nom}` : 'Nouveau message'}
        </Typography>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {sent ? (
          <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={3}>
            <CheckCircle sx={{ fontSize: 56, color: 'success.main' }} />
            <Typography variant="h6" fontWeight={700} color="success.main">Message envoyé !</Typography>
            <Typography variant="body2" color="text.secondary">
              Le destinataire recevra une notification par email Outlook.
            </Typography>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={2}>
            {!replyTo && (
              <FormControl fullWidth size="small">
                <InputLabel>Destinataire *</InputLabel>
                <Select
                  value={destinataireId}
                  label="Destinataire *"
                  onChange={e => setDestinataire(e.target.value as number)}
                >
                  {(personnelData ?? []).map((p: any) => (
                    <MenuItem key={p.id} value={p.id}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: avatarColor(p.id) }}>
                          {p.label?.[0]}
                        </Avatar>
                        {p.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {replyTo && (
              <Box display="flex" alignItems="center" gap={1.5} p={1.5} bgcolor="grey.50" borderRadius={1.5}>
                <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: avatarColor(replyTo.expediteur.id) }}>
                  {replyTo.expediteur.initiales}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {replyTo.expediteur.prenom} {replyTo.expediteur.nom}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{replyTo.expediteur.email}</Typography>
                </Box>
              </Box>
            )}
            <TextField
              fullWidth size="small"
              label="Sujet *"
              value={sujet}
              onChange={e => setSujet(e.target.value)}
            />
            <TextField
              fullWidth multiline rows={8}
              label="Message *"
              value={corps}
              onChange={e => setCorps(e.target.value)}
              placeholder="Rédigez votre message…"
            />
            {sendMutation.isError && (
              <Alert severity="error">Erreur lors de l'envoi. Vérifiez la connexion.</Alert>
            )}
          </Box>
        )}
      </DialogContent>
      {!sent && (
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={onClose}>Annuler</Button>
          <Button
            variant="contained"
            startIcon={sendMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Send />}
            disabled={!canSend || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

// ── Message Detail Panel ───────────────────────────────────────────────────────

interface MessageDetailProps {
  messageId: number;
  onReply: (msg: Message) => void;
  onDelete: (id: number) => void;
  onBack?: () => void;
}

const MessageDetail: React.FC<MessageDetailProps> = ({ messageId, onReply, onDelete, onBack }) => {
  const theme = useTheme();
  const { user: me } = useAuth();

  const { data: msg, isLoading } = useQuery({
    queryKey: ['messagerie', 'detail', messageId],
    queryFn: () => messagerieApi.get(messageId).then(r => r.data),
    enabled: !!messageId,
  });

  if (isLoading) return (
    <Box p={3}>
      <Skeleton variant="text" height={40} width="60%" sx={{ mb: 1 }} />
      <Skeleton variant="text" height={24} width="40%" sx={{ mb: 3 }} />
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
    </Box>
  );

  if (!msg) return null;

  const isReceived = msg.destinataire.id === me?.id;
  const other = isReceived ? msg.expediteur : msg.destinataire;

  return (
    <Box display="flex" flexDirection="column" height="100%">
      {/* Header */}
      <Box
        sx={{
          p: 2.5, borderBottom: 1, borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.03),
        }}
      >
        {onBack && (
          <IconButton size="small" onClick={onBack} sx={{ mb: 1 }}>
            <ArrowBack fontSize="small" />
          </IconButton>
        )}
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {msg.sujet}
        </Typography>
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: avatarColor(msg.expediteur.id) }}>
              {msg.expediteur.initiales}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {msg.expediteur.prenom} {msg.expediteur.nom}
              </Typography>
              <Typography variant="caption" color="text.secondary">{msg.expediteur.email}</Typography>
            </Box>
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
            {dayjs(msg.created_at).format('DD/MM/YYYY [à] HH:mm')}
          </Typography>
          {msg.email_envoye && (
            <Tooltip title="Notification email Outlook envoyée">
              <Chip
                label="Email envoyé"
                size="small"
                icon={<AttachEmail sx={{ fontSize: 12 }} />}
                sx={{ fontSize: 10, height: 20 }}
                color="success"
                variant="outlined"
              />
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Corps */}
      <Box flex={1} overflow="auto" p={2.5}>
        <Paper
          variant="outlined"
          sx={{ p: 2.5, borderRadius: 2, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}
        >
          {msg.corps}
        </Paper>

        {/* Fil de réponses */}
        {(msg.replies ?? []).length > 0 && (
          <Box mt={3}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={1.5}>
              {msg.replies!.length} RÉPONSE{msg.replies!.length > 1 ? 'S' : ''}
            </Typography>
            <Stack spacing={1.5}>
              {msg.replies!.map(r => {
                const isMine = r.expediteur.id === me?.id;
                return (
                  <Box
                    key={r.id}
                    sx={{
                      display: 'flex',
                      flexDirection: isMine ? 'row-reverse' : 'row',
                      gap: 1.5,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: avatarColor(r.expediteur.id), flexShrink: 0 }}>
                      {r.expediteur.initiales}
                    </Avatar>
                    <Box sx={{ maxWidth: '80%' }}>
                      <Paper
                        sx={{
                          p: 1.5,
                          bgcolor: isMine ? alpha(theme.palette.primary.main, 0.08) : 'grey.50',
                          borderRadius: 2,
                          borderTopLeftRadius: isMine ? 2 : 0,
                          borderTopRightRadius: isMine ? 0 : 2,
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {r.corps}
                        </Typography>
                      </Paper>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25, textAlign: isMine ? 'right' : 'left' }}>
                        {formatDate(r.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<Reply />}
          onClick={() => onReply(msg)}
        >
          Répondre
        </Button>
        <Tooltip title="Supprimer (vous uniquement)">
          <IconButton size="small" color="default" onClick={() => onDelete(msg.id)}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

const MessagingPage: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Auto-open compose dialog if ?compose=1 in URL (from CommandPalette shortcut)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('compose') === '1') {
      setComposeOpen(true);
      // Remove the query param without reloading
      navigate('/messagerie', { replace: true });
    }
  }, [location.search, navigate]);

  // Fetch lists
  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: ['messagerie', 'inbox'],
    queryFn: () => messagerieApi.inbox({ limit: 100 }).then(r => r.data),
    refetchInterval: 30_000,
  });
  const { data: sentData, isLoading: sentLoading } = useQuery({
    queryKey: ['messagerie', 'sent'],
    queryFn: () => messagerieApi.sent({ limit: 100 }).then(r => r.data),
    refetchInterval: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => messagerieApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messagerie'] });
      setSelectedId(null);
    },
  });

  const inboxItems: Message[] = inboxData?.items ?? [];
  const sentItems: Message[] = sentData?.items ?? [];
  const unreadCount = inboxItems.filter(m => !m.lu).length;

  const currentItems = tab === 'inbox' ? inboxItems : sentItems;
  const filtered = currentItems.filter(m =>
    !search ||
    m.sujet.toLowerCase().includes(search.toLowerCase()) ||
    m.expediteur.nom.toLowerCase().includes(search.toLowerCase()) ||
    m.expediteur.prenom.toLowerCase().includes(search.toLowerCase()) ||
    m.destinataire.nom.toLowerCase().includes(search.toLowerCase()) ||
    m.corps.toLowerCase().includes(search.toLowerCase())
  );

  const handleReply = (msg: Message) => {
    setReplyTo(msg);
    setComposeOpen(true);
  };

  const handleComposeClose = () => {
    setComposeOpen(false);
    setReplyTo(null);
  };

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Messagerie interne"
        subtitle="Communication entre membres de l'équipe — notification Outlook automatique"
        action={{
          label: 'Nouveau message',
          onClick: () => { setReplyTo(null); setComposeOpen(true); },
          icon: <Add />,
        }}
      />

      <Paper
        sx={{
          flex: 1, display: 'flex', overflow: 'hidden',
          borderRadius: 2, border: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* ── Left: list ──────────────────────────────────────────────── */}
        <Box
          sx={{
            width: { xs: selectedId ? 0 : '100%', md: 320 },
            minWidth: { md: 320 },
            borderRight: { md: `1px solid ${theme.palette.divider}` },
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1, pt: 1 }}>
            <Tabs
              value={tab}
              onChange={(_, v) => { setTab(v); setSelectedId(null); }}
              variant="fullWidth"
            >
              <Tab
                value="inbox"
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Inbox fontSize="small" />
                    Boîte de réception
                    {unreadCount > 0 && (
                      <Badge badgeContent={unreadCount} color="error" max={99} />
                    )}
                  </Box>
                }
              />
              <Tab
                value="sent"
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Outbox fontSize="small" />
                    Envoyés
                  </Box>
                }
              />
            </Tabs>
          </Box>

          {/* Search */}
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth size="small"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}>
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Message list */}
          <Box flex={1} overflow="auto">
            {(tab === 'inbox' ? inboxLoading : sentLoading) ? (
              <Box p={1.5}>
                {[1, 2, 3, 4].map(i => (
                  <Box key={i} display="flex" gap={1.5} mb={2}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Box flex={1}>
                      <Skeleton variant="text" height={20} width="70%" />
                      <Skeleton variant="text" height={16} width="90%" />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : filtered.length === 0 ? (
              <Box display="flex" flexDirection="column" alignItems="center" p={4} gap={1.5}>
                <Email sx={{ fontSize: 48, color: 'text.disabled' }} />
                <Typography color="text.secondary" variant="body2">
                  {search ? 'Aucun message trouvé' : tab === 'inbox' ? 'Boîte de réception vide' : 'Aucun message envoyé'}
                </Typography>
                {tab === 'inbox' && !search && (
                  <Button
                    size="small" variant="outlined" startIcon={<Add />}
                    onClick={() => { setReplyTo(null); setComposeOpen(true); }}
                  >
                    Envoyer un message
                  </Button>
                )}
              </Box>
            ) : (
              <List dense disablePadding>
                {filtered.map((msg, idx) => {
                  const other = tab === 'inbox' ? msg.expediteur : msg.destinataire;
                  const isSelected = selectedId === msg.id;
                  const isUnread = tab === 'inbox' && !msg.lu;

                  return (
                    <React.Fragment key={msg.id}>
                      <ListItem disablePadding>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => setSelectedId(msg.id)}
                          sx={{
                            py: 1.5, px: 2, gap: 0,
                            bgcolor: isUnread ? alpha('#1F497D', 0.04) : undefined,
                            '&.Mui-selected': {
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.14) },
                            },
                          }}
                        >
                          <ListItemAvatar sx={{ minWidth: 44 }}>
                            <Badge
                              variant="dot"
                              color="primary"
                              invisible={!isUnread}
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            >
                              <Avatar sx={{ width: 36, height: 36, fontSize: 13, bgcolor: avatarColor(other.id) }}>
                                {other.initiales}
                              </Avatar>
                            </Badge>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography
                                  variant="body2"
                                  fontWeight={isUnread ? 700 : 400}
                                  noWrap
                                  sx={{ maxWidth: 160 }}
                                >
                                  {other.prenom} {other.nom}
                                </Typography>
                                <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, ml: 1 }}>
                                  {formatDate(msg.created_at)}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography
                                  variant="caption"
                                  fontWeight={isUnread ? 600 : 400}
                                  color={isUnread ? 'text.primary' : 'text.secondary'}
                                  display="block"
                                  noWrap
                                >
                                  {msg.sujet}
                                </Typography>
                                <Typography variant="caption" color="text.disabled" noWrap display="block">
                                  {msg.corps.substring(0, 60)}{msg.corps.length > 60 ? '…' : ''}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                      {idx < filtered.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Box>

          {/* Footer */}
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.disabled">
              {filtered.length} message{filtered.length !== 1 ? 's' : ''}
              {unreadCount > 0 && tab === 'inbox' && ` · ${unreadCount} non lu${unreadCount > 1 ? 's' : ''}`}
            </Typography>
            <Tooltip title="Nouveau message (Ctrl+K → G)">
              <IconButton size="small" color="primary" onClick={() => { setReplyTo(null); setComposeOpen(true); }}>
                <Add fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ── Right: detail ────────────────────────────────────────────── */}
        <Box
          sx={{
            flex: 1,
            display: { xs: selectedId ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {selectedId ? (
            <MessageDetail
              messageId={selectedId}
              onReply={handleReply}
              onDelete={(id) => deleteMutation.mutate(id)}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <Box
              display="flex" flexDirection="column" alignItems="center" justifyContent="center"
              height="100%" gap={2} sx={{ color: 'text.disabled' }}
            >
              <MarkEmailRead sx={{ fontSize: 72, opacity: 0.3 }} />
              <Typography variant="h6" sx={{ opacity: 0.5 }}>Sélectionnez un message</Typography>
              <Typography variant="body2" sx={{ opacity: 0.4, textAlign: 'center', maxWidth: 280 }}>
                Cliquez sur un message à gauche pour le lire, ou composez un nouveau message.
              </Typography>
              <Button
                variant="outlined" size="small" startIcon={<Add />}
                onClick={() => { setReplyTo(null); setComposeOpen(true); }}
                sx={{ mt: 1 }}
              >
                Nouveau message
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Compose dialog */}
      <ComposeDialog
        open={composeOpen}
        onClose={handleComposeClose}
        replyTo={replyTo}
      />
    </Box>
  );
};

export default MessagingPage;
