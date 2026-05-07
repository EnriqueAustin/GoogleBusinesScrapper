"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { apiGet, apiPost, apiPatch, apiDelete, api } from "./api";

export interface Dataset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { leads: number; jobs: number };
}

interface DatasetContextValue {
  datasets: Dataset[];
  activeDatasetId: string | null;
  activeDataset: Dataset | null;
  setActiveDatasetId: (id: string) => void;
  refreshDatasets: () => Promise<Dataset[]>;
  createDataset: (name: string) => Promise<Dataset>;
  renameDataset: (id: string, name: string) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
  loading: boolean;
  buildHref: (path: string) => string;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset must be used within DatasetProvider");
  return ctx;
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const updateUrl = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ds", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const setActiveDatasetId = useCallback((id: string) => {
    setActiveDatasetIdState(id);
    localStorage.setItem("activeDatasetId", id);
    updateUrl(id);
  }, [updateUrl]);

  const buildHref = useCallback((path: string) => {
    if (!activeDatasetId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}ds=${activeDatasetId}`;
  }, [activeDatasetId]);

  const refreshDatasets = useCallback(async () => {
    try {
      const data = await apiGet<Dataset[]>("/api/datasets");
      setDatasets(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    (async () => {
      const data = await refreshDatasets();
      const urlDs = searchParams.get("ds");
      const stored = localStorage.getItem("activeDatasetId");
      const preferred = urlDs || stored;
      const arr = data as Dataset[];
      if (arr.length > 0) {
        const match = preferred && arr.find((d) => d.id === preferred);
        const chosen = match ? preferred! : arr[0].id;
        setActiveDatasetIdState(chosen);
        localStorage.setItem("activeDatasetId", chosen);
        const params = new URLSearchParams(searchParams.toString());
        params.set("ds", chosen);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
      setLoading(false);
    })();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interceptorId = api.interceptors.request.use((config) => {
      if (activeDatasetId) {
        config.headers["x-dataset-id"] = activeDatasetId;
      }
      return config;
    });
    return () => {
      api.interceptors.request.eject(interceptorId);
    };
  }, [activeDatasetId]);

  const createDataset = useCallback(async (name: string) => {
    const ds = await apiPost<Dataset>("/api/datasets", { name });
    await refreshDatasets();
    return ds;
  }, [refreshDatasets]);

  const renameDataset = useCallback(async (id: string, name: string) => {
    await apiPatch(`/api/datasets/${id}`, { name });
    await refreshDatasets();
  }, [refreshDatasets]);

  const deleteDataset = useCallback(async (id: string) => {
    await apiDelete(`/api/datasets/${id}`);
    const remaining = await refreshDatasets();
    const arr = remaining as Dataset[];
    if (id === activeDatasetId && arr.length > 0) {
      setActiveDatasetId(arr[0].id);
    }
  }, [activeDatasetId, refreshDatasets, setActiveDatasetId]);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) || null;

  return (
    <DatasetContext.Provider
      value={{
        datasets,
        activeDatasetId,
        activeDataset,
        setActiveDatasetId,
        refreshDatasets,
        createDataset,
        renameDataset,
        deleteDataset,
        loading,
        buildHref,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}
