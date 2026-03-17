/// <reference types="vite/client" />
import axios, { AxiosError } from 'axios';

// Support both VITE_API_URL and VITE_API_BASE_URL for rétrocompatibilité
const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('kalilab-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Éviter une boucle de redirection si on est déjà sur /login
      if (!window.location.pathname.startsWith('/login')) {
        localStorage.removeItem('kalilab-token');
        localStorage.removeItem('kalilab-user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
