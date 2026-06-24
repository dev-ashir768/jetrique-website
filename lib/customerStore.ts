"use client";

import { useState, useEffect, useCallback } from 'react';

interface CustomerState {
  token:    string | null;
  customer: { id: string; email: string; name: string; phone: string | null } | null;
  hydrated: boolean;
}

const KEY = 'jq_customer';

function load(): Omit<CustomerState, 'hydrated'> {
  if (typeof window === 'undefined') return { token: null, customer: null };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { token: null, customer: null };
  } catch { return { token: null, customer: null }; }
}

function save(state: Omit<CustomerState, 'hydrated'>) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function clear() {
  localStorage.removeItem(KEY);
}

// ── Module-level singleton — all hook instances share one state ───────────────

type Listener = (state: CustomerState) => void;
const listeners = new Set<Listener>();
let globalState: CustomerState = { token: null, customer: null, hydrated: false };

function notify(next: CustomerState) {
  globalState = next;
  listeners.forEach((fn) => fn(next));
}

// Hydrate immediately on first client import
if (typeof window !== 'undefined') {
  globalState = { ...load(), hydrated: true };
}

export function useCustomerAuth() {
  const [state, setState] = useState<CustomerState>(globalState);

  useEffect(() => {
    // Re-sync in case module was evaluated server-side
    if (!globalState.hydrated) {
      notify({ ...load(), hydrated: true });
    }
    // Register listener first, then sync asynchronously to avoid
    // calling setState synchronously inside an effect body
    listeners.add(setState);
    const raf = requestAnimationFrame(() => setState(globalState));
    return () => {
      listeners.delete(setState);
      cancelAnimationFrame(raf);
    };
  }, []);

  const login = useCallback((token: string, customer: CustomerState['customer']) => {
    const next: CustomerState = { token, customer, hydrated: true };
    save({ token, customer });
    notify(next);
  }, []);

  const logout = useCallback(() => {
    clear();
    notify({ token: null, customer: null, hydrated: true });
  }, []);

  return {
    token:      state.token,
    customer:   state.customer,
    isLoggedIn: !!state.token,
    hydrated:   state.hydrated,
    login,
    logout,
  };
}

export function getCustomerToken(): string | null {
  return load().token;
}
