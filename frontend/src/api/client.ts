/// <reference types="vite/client" />
import axios, { AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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
      localStorage.removeItem('kalilab-token');
      localStorage.removeItem('kalilab-user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
