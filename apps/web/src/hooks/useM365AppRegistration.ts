import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiFetch } from "../apiClient";

export type M365AppRegistration = {
  tenantId: string;
  clientId: string;
  configured: boolean;
  fromDatabase: boolean;
};

const queryKey = ["m365-app-registration"] as const;

export function useM365AppRegistration() {
  return useQuery({
    queryKey: queryKey,
    queryFn: async (): Promise<M365AppRegistration> => {
      const res = await apiFetch("/api/integrations/m365");
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "m365_config_failed");
      }
      return (await res.json()) as M365AppRegistration;
    },
  });
}

export function useInvalidateM365AppRegistration() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey });
  }, [qc]);
}
