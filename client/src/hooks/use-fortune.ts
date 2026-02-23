import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertUser } from "@shared/schema";

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
        if (res.status === 409) {
          const body = await res.json();
          const err = new Error("이미 등록된 계정입니다.") as Error & { telegramId?: string; linkToken?: string };
          err.telegramId = body.telegramId;
          err.linkToken = body.linkToken;
          throw err;
        }
        if (res.status === 400) {
           const error = api.users.create.responses[400].parse(await res.json());
           throw new Error(error.message);
        }
        throw new Error("회원가입에 실패했습니다.");
      }
      return api.users.create.responses[201].parse(await res.json());
    },
  });
}

export function useUser(telegramId: string | null) {
  return useQuery({
    queryKey: ['/api/users', telegramId],
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

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ telegramId, data }: { telegramId: string; data: Record<string, unknown> }) => {
      const url = buildUrl(api.users.update.path, { telegramId });
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("정보 수정에 실패했습니다.");
      return res.json();
    },
    onSuccess: (_, { telegramId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', telegramId] });
    },
  });
}

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

      if (res.status === 429) {
        const data = await res.json();
        throw new Error(data.message || "오늘의 운세는 이미 확인하셨습니다.");
      }
      if (!res.ok) {
        if (res.status === 404) throw new Error("사용자를 찾을 수 없습니다.");
        throw new Error("운세 생성에 실패했습니다.");
      }
      
      return api.fortunes.generate.responses[201].parse(await res.json());
    },
    onSuccess: (_, telegramId) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/fortunes', telegramId] 
      });
    },
  });
}

export function useSajuAnalysis(telegramId: string) {
  return useQuery({
    queryKey: ['/api/saju', telegramId],
    queryFn: async () => {
      const res = await fetch(`/api/saju/${telegramId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch saju analysis");
      return res.json();
    },
    enabled: !!telegramId,
  });
}

export function useFortunes(telegramId: string) {
  return useQuery({
    queryKey: ['/api/fortunes', telegramId],
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
