"use client";

import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: () => usersApi.getProfile(),
    staleTime: 60_000,
  });
}
