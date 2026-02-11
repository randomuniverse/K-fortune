import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertUser } from "@shared/routes";

// ============================================
// USERS
// ============================================

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await fetch(api.users.create.path, {
        method: api.users.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 409) throw new Error("This Telegram ID is already registered.");
        if (res.status === 400) {
           const error = api.users.create.responses[400].parse(await res.json());
           throw new Error(error.message);
        }
        throw new Error("Failed to register user");
      }
      return api.users.create.responses[201].parse(await res.json());
    },
    // We don't invalidate lists here as this is a new user setup
  });
}

export function useUser(telegramId: string | null) {
  return useQuery({
    queryKey: [api.users.get.path, telegramId],
    queryFn: async () => {
      if (!telegramId) return null;
      const url = buildUrl(api.users.get.path, { telegramId });
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      
      return api.users.get.responses[200].parse(await res.json());
    },
    enabled: !!telegramId,
    retry: false,
  });
}

// ============================================
// FORTUNES
// ============================================

export function useGenerateFortune() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (telegramId: string) => {
      const res = await fetch(api.fortunes.generate.path, {
        method: api.fortunes.generate.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId }),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("User not found");
        throw new Error("Failed to generate fortune");
      }
      
      return api.fortunes.generate.responses[201].parse(await res.json());
    },
    onSuccess: (_, telegramId) => {
      queryClient.invalidateQueries({ 
        queryKey: [api.fortunes.list.path, telegramId] 
      });
    },
  });
}

export function useFortunes(telegramId: string) {
  return useQuery({
    queryKey: [api.fortunes.list.path, telegramId],
    queryFn: async () => {
      const url = buildUrl(api.fortunes.list.path, { telegramId });
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return [];
      if (!res.ok) throw new Error("Failed to fetch fortunes");
      
      return api.fortunes.list.responses[200].parse(await res.json());
    },
    enabled: !!telegramId,
  });
}
