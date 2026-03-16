import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Divider, Chip,
  List, ListItem, ListItemText, Avatar, Skeleton, Button,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, LinearProgress, Stack,
  Table, TableBody, TableCell, TableRow, Collapse,
} from '@mui/material';
import {
  Edit, ArrowBack, AttachFile, Download, SwapHoriz,
  InsertDriveFile, History as HistoryIcon, CheckCircle, Cancel,
  Visibility, VisibilityOff, HowToReg, PeopleAlt, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDocument } from '../../hooks/useDocuments';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ErrorAlert from '../../components/common/ErrorAlert';
import DocumentWorkflow from '../../components/documents/DocumentWorkflow';
import { documentsApi } from '../../api/documents';
import { useAuth } from '../../hooks/useAuth';
import dayjs from 'dayjs';

// ─── Inline PDF viewer ─────────────────────────────────────────────────────

const PdfViewer: React.FC<{ docId: number }> = ({ docId }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (url) { setOpen(o => !o); return; }
    setLoading(true);
    setError('');
    try {
      const res = await documentsApi.getDownloadUrl(docId);
      setUrl(res.data.url);
      setOpen(true);
    } catch {
      setError('Impossible de charger le fichier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <Button
          size="small"
          variant="outlined"
          startIcon={open ? <VisibilityOff /> : <Visibility />}
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Chargement…' : open ? 'Masquer' : 'Visualiser le PDF'}
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      <Collapse in={open}>
        {url && (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
              mt: 1,
            }}
          >
            <iframe
              src={`${url}#toolbar=1`}
              title="PDF"
              width="100%"
              height={600}
              style={{ display: 'block', border: 'none' }}
            />
          </Box>
        )}
      </Collapse>
    </Box>
  );
};

// ─── File attachment card ──────────────────────────────────────────────────

const FileCard: React.FC<{ doc: any; onRefresh: () => void }> = ({ doc, onRefresh }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [replaceDialog, setReplaceDialog] = useState(false);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasFile = !!doc.fichier_path;
  const isPdf = hasFile && doc.fichier_path?.toLowerCase().endsWith('.pdf');

  const displayFilename = (): string => {
    if (!doc.fichier_path) return '';
    const parts = doc.fichier_path.split('/');
    const base = parts[parts.length - 1];
    const segments = base.split('_');
    if (segments.length >= 3) return segments.slice(2).join('_');
    return base;
  };

  const handleUpload = async (file: File) => {
    setUploadLoading(true);
    setError('');
    setSuccess('');
    try {
      await documentsApi.uploadFile(doc.id, file);
      setSuccess('Fichier attaché avec succès');
      queryClient.invalidateQueries({ queryKey: ['document', doc.id] });
      onRefresh();
    } catch {
      setError("Erreur lors de l'envoi du fichier");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await documentsApi.getDownloadUrl(doc.id);
      window.open(res.data.url, '_blank');
    } catch {
      setError('Erreur lors de la génération du lien de téléchargement');
    }
  };

  const handleReplace = async () => {
    if (!replaceFile) return;
    setUploadLoading(true);
    setError('');
    try {
      await documentsApi.remplacerFichier(doc.id, replaceFile, commentaire);
      setSuccess('Fichier remplacé avec succès');
      setReplaceDialog(false);
      setReplaceFile(null);
      setCommentaire('');
      queryClient.invalidateQueries({ queryKey: ['document', doc.id] });
      onRefresh();
    } catch {
      setError('Erreur lors du remplacement du fichier');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <AttachFile sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
          Fichier attaché
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {hasFile ? (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
              <InsertDriveFile color="primary" />
              <Box flex={1}>
                <Typography variant="body2" fontWeight={500}>{displayFilename()}</Typography>
                <Typography variant="caption" color="text.secondary">v{doc.version}</Typography>
              </Box>
              <Tooltip title="Télécharger">
                <IconButton size="small" color="primary" onClick={handleDownload}>
                  <Download />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remplacer le fichier">
                <IconButton size="small" color="warning" onClick={() => setReplaceDialog(true)}>
                  <SwapHoriz />
                </IconButton>
              </Tooltip>
            </Stack>

            {isPdf && <PdfViewer docId={doc.id} />}
            {uploadLoading && <LinearProgress sx={{ mb: 1 }} />}
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Aucun fichier attaché. Glissez un PDF, Word ou autre document.
            </Typography>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
              <AttachFile sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Cliquer pour attacher un fichier (PDF, Word, Excel...)
              </Typography>
              {uploadLoading && <LinearProgress sx={{ mt: 1 }} />}
            </Box>
          </Box>
        )}

        <input
          ref={replaceInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setReplaceFile(f); }}
        />
      </CardContent>

      <Dialog open={replaceDialog} onClose={() => setReplaceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Remplacer le fichier</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            L'ancien fichier sera conservé dans l'historique avec traçabilité complète.
          </Typography>
          <Box
            sx={{
              border: '2px dashed',
              borderColor: replaceFile ? 'success.main' : 'divider',
              borderRadius: 2,
              p: 2,
              textAlign: 'center',
              cursor: 'pointer',
              mb: 2,
              '&:hover': { borderColor: 'primary.main' },
            }}
            onClick={() => replaceInputRef.current?.click()}
          >
            {replaceFile ? (
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                <CheckCircle color="success" />
                <Typography variant="body2">{replaceFile.name}</Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Cliquer pour sélectionner le nouveau fichier
              </Typography>
            )}
          </Box>
          <TextField
            fullWidth
            label="Motif du remplacement (optionnel)"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            multiline
            rows={2}
            placeholder="Ex: Mise à jour suite à révision annuelle, correction d'erreur..."
          />
          {uploadLoading && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button startIcon={<Cancel />} onClick={() => { setReplaceDialog(false); setReplaceFile(null); setCommentaire(''); }}>
            Annuler
          </Button>
          <Button variant="contained" color="warning" onClick={handleReplace} disabled={!replaceFile || uploadLoading}>
            Remplacer
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

// ─── Version + File History ────────────────────────────────────────────────

const FileHistory: React.FC<{ historique: any[] }> = ({ historique }) => {
  if (historique.length === 0) {
    return <Typography variant="body2" color="text.secondary">Aucun historique</Typography>;
  }

  return (
    <List dense disablePadding>
      {[...historique].reverse().map((entry: any, idx: number) => (
        <ListItem key={idx} sx={{ px: 0, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: '50%', mt: 0.8, mr: 1.5, flexShrink: 0,
              bgcolor: entry.type === 'fichier' ? 'primary.main' : 'grey.400',
            }}
          />
          <ListItemText
            primary={
              <Box>
                {entry.type === 'fichier' ? (
                  <Typography variant="body2">
                    {entry.action === 'ajout' ? '📎 Fichier attaché' : '🔄 Fichier remplacé'}
                    {' '}
                    <Typography component="span" variant="body2" fontWeight={500}>
                      {entry.nom_fichier || (entry.nouveau_fichier?.split('/').pop() || '')}
                    </Typography>
                  </Typography>
                ) : (
                  <Typography variant="body2">
                    v{entry.version} — {entry.statut}
                  </Typography>
                )}
                {entry.commentaire && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: 'italic' }}>
                    {entry.commentaire}
                  </Typography>
                )}
              </Box>
            }
            secondary={
              <Typography variant="caption" color="text.secondary">
                {entry.auteur_nom || `Auteur #${entry.auteur_id}`}
                {' — '}
                {dayjs(entry.date).format('DD/MM/YYYY HH:mm')}
              </Typography>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

// ─── Qui a lu (e-Document Control) ────────────────────────────────────────

const QuiALu: React.FC<{ docId: number; version: string; maLecture: any }> = ({ docId, version, maLecture }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['document-lectures', docId],
    queryFn: () => documentsApi.getLectures(docId).then(r => r.data),
    staleTime: 60 * 1000,
    enabled: expanded,
  });

  const mutation = useMutation({
    mutationFn: () => documentsApi.accuserReception(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', docId] });
      queryClient.invalidateQueries({ queryKey: ['document-lectures', docId] });
    },
  });

  const dejaLu = maLecture?.lu && maLecture?.a_jour;
  const luAncienneVersion = maLecture?.lu && !maLecture?.a_jour;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">
            <HowToReg sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            Accusé de réception
          </Typography>
          {dejaLu ? (
            <Chip
              icon={<CheckCircle />}
              label={`Lu v${maLecture.version_lue} — ${dayjs(maLecture.lu_at).format('DD/MM/YYYY')}`}
              color="success"
              size="small"
            />
          ) : luAncienneVersion ? (
            <Chip label={`Lu v${maLecture.version_lue} — version actuelle v${version}`} color="warning" size="small" />
          ) : (
            <Chip label="Non lu" variant="outlined" size="small" />
          )}
        </Box>

        {!dejaLu && (
          <Button
            variant={luAncienneVersion ? 'outlined' : 'contained'}
            color="primary"
            size="small"
            startIcon={<HowToReg />}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            sx={{ mb: 1.5 }}
          >
            {luAncienneVersion ? `Confirmer lecture v${version}` : 'Marquer comme lu'}
          </Button>
        )}

        <Box
          display="flex"
          alignItems="center"
          gap={0.5}
          sx={{ cursor: 'pointer', color: 'text.secondary', mt: 0.5 }}
          onClick={() => setExpanded(e => !e)}
        >
          <PeopleAlt fontSize="small" />
          <Typography variant="caption">
            {data ? `${data.total} lecture${data.total > 1 ? 's' : ''} enregistrée${data.total > 1 ? 's' : ''}` : 'Voir qui a lu'}
          </Typography>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </Box>

        <Collapse in={expanded}>
          <Box mt={1}>
            {isLoading ? (
              <Skeleton variant="rectangular" height={60} />
            ) : data && data.lectures.length > 0 ? (
              <Table size="small">
                <TableBody>
                  {data.lectures.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell sx={{ py: 0.5 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'primary.light' }}>
                            {l.user.prenom[0]}{l.user.nom[0]}
                          </Avatar>
                          <Typography variant="body2">{l.user.prenom} {l.user.nom}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 0.5 }}>
                        <Chip
                          label={`v${l.version_lue}`}
                          size="small"
                          color={l.current_version ? 'success' : 'warning'}
                          sx={{ fontSize: 10 }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(l.lu_at).format('DD/MM/YYYY HH:mm')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="caption" color="text.secondary">Aucune lecture enregistrée</Typography>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────

const DocumentDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: doc, isLoading, error } = useDocument(Number(id));

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['documents', Number(id)] });
  };

  if (isLoading) return <Box p={3}><Skeleton variant="rectangular" height={400} /></Box>;
  if (error) return <ErrorAlert error={error} />;
  if (!doc) return null;
  const docAny = doc as any;
  const historique: any[] = docAny.historique_versions || [];

  // e-Doc metadata chips
  const metaChips = [
    docAny.type_document && { label: docAny.type_document.toUpperCase(), color: '#0779BF' },
    docAny.numero_document && { label: docAny.numero_document, color: '#6B7280' },
    docAny.periodicite_revision && { label: `Révision / ${docAny.periodicite_revision} mois`, color: '#F59E0B' },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <Box>
      <PageHeader
        title={doc.titre}
        subtitle={docAny.numero_document ? `${docAny.type_document ?? ''} · ${docAny.numero_document}` : undefined}
        breadcrumbs={[
          { label: t('documents.title'), path: '/documents' },
          { label: doc.titre },
        ]}
        action={{ label: t('common.edit'), onClick: () => navigate(`/documents/${doc.id}/edit`), icon: <Edit /> }}
      />
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Document metadata */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                <StatusChip status={doc.statut} />
                <Chip label={`v${doc.version}`} size="small" color="primary" />
                {doc.theme && <Chip label={doc.theme} size="small" />}
                {doc.classification && <Chip label={doc.classification} size="small" />}
                {metaChips.map((c) => (
                  <Chip key={c.label} label={c.label} size="small" sx={{ bgcolor: `${c.color}15`, color: c.color, fontWeight: 600 }} />
                ))}
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t('common.author')}</Typography>
                  <Typography>{docAny.auteur ? `${docAny.auteur.prenom} ${docAny.auteur.nom}` : '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t('documents.validityDate')}</Typography>
                  <Typography>
                    {doc.date_validite ? dayjs(doc.date_validite).format('DD/MM/YYYY') : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t('common.createdAt')}</Typography>
                  <Typography>{dayjs(doc.created_at).format('DD/MM/YYYY HH:mm')}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t('common.updatedAt')}</Typography>
                  <Typography>{dayjs(doc.updated_at).format('DD/MM/YYYY HH:mm')}</Typography>
                </Grid>
              </Grid>
              {doc.contenu && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>{t('documents.content')}</Typography>
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, maxHeight: 300, overflow: 'auto' }}>
                    <Typography variant="body2" whiteSpace="pre-wrap">{doc.contenu}</Typography>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>

          {/* File attachment */}
          <FileCard doc={docAny} onRefresh={handleRefresh} />

          {/* e-Document Control: Accusé de réception */}
          <QuiALu docId={Number(id)} version={doc.version} maLecture={docAny.ma_lecture} />

          {/* Workflow */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('documents.workflow')}</Typography>
              <DocumentWorkflow document={doc} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Signatures */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('documents.signatures')}</Typography>
              {(!docAny.signatures || docAny.signatures.length === 0) ? (
                <Typography color="text.secondary">{t('documents.noSignatures')}</Typography>
              ) : (
                <List dense>
                  {docAny.signatures.map((sig: any) => (
                    <ListItem key={sig.id} sx={{ px: 0 }}>
                      <Avatar sx={{ width: 28, height: 28, mr: 1, fontSize: 12, bgcolor: 'secondary.main' }}>
                        {sig.user?.prenom?.[0]}{sig.user?.nom?.[0]}
                      </Avatar>
                      <ListItemText
                        primary={sig.user ? `${sig.user.prenom} ${sig.user.nom}` : '-'}
                        secondary={dayjs(sig.signed_at).format('DD/MM/YYYY HH:mm')}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Version + file history */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                Historique
              </Typography>
              <FileHistory historique={historique} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box mt={2}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/documents')}>
          {t('common.back')}
        </Button>
      </Box>
    </Box>
  );
};

export default DocumentDetailPage;
