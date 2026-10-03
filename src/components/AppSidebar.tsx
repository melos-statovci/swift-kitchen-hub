import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  ChefHat,
  ClipboardList,
  LogOut,
  Settings,
  Truck,
  UtensilsCrossed,
  Users,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/Logo";
import { logout, type Role, type User } from "@/lib/auth";
import { useSoundPref } from "@/hooks/useSoundPref";
import { appConfig } from "@/lib/config";

type NavItem = { label: string; to: string; icon: LucideIcon };
type NavGroup = { label?: string; items: NavItem[] };

// Role-aware navigation. Mirrors the route guards: admin sees everything
// (grouped Operations / Manage), each staff role sees only what it can reach.
function navForRole(role: Role): NavGroup[] {
  switch (role) {
    case "admin":
      return [
        {
          label: "Operations",
          items: [
            { label: "Acceptance", to: "/acceptance", icon: ClipboardList },
            { label: "Kitchen", to: "/kitchen", icon: ChefHat },
            { label: "Deliveries", to: "/driver", icon: Truck },
          ],
        },
        {
          label: "Manage",
          items: [
            { label: "Staff", to: "/admin", icon: Users },
            { label: "Menu", to: "/menu", icon: UtensilsCrossed },
            { label: "Order Archive", to: "/archive", icon: Archive },
          ],
        },
      ];
    case "acceptance":
      return [
        {
          items: [
            { label: "Orders", to: "/acceptance", icon: ClipboardList },
            { label: "Order Archive", to: "/archive", icon: Archive },
          ],
        },
      ];
    case "kitchen":
      return [{ items: [{ label: "Kitchen", to: "/kitchen", icon: ChefHat }] }];
    case "driver":
      return [{ items: [{ label: "Deliveries", to: "/driver", icon: Truck }] }];
  }
}

export function AppSidebar({ user }: { user: User }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { enabled: soundOn, toggle: toggleSound } = useSoundPref();
  const groups = navForRole(user.role);
  const { setOpenMobile } = useSidebar();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <Logo className="h-8 w-8 shrink-0" />
          <span className="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            {appConfig.restaurantName}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, i) => (
          <SidebarGroup key={group.label ?? i}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.to}
                        tooltip={item.label}
                        className="min-h-11 md:min-h-9"
                      >
                        <Link to={item.to} onClick={() => setOpenMobile(false)}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {user.role === "admin" && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/settings"} tooltip="Settings">
                <Link to="/settings" onClick={() => setOpenMobile(false)}>
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSound}
              tooltip={soundOn ? "Order sounds on" : "Order sounds off"}
            >
              {soundOn ? <Volume2 /> : <VolumeX />}
              <span>{soundOn ? "Order sounds on" : "Order sounds off"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Log out">
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
          <div className="truncate text-sm font-medium leading-tight">{user.name}</div>
          <div className="truncate text-xs capitalize text-muted-foreground">{user.role}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
