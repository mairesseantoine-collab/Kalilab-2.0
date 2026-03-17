import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton, Divider, Stack,
  alpha,
} from '@mui/material';
import {
  Visibility, VisibilityOff,
  VerifiedUser, Speed, Groups,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

const schema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type FormData = z.infer<typeof schema>;

const FEATURES = [
  { icon: <VerifiedUser fontSize="small" />, label: 'Traçabilité qualité ISO 15189 · BELAC 668-MED' },
  { icon: <Speed fontSize="small" />, label: 'Tableau de bord en temps réel' },
  { icon: <Groups fontSize="small" />, label: 'Sites Ste-Elisabeth · St-Michel · Bella Vita' },
];

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          setError('Email ou mot de passe incorrect. Vérifiez vos identifiants.');
        } else if (err.response?.status === 429) {
          setError('Trop de tentatives. Veuillez patienter 60 secondes.');
        } else if (!err.response) {
          setError('Impossible de contacter le serveur. Vérifiez votre connexion ou réessayez.');
        } else {
          setError(`Erreur serveur (${err.response.status}). Contactez l'administrateur.`);
        }
      } else {
        setError('Une erreur inattendue s\'est produite.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1628 0%, #0c3060 50%, #0779BF 100%)',
        p: 2,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-30%', right: '-10%',
          width: '60vw', height: '60vw',
          borderRadius: '50%',
          background: alpha('#0779BF', 0.18),
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-20%', left: '-10%',
          width: '50vw', height: '50vw',
          borderRadius: '50%',
          background: alpha('#00897B', 0.1),
          pointerEvents: 'none',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 4,
          width: '100%',
          maxWidth: 900,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Left panel — branding Cliniques de l'Europe */}
        <Box
          sx={{
            flex: 1,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            color: '#fff',
            pr: 4,
          }}
        >
          {/* Logo + nom */}
          <Stack direction="row" alignItems="center" spacing={2} mb={3}>
            <Box
              component="img"
              src="https://www.cliniquesdeleurope.be/themes/custom/ceez_theme/logo.png"
              alt="Cliniques de l'Europe"
              sx={{
                height: 44,
                filter: 'brightness(0) invert(1)',
                objectFit: 'contain',
              }}
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </Stack>

          <Typography variant="h4" fontWeight={800} color="#fff" lineHeight={1.2} mb={0.5}>
            Cliniques de l'Europe
          </Typography>
          <Typography variant="subtitle1" color="rgba(255,255,255,0.7)" mb={3} fontWeight={400}>
            Laboratoire de Biologie Clinique
          </Typography>

          <Typography variant="h6" fontWeight={700} color="#fff" mb={1} lineHeight={1.5}>
            Gestion qualité<br />
            <Box component="span" sx={{ color: '#7dd3fc' }}>ISO 15189 intégrée.</Box>
          </Typography>

          <Typography variant="body2" color="rgba(255,255,255,0.65)" mb={4} lineHeight={1.8}>
            Plateforme SMQ dédiée au laboratoire — suivez vos non-conformités,
            équipements, risques et documents en un seul endroit.
          </Typography>

          <Stack spacing={1.5}>
            {FEATURES.map(({ icon, label }) => (
              <Stack key={label} direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    color: '#7dd3fc',
                    display: 'flex', p: 0.5,
                    bgcolor: 'rgba(125,211,252,0.1)',
                    borderRadius: 1,
                  }}
                >
                  {icon}
                </Box>
                <Typography variant="body2" color="rgba(255,255,255,0.8)">{label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Right panel — formulaire */}
        <Card
          sx={{
            width: { xs: '100%', md: 400 },
            flexShrink: 0,
            borderRadius: 3,
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Mobile logo */}
            <Box textAlign="center" mb={3} display={{ xs: 'flex', md: 'none' }}
              flexDirection="column" alignItems="center" gap={1}>
              <Box
                component="img"
                src="https://www.cliniquesdeleurope.be/themes/custom/ceez_theme/logo.png"
                alt="Cliniques de l'Europe"
                sx={{ height: 36, objectFit: 'contain' }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                Cliniques de l'Europe
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Laboratoire de Biologie Clinique
              </Typography>
            </Box>

            <Typography variant="h6" fontWeight={700} mb={0.5}>
              Connexion
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Entrez vos identifiants pour accéder à votre espace
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                fullWidth label="Adresse e-mail" type="email"
                autoComplete="email" autoFocus
                error={!!errors.email} helperText={errors.email?.message}
                sx={{ mb: 2 }} {...register('email')}
              />
              <TextField
                fullWidth label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                error={!!errors.password} helperText={errors.password?.message}
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end" size="small" tabIndex={-1}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                {...register('password')}
              />
              <Button
                fullWidth type="submit" variant="contained" size="large"
                disabled={loading}
                sx={{
                  height: 48, borderRadius: 2, fontSize: '1rem', fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(7,121,191,0.4)',
                  '&:hover': { boxShadow: '0 6px 20px rgba(7,121,191,0.5)' },
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Se connecter'}
              </Button>
            </form>

            <Divider sx={{ my: 3 }} />

            <Box
              sx={{
                p: 1.5, borderRadius: 1.5,
                bgcolor: alpha('#0779BF', 0.06),
                border: `1px solid ${alpha('#0779BF', 0.12)}`,
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                🔒 Connexion sécurisée — Accès réservé au personnel autorisé
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default LoginPage;
