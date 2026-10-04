import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { canAccess, getUser, homePathForRole, type Role } from "@/lib/auth";

type AllowedRole = "acceptance" | "kitchen" | "driver" | "admin";

export function RequireRole({ route, children }: { route: AllowedRole; children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "ok" } | { kind: "denied"; role: Role }
  >({ kind: "loading" });

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    if (canAccess(u.role, route)) setState({ kind: "ok" });
    else setState({ kind: "denied", role: u.role });
  }, [route]);

  if (state.kind === "loading") return null;
  if (state.kind === "denied") {
    const home = homePathForRole(state.role);
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
        <Button className="mt-6" onClick={() => navigate({ to: home })}>
          Back to your dashboard
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
