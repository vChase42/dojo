import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const qc = useQueryClient();

  const login = useMutation({
    mutationFn: async (body: { username: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Login failed");
      return res.json();
    },
    onSuccess: () => {
      // Re-fetch /api/auth/me
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return { login, logout };
}
