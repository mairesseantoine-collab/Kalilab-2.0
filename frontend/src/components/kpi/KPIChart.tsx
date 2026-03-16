import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Box, Typography } from '@mui/material';
import { MesureKPI } from '../../types';
import dayjs from 'dayjs';

interface Props {
  mesures: MesureKPI[];
  target?: number;
  unit?: string;
  color?: string;
}

const KPIChart: React.FC<Props> = ({ mesures, target, unit, color = '#1565C0' }) => {
  if (!mesures || mesures.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="text.secondary">Aucune mesure disponible</Typography>
      </Box>
    );
  }

  const data = mesures
    .slice()
    .sort((a, b) => new Date(a.date_mesure).getTime() - new Date(b.date_mesure).getTime())
    .map((m) => ({
      date: dayjs(m.date_mesure).format('DD/MM'),
      valeur: m.valeur,
    }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis unit={unit} />
        <Tooltip formatter={(v) => [`${v}${unit || ''}`, 'Valeur']} />
        <Legend />
        {target !== undefined && (
          <ReferenceLine y={target} stroke="#2E7D32" strokeDasharray="4 4" label={{ value: `Cible: ${target}${unit || ''}`, fill: '#2E7D32' }} />
        )}
        <Line type="monotone" dataKey="valeur" stroke={color} strokeWidth={2} dot={{ r: 4 }} name="Valeur" />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default KPIChart;
