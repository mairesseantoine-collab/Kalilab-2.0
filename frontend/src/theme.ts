import { createTheme, alpha } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: {
      main: '#0779BF',      // Cliniques de l'Europe
      light: '#3A9CD1',
      dark: '#0557A3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00897B',
      light: '#4EBAAA',
      dark: '#005B4F',
      contrastText: '#FFFFFF',
    },
    error:   { main: '#EF4444', light: '#FCA5A5', dark: '#B91C1C' },
    warning: { main: '#F59E0B', light: '#FDE68A', dark: '#D97706' },
    success: { main: '#10B981', light: '#6EE7B7', dark: '#059669' },
    info:    { main: '#3B82F6', light: '#93C5FD', dark: '#1D4ED8' },
    background: {
      default: '#F5F6FA',
      paper: '#FFFFFF',
    },
    divider: '#E5E7EB',
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      disabled: '#9CA3AF',
    },
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem' },
    overline: { fontWeight: 700, letterSpacing: '0.08em' },
  },

  shape: { borderRadius: 10 },

  components: {
    // ── Button ─────────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.875rem',
          transition: 'all 0.15s ease',
        },
        contained: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': { borderWidth: '1.5px' },
        },
        sizeSmall: { borderRadius: 6, fontSize: '0.8125rem' },
      },
    },

    // ── Card ──────────────────────────────────────────────────────────────────
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          backgroundImage: 'none',
        },
      },
    },

    // ── Paper ─────────────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: 12, backgroundImage: 'none' },
        outlined: { border: '1px solid #E5E7EB' },
        elevation1: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
        elevation2: { boxShadow: '0 4px 8px rgba(0,0,0,0.07)' },
        elevation3: { boxShadow: '0 8px 16px rgba(0,0,0,0.08)' },
        elevation8: { boxShadow: '0 16px 32px rgba(0,0,0,0.1)' },
        elevation24: { boxShadow: '0 24px 48px rgba(0,0,0,0.12)' },
      },
    },

    // ── Drawer ────────────────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: 'none',
          boxShadow: '1px 0 0 0 #E5E7EB',
        },
      },
    },

    // ── Chip ──────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500, fontSize: '0.75rem' },
        colorError: {
          backgroundColor: '#FEF2F2',
          color: '#DC2626',
          '& .MuiChip-icon': { color: '#DC2626' },
        },
        colorWarning: {
          backgroundColor: '#FFFBEB',
          color: '#D97706',
          '& .MuiChip-icon': { color: '#D97706' },
        },
        colorSuccess: {
          backgroundColor: '#ECFDF5',
          color: '#059669',
          '& .MuiChip-icon': { color: '#059669' },
        },
        colorPrimary: {
          backgroundColor: '#EFF6FF',
          color: '#1D4ED8',
          '& .MuiChip-icon': { color: '#1D4ED8' },
        },
        colorInfo: {
          backgroundColor: '#EFF6FF',
          color: '#1D4ED8',
        },
        sizeSmall: { height: 22, fontSize: '0.7rem' },
      },
    },

    // ── Alert ─────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: '1px solid transparent',
          fontSize: '0.875rem',
        },
        standardError:   { backgroundColor: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' },
        standardWarning: { backgroundColor: '#FFFBEB', color: '#92400E', borderColor: '#FDE68A' },
        standardSuccess: { backgroundColor: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' },
        standardInfo:    { backgroundColor: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE' },
        filledError:   { backgroundColor: '#EF4444' },
        filledWarning: { backgroundColor: '#F59E0B' },
        filledSuccess: { backgroundColor: '#10B981' },
        filledInfo:    { backgroundColor: '#3B82F6' },
      },
    },

    // ── Table ─────────────────────────────────────────────────────────────────
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#F9FAFB',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#6B7280',
          borderBottom: '1px solid #E5E7EB',
          padding: '10px 16px',
        },
        body: {
          borderBottom: '1px solid #F3F4F6',
          fontSize: '0.875rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 0 },
          '&.MuiTableRow-hover:hover': { backgroundColor: '#F9FAFB !important' },
        },
      },
    },

    // ── Input & TextField ─────────────────────────────────────────────────────
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& fieldset': { borderColor: '#D1D5DB' },
          '&:hover fieldset': { borderColor: '#9CA3AF !important' },
          '&.Mui-focused fieldset': { borderColor: '#1F497D !important', borderWidth: '1.5px' },
        },
        inputSizeSmall: { padding: '7px 12px' },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.875rem' },
        sizeSmall: { fontSize: '0.875rem' },
      },
    },

    // ── Select ────────────────────────────────────────────────────────────────
    MuiSelect: {
      styleOverrides: {
        outlined: { borderRadius: 8 },
      },
    },

    // ── Dialog ────────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: '1.1rem' },
      },
    },

    // ── Tooltip ───────────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1F2937',
          fontSize: '0.75rem',
          borderRadius: 6,
          fontWeight: 400,
          padding: '6px 10px',
        },
        arrow: { color: '#1F2937' },
      },
    },

    // ── Tabs ──────────────────────────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
          minHeight: 44,
          '&.Mui-selected': { fontWeight: 700 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2.5, borderRadius: 2 },
      },
    },

    // ── Misc ──────────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: { root: { borderColor: '#E5E7EB' } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 6, height: 6, backgroundColor: '#E5E7EB' },
        bar: { borderRadius: 6 },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: { fontWeight: 700, fontSize: '0.65rem', minWidth: 18, height: 18 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 8, transition: 'all 0.12s ease' },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { fontWeight: 700 },
      },
    },
    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #E5E7EB' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: '0.875rem',
          margin: '1px 4px',
          padding: '7px 10px',
        },
      },
    },
  },
})

export default theme
