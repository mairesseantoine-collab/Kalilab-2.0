import client from './client';
import { Message } from '../types';

interface MessagesListResponse {
  items: Message[];
  total: number;
  skip: number;
  limit: number;
}

export const messagerieApi = {
  /** Boîte de réception */
  inbox: (params?: { skip?: number; limit?: number; non_lus_seulement?: boolean }) =>
    client.get<MessagesListResponse>('/messagerie/inbox', { params }),

  /** Messages envoyés */
  sent: (params?: { skip?: number; limit?: number }) =>
    client.get<MessagesListResponse>('/messagerie/sent', { params }),

  /** Détail d'un message (marque lu automatiquement) */
  get: (id: number) =>
    client.get<Message>(`/messagerie/${id}`),

  /** Nombre de messages non lus (badge nav) */
  unreadCount: () =>
    client.get<{ unread_count: number }>('/messagerie/unread-count'),

  /** Envoyer un nouveau message */
  send: (data: { destinataire_id: number; sujet: string; corps: string; parent_id?: number }) =>
    client.post<Message>('/messagerie', data),

  /** Répondre à un message */
  reply: (id: number, data: { corps: string; destinataire_id?: number; sujet?: string }) =>
    client.post<Message>(`/messagerie/${id}/reply`, data),

  /** Marquer comme lu */
  markRead: (id: number) =>
    client.put(`/messagerie/${id}/read`),

  /** Supprimer (soft-delete côté utilisateur) */
  delete: (id: number) =>
    client.delete(`/messagerie/${id}`),
};
