export function RolePlaceholder({ role }: { role: string }) {
  return (
    <section className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight capitalize">{role}</h1>
      <p className="text-muted-foreground">This page will be built out in a later step.</p>
    </section>
  );
}
