import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { Refresh, BugReport } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Erreur capturée:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="60vh"
          gap={3}
          p={4}
        >
          <BugReport sx={{ fontSize: 64, color: 'error.main', opacity: 0.7 }} />
          <Typography variant="h5" fontWeight={600} color="error">
            Une erreur inattendue s'est produite
          </Typography>
          {this.state.error && (
            <Alert severity="error" sx={{ maxWidth: 600, width: '100%' }}>
              <Typography variant="body2" fontFamily="monospace">
                {this.state.error.message}
              </Typography>
            </Alert>
          )}
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={this.handleReset}
            >
              Réessayer
            </Button>
            <Button
              variant="outlined"
              onClick={() => window.location.reload()}
            >
              Recharger la page
            </Button>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
