import { useCallback, useEffect, useRef, useState } from 'react';

const VALIDATE_URL = 'https://asia-northeast1-mensetsuai-462715.cloudfunctions.net/validateToken';

const RETRY_INTERVAL_MS = 2000;
const MAX_RETRIES = 5;

export interface TokenValidationData {
  valid: boolean;
  reason?: string;
  company_id?: string;
  company_name?: string;
  expiry_date?: string | null;
  first_name?: string;
  last_name?: string;
  first_name_kana?: string;
  last_name_kana?: string;
}

export type TokenValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: TokenValidationData };

export function useTokenValidation(token: string | null): {
  state: TokenValidationState;
  refresh: () => void;
  retryUntilInvalid: () => void;
} {
  const [state, setState] = useState<TokenValidationState>(
    token ? { status: 'loading' } : { status: 'idle' }
  );
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  // リトライ中かどうか（trueならloading表示しない）
  const isRetryingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const doFetch = useCallback((token: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isRetryingRef.current) {
      setState({ status: 'loading' });
    }

    fetch(`${VALIDATE_URL}?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body: { error?: string }) => {
            throw new Error(body.error ?? `HTTP ${res.status}`);
          });
        }
        return res.json() as Promise<TokenValidationData>;
      })
      .then((data) => {
        setState({ status: 'success', data });
        if (data.valid && retryCountRef.current > 0) {
          retryCountRef.current -= 1;
          retryTimerRef.current = setTimeout(() => doFetch(token), RETRY_INTERVAL_MS);
        } else {
          retryCountRef.current = 0;
          isRetryingRef.current = false;
        }
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setState({ status: 'error', message: err.message });
        retryCountRef.current = 0;
        isRetryingRef.current = false;
      });
  }, []);

  useEffect(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    retryCountRef.current = 0;
    isRetryingRef.current = false;

    if (!token) {
      setState({ status: 'idle' });
      return;
    }
    doFetch(token);
  }, [token, doFetch]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const refresh = useCallback(() => {
    if (!token) return;
    retryCountRef.current = 0;
    isRetryingRef.current = false;
    doFetch(token);
  }, [token, doFetch]);

  const retryUntilInvalid = useCallback(() => {
    if (!token) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryCountRef.current = MAX_RETRIES;
    isRetryingRef.current = true;
    doFetch(token);
  }, [token, doFetch]);

  return { state, refresh, retryUntilInvalid };
}
