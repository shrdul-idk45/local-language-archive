// src/api.js - axios wrapper that sends JWT automatically
import axios from 'axios';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const api = axios.create({ baseURL: API_BASE, headers: { Accept: 'application/json' } });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

export default api;
