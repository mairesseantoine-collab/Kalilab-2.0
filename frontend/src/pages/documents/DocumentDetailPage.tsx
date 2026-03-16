import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Divider, Chip,
  List, ListItem, ListItemText, Avatar, Skeleton, Button,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, LinearProgress, Stack,
} from '@mui/material';
import {
  Edit, ArrowBack, AttachFile, Download, SwapHoriz,
  InsertDriveFile, History as HistoryIcon, CheckCircle, Cancel,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDocument } from '../../hooks/useDocuments';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ErrorAlert from '../../components/common/ErrorAlert';
import DocumentWorkflow from '../../components/documents/DocumentWorkflow';
import { documentsApi } from '../../api/documents';
import dayjs from 'dayjs';

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

  // Extract display filename from storage path
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
      setError('Erreur lors de l\'envoi du fichier');
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

        {/* Hidden file input for replace */}
        <input
          ref={replaceInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setReplaceFile(f); }}
        />
      </CardContent>

      {/* Replace Dialog */}
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
  const fileEvents = historique.filter((h: any) => h.type === 'fichier');
  const versionEvents = historique.filter((h: any) => h.type !== 'fichier');

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

// ─── Main Page ─────────────────────────────────────────────────────────────

const DocumentDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: doc, isLoading, error } = useDocument(Number(id));

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['document', Number(id)] });
  };

  if (isLoading) return <Box p={3}><Skeleton variant="rectangular" height={400} /></Box>;
  if (error) return <ErrorAlert error={error} />;
  if (!doc) return null;
  const docAny = doc as any;
  const historique: any[] = docAny.historique_versions || [];

  return (
    <Box>
      <PageHeader
        title={doc.titre}
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
