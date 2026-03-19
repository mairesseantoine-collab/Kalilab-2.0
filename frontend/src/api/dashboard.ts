import client from './client';
import { DashboardData } from '../types';

export interface AlertItem {
  type: string;
  message: string;
  count: number;
  severity: 'error' | 'warning' | 'info';
  link: string;
}

export interface AlertsResponse {
  total: number;
  alerts: AlertItem[];
}

export interface N1Stats {
  open_nc: number;
  overdue_calibrations: number;
  pending_docs: number;
  open_complaints: number;
}

export const dashboardApi = {
  getStats: (params?: Record<string, unknown>) =>
    client.get<DashboardData>('/dashboard/stats', { params }),
  getStatsN1: () =>
    client.get<N1Stats>('/dashboard/stats/n1'),
  getAlerts: () =>
    client.get<AlertsResponse>('/dashboard/alerts'),
  getMyTasks: () =>
    client.get<any>('/dashboard/my-tasks'),
};
