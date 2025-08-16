import axios from 'axios';

const api = axios.create({ baseURL: '/' });

api.interceptors.response.use(r => r, err => {
  console.error('API error', err?.response?.data || err.message);
  return Promise.reject(err);
});

export default api;
