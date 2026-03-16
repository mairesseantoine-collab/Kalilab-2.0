import React from 'react';
import {
  List, ListItem, ListItemText, Typography, Box, Chip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

interface Props { versions?: any[]; }

const VersionHistory: React.FC<Props> = ({ versions }) => {
  const { t } = useTranslation();

  if (!versions || versions.length === 0) {
    return <Typography color="text.secondary">{t('common.noData')}</Typography>;
  }

  return (
    <List dense>
      {versions.map((v, idx) => (
        <ListItem key={v.id} sx={{ px: 0 }}>
          <ListItemText
            primary={
              <Box display="flex" alignItems="center" gap={1}>
                <Chip label={`v${v.version}`} size="small" color={idx === 0 ? 'primary' : 'default'} />
                <Typography variant="body2">
                  {v.modification_note || '-'}
                </Typography>
              </Box>
            }
            secondary={
              <Box display="flex" gap={1} mt={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {v.modified_by ? `${v.modified_by.prenom} ${v.modified_by.nom}` : '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(v.created_at).format('DD/MM/YYYY HH:mm')}
                </Typography>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

export default VersionHistory;
