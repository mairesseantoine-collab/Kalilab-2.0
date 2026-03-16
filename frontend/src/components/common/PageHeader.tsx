import React from 'react';
import { Box, Typography, Breadcrumbs, Link, Button, Chip, alpha } from '@mui/material';
import { NavigateNext } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface StatBadge {
  label: string;
  value: string | number;
  color?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    color?: string;
  };
  actionButton?: React.ReactNode;
  /** Petites statistiques affichées sous le titre */
  stats?: StatBadge[];
  /** Contenu additionnel à droite (ex: filtres, sélecteurs) */
  extra?: React.ReactNode;
}

const PageHeader: React.FC<Props> = ({
  title,
  subtitle,
  breadcrumbs,
  action,
  actionButton,
  stats,
  extra,
}) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ mb: 3 }}>
      {/* Fil d'Ariane */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNext sx={{ fontSize: 13, color: 'text.disabled' }} />}
          sx={{ mb: 1.25 }}
        >
          {breadcrumbs.map((item, idx) =>
            item.path ? (
              <Link
                key={idx}
                component="button"
                onClick={() => navigate(item.path!)}
                underline="hover"
                sx={{
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                  fontWeight: 500,
                  lineHeight: 1,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {item.label}
              </Link>
            ) : (
              <Typography
                key={idx}
                sx={{ fontSize: '0.72rem', color: 'text.primary', fontWeight: 600, lineHeight: 1 }}
              >
                {item.label}
              </Typography>
            )
          )}
        </Breadcrumbs>
      )}

      {/* Ligne principale */}
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
        {/* Accent bar + texte */}
        <Box display="flex" alignItems="stretch" gap={2} flex={1} minWidth={0}>
          {/* Barre colorée verticale */}
          <Box
            aria-hidden
            sx={{
              width: 4,
              minHeight: subtitle || stats ? 56 : 38,
              borderRadius: 2,
              flexShrink: 0,
              background: 'linear-gradient(180deg, #1F497D 0%, #2D6BA3 100%)',
            }}
          />

          {/* Titre + sous-titre + stats */}
          <Box flex={1} minWidth={0}>
            <Typography
              variant="h5"
              fontWeight={700}
              color="text.primary"
              lineHeight={1.25}
              sx={{ letterSpacing: '-0.01em' }}
            >
              {title}
            </Typography>

            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, lineHeight: 1.5 }}
              >
                {subtitle}
              </Typography>
            )}

            {stats && stats.length > 0 && (
              <Box display="flex" flexWrap="wrap" gap={0.75} mt={0.875}>
                {stats.map((s, i) => (
                  <Chip
                    key={i}
                    label={`${s.value} ${s.label}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: 'none',
                      bgcolor: s.color ? alpha(s.color, 0.1) : 'grey.100',
                      color: s.color ?? 'text.secondary',
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Zone droite : extra + action */}
        <Box display="flex" alignItems="center" gap={1} flexShrink={0}>
          {extra}
          {actionButton ?? (action && (
            <Button
              variant="contained"
              onClick={action.onClick}
              startIcon={action.icon}
              sx={{
                bgcolor: action.color ?? 'primary.main',
                boxShadow: `0 2px 8px ${alpha(action.color ?? '#1F497D', 0.35)}`,
                '&:hover': {
                  bgcolor: action.color ? alpha(action.color, 0.85) : 'primary.dark',
                  boxShadow: `0 4px 16px ${alpha(action.color ?? '#1F497D', 0.45)}`,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default PageHeader;
