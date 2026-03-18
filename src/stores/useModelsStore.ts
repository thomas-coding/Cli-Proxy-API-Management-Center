/**
 * 模型列表状态管理（带缓存）
 */

import { create } from 'zustand';
import { modelsApi } from '@/services/api/models';
import { CACHE_EXPIRY_MS } from '@/utils/constants';
import type { ModelInfo } from '@/utils/models';

interface ModelsCache {
  data: ModelInfo[];
  timestamp: number;
  apiBase: string;
  requestBase: string;
}

interface ModelsState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  cache: ModelsCache | null;

  fetchModels: (
    apiBase: string,
    apiKey?: string,
    forceRefresh?: boolean,
    runtimeConfig?: unknown
  ) => Promise<ModelInfo[]>;
  clearCache: () => void;
  isCacheValid: (apiBase: string, requestBase?: string) => boolean;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  loading: false,
  error: null,
  cache: null,

  fetchModels: async (apiBase, apiKey, forceRefresh = false, runtimeConfig) => {
    const { cache, isCacheValid } = get();
    const requestBase = modelsApi.resolveManagedModelsRequestBase(apiBase, runtimeConfig);

    // 检查缓存
    if (!forceRefresh && isCacheValid(apiBase, requestBase) && cache) {
      set({ models: cache.data, error: null });
      return cache.data;
    }

    set({ loading: true, error: null });

    try {
      const list = await modelsApi.fetchManagedModels(apiBase, apiKey, runtimeConfig);
      const now = Date.now();

      set({
        models: list,
        loading: false,
        cache: { data: list, timestamp: now, apiBase, requestBase }
      });

      return list;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to fetch models';
      set({
        error: message,
        loading: false,
        models: []
      });
      throw error;
    }
  },

  clearCache: () => {
    set({ cache: null, models: [] });
  },

  isCacheValid: (apiBase, requestBase = apiBase) => {
    const { cache } = get();
    if (!cache) return false;
    if (cache.apiBase !== apiBase) return false;
    if (cache.requestBase !== requestBase) return false;
    return Date.now() - cache.timestamp < CACHE_EXPIRY_MS;
  }
}));
