import { useEffect, useState } from "react";
import {
  createFileRoute,
  redirect,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getToken, getUser, type User } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";
import { appConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!getToken() || !getUser()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pageLabel: Record<string, string> = {
    "/acceptance": "Acceptance",
    "/kitchen": "Kitchen",
    "/driver": "Deliveries",
    "/menu": "Menu",
    "/admin": "Staff",
    "/archive": "Order Archive",
    "/settings": "Settings",
  };

  useEffect(() => {
    const tablet = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const update = () => setSidebarOpen(!tablet.matches);
    update();
    tablet.addEventListener("change", update);
    return () => tablet.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!getToken() || !u) {
      navigate({ to: "/login" });
      return;
    }
    setUser(u);
    setHydrated(true);

    // Ensure the realtime socket is open for any logged-in session.
    // This matters on page refresh — the user is still authenticated via
    // localStorage but the in-memory socket variable was wiped.
    connectSocket();
  }, [navigate]);

  if (!hydrated || !user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0 bg-muted/30">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger />
          <div className="min-w-0 flex-1 truncate text-sm font-medium">
            <span className="hidden text-muted-foreground sm:inline">
              {appConfig.restaurantName} /{" "}
            </span>
            {pageLabel[pathname] ?? appConfig.restaurantName}
          </div>
          <span className="hidden text-xs capitalize text-muted-foreground sm:inline">
            {user.role}
          </span>
        </header>
        <main
          className={cn(
            "mx-auto w-full min-w-0 px-4 py-4 sm:px-6 sm:py-5",
            ["/acceptance", "/kitchen", "/driver"].includes(pathname)
              ? "max-w-[1920px]"
              : "max-w-6xl",
          )}
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
