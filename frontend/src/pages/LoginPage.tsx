import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton, Divider, Stack,
  alpha,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Science,
  VerifiedUser, Speed, Groups,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type FormData = z.infer<typeof schema>;

const FEATURES = [
  { icon: <VerifiedUser fontSize="small" />, label: 'Traçabilité qualité ISO 15189' },
  { icon: <Speed fontSize="small" />, label: 'Tableau de bord en temps réel' },
  { icon: <Groups fontSize="small" />, label: 'Conçu pour votre équipe' },
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
    } catch {
      setError('Email ou mot de passe incorrect. Vérifiez vos identifiants.');
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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1F497D 100%)',
        p: 2,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-30%',
          right: '-10%',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: alpha('#2D6BA3', 0.15),
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-20%',
          left: '-10%',
          width: '50vw',
          height: '50vw',
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
          maxWidth: 860,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Left panel — branding */}
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
          <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
            <Box
              sx={{
                width: 52, height: 52,
                bgcolor: 'rgba(255,255,255,0.15)',
                borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <Science sx={{ fontSize: 28, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={800} color="#fff" lineHeight={1}>
                KaliLab
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.7)">
                Système qualité de laboratoire
              </Typography>
            </Box>
          </Stack>

          <Typography variant="h5" fontWeight={700} color="#fff" mb={1.5} lineHeight={1.4}>
            Gérez votre qualité<br />
            <Box component="span" sx={{ color: '#7dd3fc' }}>sereinement.</Box>
          </Typography>

          <Typography variant="body2" color="rgba(255,255,255,0.65)" mb={4} lineHeight={1.8}>
            Plateforme de gestion qualité ISO 15189 conçue pour les laboratoires médicaux.
            Suivez vos non-conformités, vos équipements et vos documents en un seul endroit.
          </Typography>

          <Stack spacing={1.5}>
            {FEATURES.map(({ icon, label }) => (
              <Stack key={label} direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    color: '#7dd3fc',
                    display: 'flex',
                    p: 0.5,
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

        {/* Right panel — login form */}
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
            <Box textAlign="center" mb={4} display={{ xs: 'block', md: 'none' }}>
              <Science sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h5" fontWeight={700} color="primary.main">KaliLab</Typography>
              <Typography variant="body2" color="text.secondary">Système qualité de laboratoire</Typography>
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
                fullWidth
                label="Adresse e-mail"
                type="email"
                autoComplete="email"
                autoFocus
                error={!!errors.email}
                helperText={errors.email?.message}
                sx={{ mb: 2 }}
                {...register('email')}
              />
              <TextField
                fullWidth
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        tabIndex={-1}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                {...register('password')}
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  height: 48,
                  borderRadius: 2,
                  fontSize: '1rem',
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(31,73,125,0.4)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(31,73,125,0.5)',
                  },
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Se connecter'}
              </Button>
            </form>

            <Divider sx={{ my: 3 }} />

            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: alpha('#1F497D', 0.06),
                border: `1px solid ${alpha('#1F497D', 0.12)}`,
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
