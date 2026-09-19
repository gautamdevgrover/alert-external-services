import axios from 'axios';
import {
  ServiceListItem,
  DashboardMetrics,
  AlertsResponse,
  ThresholdItem,
  ServiceDetailResponse,
  ServiceHistoryResponse,
} from '../types';

const API_BASE = '/api';

export const api = {
  getHealth: async () => {
    const res = await axios.get('/health');
    return res.data;
  },

  getMetrics: async (): Promise<DashboardMetrics> => {
    const res = await axios.get(`${API_BASE}/metrics`);
    return res.data;
  },

  getServices: async (): Promise<ServiceListItem[]> => {
    const res = await axios.get(`${API_BASE}/services`);
    return res.data;
  },

  getServiceDetail: async (serviceKey: string): Promise<ServiceDetailResponse> => {
    const res = await axios.get(`${API_BASE}/services/${serviceKey}`);
    return res.data;
  },

  getServiceHistory: async (serviceKey: string, days = 30): Promise<ServiceHistoryResponse> => {
    const res = await axios.get(`${API_BASE}/history/${serviceKey}?days=${days}`);
    return res.data;
  },

  getAlerts: async (status?: string, service?: string): Promise<AlertsResponse> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (service) params.append('service', service);
    const res = await axios.get(`${API_BASE}/alerts?${params.toString()}`);
    return res.data;
  },

  resolveAlert: async (id: number) => {
    const res = await axios.post(`${API_BASE}/alerts/${id}/resolve`);
    return res.data;
  },

  getThresholds: async (): Promise<ThresholdItem[]> => {
    const res = await axios.get(`${API_BASE}/thresholds`);
    return res.data;
  },

  updateThreshold: async (serviceKey: string, updates: Partial<ThresholdItem>) => {
    const res = await axios.put(`${API_BASE}/thresholds/${serviceKey}`, updates);
    return res.data;
  },

  runMonitoringCycle: async (serviceKey?: string) => {
    const res = await axios.post(`${API_BASE}/monitoring/run`, { service: serviceKey });
    return res.data;
  },
};
