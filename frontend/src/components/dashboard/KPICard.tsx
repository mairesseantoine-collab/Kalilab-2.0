import React from 'react';
import { Card, CardContent, Box, Typography, Chip } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface Props {
  title: string;
  value: number | string;
  unit?: string;
  target?: number;
  trend?: 'up' | 'down' | 'flat';
  sparkData?: { value: number }[];
  icon?: React.ReactNode;
  color?: string;
}

const KPICard: React.FC<Props> = ({ title, value, unit, target, trend, sparkData, icon, color = '#1565C0' }) => {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  const isConformant = target !== undefined ? numValue >= target : undefined;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : TrendingFlat;
  const trendColor = trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary';

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
            <Box display="flex" alignItems="baseline" gap={0.5}>
              <Typography variant="h4" fontWeight={700} color={color}>
                {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
              </Typography>
              {unit && <Typography variant="body2" color="text.secondary">{unit}</Typography>}
            </Box>
          </Box>
          {icon && (
            <Box sx={{ color, opacity: 0.7, fontSize: 32 }}>{icon}</Box>
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {trend && <TrendIcon sx={{ color: trendColor, fontSize: 18 }} />}
          {target !== undefined && (
            <Chip
              label={`Cible: ${target}${unit || ''}`}
              size="small"
              color={isConformant ? 'success' : 'error'}
              variant="outlined"
            />
          )}
        </Box>
        {sparkData && sparkData.length > 0 && (
          <Box height={40}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default KPICard;
