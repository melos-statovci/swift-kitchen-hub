import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StaffUser, UserRole } from "@/lib/types";
import { DuplicateEmailError } from "@/hooks/useUsers";
import { appConfig } from "@/lib/config";

const ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: "admin",
    label: "Admin",
    description: "All order workflows, menu, staff and restaurant settings.",
  },
  {
    value: "acceptance",
    label: "Acceptance",
    description: "Review incoming orders, manage handoff and read the order archive.",
  },
  {
    value: "kitchen",
    label: "Kitchen",
    description: "Prepare accepted orders and mark them ready for handoff.",
  },
  {
    value: "driver",
    label: "Driver",
    description:
      "Claim delivery orders and complete your deliveries. Pickup stays with the restaurant.",
  },
];

const baseFields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  role: z.enum(["admin", "acceptance", "kitchen", "driver"] as const),
};

const createSchema = z.object({
  ...baseFields,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

const editSchema = z.object(baseFields);

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

function generatePassword(length = 16): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    out += charset[arr[i] % charset.length];
  }
  return out;
}

export type StaffFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user: StaffUser | null;
  onCreate: (values: CreateValues) => Promise<void>;
  onUpdate: (id: string, values: EditValues) => Promise<void>;
};

export function StaffFormDialog({
  open,
  onOpenChange,
  mode,
  user,
  onCreate,
  onUpdate,
}: StaffFormDialogProps) {
  const isCreate = mode === "create";

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", role: "acceptance", password: "" },
  });

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", email: "", role: "acceptance" },
  });

  const [emailChanged, setEmailChanged] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = isCreate ? createForm.formState.isSubmitting : editForm.formState.isSubmitting;

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    if (isCreate) {
      createForm.reset({ name: "", email: "", role: "acceptance", password: "" });
    } else if (user) {
      editForm.reset({ name: user.name, email: user.email, role: user.role });
      setEmailChanged(false);
    }
  }, [open, isCreate, user, createForm, editForm]);

  const handleGenerate = async () => {
    const pw = generatePassword();
    createForm.setValue("password", pw, { shouldValidate: true });
    try {
      await navigator.clipboard.writeText(pw);
      toast.success("Password copied to clipboard. Share it with the user securely.");
    } catch {
      toast.message("Password generated", {
        description: "Copy it manually before saving.",
      });
    }
  };

  const submitCreate = async (values: CreateValues) => {
    setSaveError(null);
    try {
      await onCreate(values);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof DuplicateEmailError) {
        createForm.setError("email", { message: "An account with this email already exists" });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to create account";
      setSaveError(message);
      toast.error(message);
    }
  };

  const submitEdit = async (values: EditValues) => {
    if (!user) return;
    setSaveError(null);
    try {
      await onUpdate(user.id, values);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof DuplicateEmailError) {
        editForm.setError("email", { message: "An account with this email already exists" });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to update account";
      setSaveError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create staff account" : "Edit staff account"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? `Add a new person who can access ${appConfig.restaurantName}.`
              : "Update this staff member's details."}
          </DialogDescription>
        </DialogHeader>

        {isCreate ? (
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(submitCreate)}
              className="space-y-4"
              aria-busy={submitting}
            >
              <fieldset disabled={submitting} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {ROLES.find((role) => role.value === field.value)?.description}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="text" autoComplete="new-password" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerate}
                          className="shrink-0"
                        >
                          <Wand2 className="h-4 w-4" />
                          Generate
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {saveError && (
                  <p role="alert" className="text-sm text-destructive">
                    {saveError}
                  </p>
                )}
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating…" : "Create account"}
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        ) : (
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(submitEdit)}
              className="space-y-4"
              aria-busy={submitting}
            >
              <fieldset disabled={submitting} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="off"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setEmailChanged(e.target.value !== user?.email);
                          }}
                        />
                      </FormControl>
                      {emailChanged && (
                        <FormDescription>
                          Changing email will require the user to log in with the new address.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {ROLES.find((role) => role.value === field.value)?.description}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {saveError && (
                  <p role="alert" className="text-sm text-destructive">
                    {saveError}
                  </p>
                )}
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving…" : "Save changes"}
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
