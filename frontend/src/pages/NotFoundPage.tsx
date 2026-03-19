import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button, Paper } from '@mui/material';
import { HomeOutlined, ArrowBack, SearchOff } from '@mui/icons-material';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="#F5F6FA"
      p={3}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 4, md: 6 },
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: 'grey.100',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <SearchOff sx={{ fontSize: 40, color: 'text.disabled' }} />
        </Box>

        <Typography variant="h1" fontWeight={900} color="text.disabled" lineHeight={1} mb={1}>
          404
        </Typography>
        <Typography variant="h5" fontWeight={700} mb={1}>
          Page introuvable
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={0.5}>
          La page{' '}
          <Box
            component="code"
            sx={{
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'grey.100',
              fontFamily: 'monospace',
              fontSize: 13,
              color: 'text.primary',
              wordBreak: 'break-all',
            }}
          >
            {location.pathname}
          </Box>
          {' '}n'existe pas.
        </Typography>
        <Typography variant="caption" color="text.disabled" display="block" mb={4}>
          Vérifiez l'URL ou revenez au tableau de bord.
        </Typography>

        <Box display="flex" gap={1.5} justifyContent="center" flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<HomeOutlined />}
            onClick={() => navigate('/dashboard')}
            disableElevation
          >
            Tableau de bord
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
          >
            Page précédente
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default NotFoundPage;
