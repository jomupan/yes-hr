/* Replacement leave (admin side): list, add, edit and delete entries such as
 * "Replacement Leave SUKMA – 1 day", and choose which staff get them. */

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface AdminReplacementLeave {
  id: string;
  name: string;
  days: number;
  /** Last day it can be used (YYYY-MM-DD), or null for no expiry. */
  expiresOn: string | null;
  createdAt: string;
  /** Staff who have it, with the days they have left. */
  staff: { username: string; fullName: string; balance: number }[];
}

export interface ReplacementInput {
  name: string;
  days: number;
  expiresOn: string;
  /** Who gets it. */
  usernames: string[];
}

type ListResponse = { replacementLeaves: AdminReplacementLeave[] };

/** The list for the Settings page, with a reload function. */
export function useReplacementLeaves() {
  const [items, setItems] = useState<AdminReplacementLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await api<ListResponse>("/admin/replacement-leaves");
      setItems(res.replacementLeaves);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load replacement leave.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, setItems, loading, error, reload };
}

export async function createReplacementLeave(input: ReplacementInput): Promise<AdminReplacementLeave[]> {
  const res = await api<ListResponse>("/admin/replacement-leaves", { body: input });
  return res.replacementLeaves;
}

export async function updateReplacementLeave(id: string, input: ReplacementInput): Promise<AdminReplacementLeave[]> {
  const res = await api<ListResponse>(`/admin/replacement-leaves/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: input,
  });
  return res.replacementLeaves;
}

export async function deleteReplacementLeave(id: string): Promise<AdminReplacementLeave[]> {
  const res = await api<ListResponse>(`/admin/replacement-leaves/${encodeURIComponent(id)}`, { method: "DELETE" });
  return res.replacementLeaves;
}
