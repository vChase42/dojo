export type Me = {
  username: string;
  actorId: string;
}
import { useQuery } from "@tanstack/react-query";

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!res.ok) return null;

      return res.json();
    },
    staleTime: 1000 * 60,
  });
}