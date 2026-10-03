import { useEffect } from "react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { StaffUser } from "@/lib/types";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

type Values = z.infer<typeof schema>;

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

export type ResetPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: StaffUser | null;
  onConfirm: (id: string, newPassword: string) => Promise<void>;
};

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
}: ResetPasswordDialogProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (open) form.reset({ password: "" });
  }, [open, form]);

  const handleGenerate = async () => {
    const pw = generatePassword();
    form.setValue("password", pw, { shouldValidate: true });
    try {
      await navigator.clipboard.writeText(pw);
      toast.success("Password copied to clipboard. Share it with the user securely.");
    } catch {
      toast.message("Password generated", {
        description: "Copy it manually before saving.",
      });
    }
  };

  const submitting = form.formState.isSubmitting;
  const onSubmit = async (values: Values) => {
    if (!user) return;
    form.clearErrors("root");
    try {
      await onConfirm(user.id, values.password);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      form.setError("root.server", { message });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {user
              ? `Set a new password for ${user.name}. They'll need it to sign in.`
              : "Set a new password."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-busy={submitting}>
            <fieldset disabled={submitting} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
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
              {form.formState.errors.root?.server?.message && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.root.server.message}
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Resetting…" : "Reset password"}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
