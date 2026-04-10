import axios, { AxiosError } from "axios";

/**
 * Centralized API client with retry logic.
 * 
 * On startup, the backend (port 3001) may not be ready yet.  Instead of
 * spamming console errors the client silently retries with exponential
 * backoff for transient network failures (connection refused / reset).
 */

const API_BASE = "http://localhost:3001";

const api = axios.create({
    baseURL: API_BASE,
    timeout: 15_000,
});

// ── Retry helper ────────────────────────────────────────────────────────

interface RetryConfig {
    /** Max number of retry attempts (default 3) */
    retries?: number;
    /** Initial delay in ms before first retry (doubles each attempt) */
    initialDelay?: number;
    /** Only retry on these status codes (empty = retry all 5xx + network errors) */
    retryStatusCodes?: number[];
}

const DEFAULT_RETRY: Required<RetryConfig> = {
    retries: 3,
    initialDelay: 1_000,
    retryStatusCodes: [],
};

function isRetryable(error: AxiosError, retryStatusCodes: number[]): boolean {
    // Network-level failures (connection refused, reset, timeout)
    if (!error.response) return true;

    const status = error.response.status;

    // Specific status codes the caller wants to retry
    if (retryStatusCodes.length > 0) return retryStatusCodes.includes(status);

    // Default: retry all 5xx server errors
    return status >= 500;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrapper around the axios instance that adds automatic retry with
 * exponential backoff for transient errors (network failures, 5xx).
 *
 * Usage:
 *   const data = await apiGet("/api/jobs");
 *   const data = await apiPost("/api/jobs/batch", { queries });
 */

export async function apiGet<T = any>(
    url: string,
    config?: RetryConfig & { params?: Record<string, any> }
): Promise<T> {
    const { retries, initialDelay, retryStatusCodes } = {
        ...DEFAULT_RETRY,
        ...config,
    };

    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await api.get<T>(url, { params: config?.params });
            return res.data;
        } catch (err) {
            lastError = err as AxiosError;
            if (attempt < retries && isRetryable(lastError, retryStatusCodes)) {
                const delay = initialDelay * Math.pow(2, attempt);
                // Silent retry — no console.error spam on startup
                console.debug(
                    `[API] GET ${url} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`
                );
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

export async function apiPost<T = any>(
    url: string,
    data?: any,
    config?: RetryConfig
): Promise<T> {
    const { retries, initialDelay, retryStatusCodes } = {
        ...DEFAULT_RETRY,
        ...config,
    };

    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await api.post<T>(url, data);
            return res.data;
        } catch (err) {
            lastError = err as AxiosError;
            if (attempt < retries && isRetryable(lastError, retryStatusCodes)) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.debug(
                    `[API] POST ${url} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`
                );
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

export async function apiDelete<T = any>(
    url: string,
    data?: any,
    config?: RetryConfig
): Promise<T> {
    const { retries, initialDelay, retryStatusCodes } = {
        ...DEFAULT_RETRY,
        ...config,
    };

    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await api.delete<T>(url, { data });
            return res.data;
        } catch (err) {
            lastError = err as AxiosError;
            if (attempt < retries && isRetryable(lastError, retryStatusCodes)) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.debug(
                    `[API] DELETE ${url} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`
                );
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

export async function apiPatch<T = any>(
    url: string,
    data?: any,
    config?: RetryConfig
): Promise<T> {
    const { retries, initialDelay, retryStatusCodes } = {
        ...DEFAULT_RETRY,
        ...config,
    };

    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await api.patch<T>(url, data);
            return res.data;
        } catch (err) {
            lastError = err as AxiosError;
            if (attempt < retries && isRetryable(lastError, retryStatusCodes)) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.debug(
                    `[API] PATCH ${url} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`
                );
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/** Raw axios instance for special cases (file uploads, etc.) */
export { api, API_BASE };
export default api;
