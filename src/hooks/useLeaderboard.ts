import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { levelFromXp } from "../quiz/gamification";

export type LeaderboardEntry = {
  id: string;
  username: string;
  xp: number;
  level: number;
  rank: number;
  isMe: boolean;
};

export type UseLeaderboardResult = {
  entries: LeaderboardEntry[];
  myRank: number | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useLeaderboard(user: User | null, topN = 10): UseLeaderboardResult {
  const userId = user?.id ?? null;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  const refresh = useCallback(() => setToken((current) => current + 1), []);

  useEffect(() => {
    if (!userId || !supabase) {
      setEntries([]);
      setMyRank(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const client = supabase;
    let ignore = false;
    setIsLoading(true);

    void (async () => {
      const listResult = await client
        .from("profiles")
        .select("id, username, xp")
        .order("xp", { ascending: false })
        .limit(topN);
      if (ignore) {
        return;
      }
      if (listResult.error) {
        setError("Liderlik tablosu yüklenemedi.");
        setEntries([]);
        setMyRank(null);
        setIsLoading(false);
        return;
      }

      const rows = (listResult.data ?? []) as Array<{ id: string; username: string; xp: number }>;
      const list: LeaderboardEntry[] = rows.map((row, index) => ({
        id: row.id,
        username: row.username,
        xp: row.xp,
        level: levelFromXp(row.xp).level,
        rank: index + 1,
        isMe: row.id === userId,
      }));
      setEntries(list);
      setError(null);

      const mine = list.find((entry) => entry.isMe);
      if (mine) {
        setMyRank(mine.rank);
        setIsLoading(false);
        return;
      }

      // Listede yoksam kendi sıramı hesapla.
      const myProfile = await client.from("profiles").select("xp").eq("id", userId).maybeSingle();
      if (ignore) {
        return;
      }
      const myXpData = myProfile.data as { xp?: number | null } | null;
      const myXp = typeof myXpData?.xp === "number" ? myXpData.xp : 0;

      const aheadResult = await client
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gt("xp", myXp);
      if (ignore) {
        return;
      }
      setMyRank((aheadResult.count ?? 0) + 1);
      setIsLoading(false);
    })();

    return () => {
      ignore = true;
    };
  }, [userId, token, topN]);

  return { entries, myRank, isLoading, error, refresh };
}
