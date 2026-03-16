import client from './client';
import { LoginResponse, User } from '../types';

export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return client.post<LoginResponse>('/auth/login', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },
  me: () => client.get<User>('/auth/me'),
  logout: () => client.post('/auth/logout'),
};
