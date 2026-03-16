import client from './client';
import { AuditLog, PaginatedResponse } from '../types';

export const auditTrailApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<AuditLog>>('/audit-trail', { params }),
  exportCSV: (params?: Record<string, unknown>) =>
    client.get('/audit-trail/export/csv', { params, responseType: 'blob' }),
  exportJSON: (params?: Record<string, unknown>) =>
    client.get('/audit-trail/export/json', { params, responseType: 'blob' }),
};
