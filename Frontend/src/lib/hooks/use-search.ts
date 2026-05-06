"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/lib/api/search";

const DEBOUNCE_MS = 250;

export function useDebouncedValue<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSearch(q: string) {
  const debounced = useDebouncedValue(q.trim(), DEBOUNCE_MS);
  return useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchApi.search({ q: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
}
