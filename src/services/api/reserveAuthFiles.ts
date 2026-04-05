import { apiClient } from './client';
import type { AuthFilesResponse } from '@/types/authFile';

export type ReserveUsageRefreshResult = {
  name: string;
  status_code?: number;
  body?: string;
  removed?: boolean;
  error?: string;
};

export const reserveAuthFilesApi = {
  list: () => apiClient.get<AuthFilesResponse>('/reserve-auth-files'),

  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return apiClient.postForm('/reserve-auth-files', formData);
  },

  downloadText: async (name: string): Promise<string> => {
    const response = await apiClient.getRaw(`/reserve-auth-files/download?name=${encodeURIComponent(name)}`, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    return blob.text();
  },

  refresh: async (names: string[]): Promise<ReserveUsageRefreshResult[]> => {
    const data = await apiClient.post<{ results?: ReserveUsageRefreshResult[] }>('/reserve-auth-files/refresh', {
      names,
    });
    return Array.isArray(data?.results) ? data.results : [];
  },
};
