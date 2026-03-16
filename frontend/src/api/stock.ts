import client from './client';
import { Lot, Article, PaginatedResponse } from '../types';

export const stockApi = {
  listLots: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Lot>>('/stock/lots', { params }),
  getLot: (id: number) => client.get<Lot>(`/stock/lots/${id}`),
  createLot: (data: Partial<Lot>) => client.post<Lot>('/stock/lots', data),
  acceptLot: (id: number) => client.post(`/stock/lots/${id}/accept`),
  rejectLot: (id: number, reason: string) =>
    client.post(`/stock/lots/${id}/reject`, { reason }),
  listArticles: () => client.get<Article[]>('/stock/articles'),
  getArticle: (id: number) => client.get<Article>(`/stock/articles/${id}`),
  createArticle: (data: Partial<Article>) => client.post<Article>('/stock/articles', data),
  updateArticle: (id: number, data: Partial<Article>) =>
    client.put<Article>(`/stock/articles/${id}`, data),
  scanGS1: (code: string) => client.get(`/stock/gs1/${code}`),
};
