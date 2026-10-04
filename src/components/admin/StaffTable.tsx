import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import type { StaffUser, UserRole } from "@/lib/types";

type SortKey = "name" | "email" | "role" | "createdAt";
type SortDir = "asc" | "desc";

const roleLabel: Record<UserRole, string> = {
  admin: "Admin",
  acceptance: "Acceptance",
  kitchen: "Kitchen",
  driver: "Driver",
};

function roleBadge(role: UserRole) {
  switch (role) {
    case "admin":
      return <Badge variant="default">{roleLabel[role]}</Badge>;
    case "acceptance":
      return <Badge variant="secondary">{roleLabel[role]}</Badge>;
    case "kitchen":
    case "driver":
      return <Badge variant="outline">{roleLabel[role]}</Badge>;
  }
}

export type StaffTableProps = {
  users: StaffUser[];
  onEdit: (user: StaffUser) => void;
  onResetPassword: (user: StaffUser) => void;
  onDelete: (user: StaffUser) => void;
};

export function StaffTable({ users, onEdit, onResetPassword, onDelete }: StaffTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "createdAt") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = a[sortKey].toLowerCase();
        bv = b[sortKey].toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [users, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  };

  const sortHeader = (k: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="-ml-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      {label}
      <SortIcon k={k} />
    </button>
  );

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{sortHeader("name", "Name")}</TableHead>
            <TableHead>{sortHeader("email", "Email")}</TableHead>
            <TableHead>{sortHeader("role", "Role")}</TableHead>
            <TableHead>{sortHeader("createdAt", "Created")}</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell>{roleBadge(u.role)}</TableCell>
              <TableCell className="text-muted-foreground">{formatRelative(u.createdAt)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${u.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(u)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onResetPassword(u)}>
                      Reset password
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onDelete(u)}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
