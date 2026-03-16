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

export const dashboardApi = {
  getStats: (params?: Record<string, unknown>) =>
    client.get<DashboardData>('/dashboard/stats', { params }),
  getAlerts: () =>
    client.get<AlertsResponse>('/dashboard/alerts'),
  getMyTasks: () =>
    client.get<any>('/dashboard/my-tasks'),
};
