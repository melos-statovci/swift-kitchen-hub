import { useCallback, useEffect, useMemo, useState } from "react";
import type { StaffUser, UserRole } from "@/lib/types";
import { apiFetch, ApiError, NetworkError } from "@/lib/api";

export class DuplicateEmailError extends Error {
  constructor() {
    super("A user with this email already exists");
    this.name = "DuplicateEmailError";
  }
}

export class OnlyAdminError extends Error {
  constructor() {
    super("Cannot delete the only admin");
    this.name = "OnlyAdminError";
  }
}

export class CantDeleteSelfError extends Error {
  constructor() {
    super("You can't delete your own account while logged in");
    this.name = "CantDeleteSelfError";
  }
}

export type CreateUserInput = {
  email: string;
  name: string;
  role: UserRole;
  password: string;
};

export type UpdateUserPatch = {
  name?: string;
  email?: string;
  role?: UserRole;
};

type UsersListResponse = { users: StaffUser[] };
type UserResponse = { user: StaffUser };

/**
 * Translate the backend's error codes into the structured errors the rest of
 * the UI expects. Anything else gets surfaced as-is.
 */
function translateApiError(err: unknown): Error {
  if (err instanceof ApiError) {
    const body = err.body as { code?: string } | null;
    if (body?.code === "EMAIL_TAKEN") return new DuplicateEmailError();
    if (body?.code === "ONLY_ADMIN") return new OnlyAdminError();
    if (body?.code === "CANT_DELETE_SELF") return new CantDeleteSelfError();
    return err;
  }
  if (err instanceof Error) return err;
  return new Error("Unknown error");
}

export function useUsers() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    setLoading(true);
    setLoadError(null);

    apiFetch<UsersListResponse>("/api/users", { auth: true, signal: ac.signal })
      .then((data) => {
        if (cancelled) return;
        setUsers(data.users);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || ac.signal.aborted) return;
        if (err instanceof NetworkError) {
          setLoadError("Could not reach the server.");
        } else if (err instanceof ApiError) {
          setLoadError(err.message);
        } else {
          setLoadError("Failed to load users.");
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [users],
  );

  const createUser = useCallback(async (input: CreateUserInput): Promise<StaffUser> => {
    try {
      const data = await apiFetch<UserResponse>("/api/users", {
        method: "POST",
        auth: true,
        body: {
          email: input.email.toLowerCase().trim(),
          name: input.name.trim(),
          role: input.role,
          password: input.password,
        },
      });
      setUsers((prev) => [...prev, data.user]);
      return data.user;
    } catch (err) {
      throw translateApiError(err);
    }
  }, []);

  const updateUser = useCallback(async (id: string, patch: UpdateUserPatch): Promise<StaffUser> => {
    try {
      const data = await apiFetch<UserResponse>(`/api/users/${id}`, {
        method: "PATCH",
        auth: true,
        body: {
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.email !== undefined ? { email: patch.email.toLowerCase().trim() } : {}),
          ...(patch.role !== undefined ? { role: patch.role } : {}),
        },
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
      return data.user;
    } catch (err) {
      throw translateApiError(err);
    }
  }, []);

  const deleteUser = useCallback(async (id: string): Promise<void> => {
    try {
      await apiFetch<void>(`/api/users/${id}`, {
        method: "DELETE",
        auth: true,
      });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      throw translateApiError(err);
    }
  }, []);

  const resetPassword = useCallback(async (id: string, newPassword: string): Promise<void> => {
    try {
      await apiFetch<UserResponse>(`/api/users/${id}/reset-password`, {
        method: "POST",
        auth: true,
        body: { password: newPassword },
      });
      // No local state to update - we don't store passwords client-side
    } catch (err) {
      throw translateApiError(err);
    }
  }, []);

  return {
    users: sortedUsers,
    loading,
    loadError,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
  };
}
