import { Button } from "@/components/ui/button";

export function WorkflowStageNav({
  stages,
  onSelect,
}: {
  stages: { id: string; label: string; count: number }[];
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Workflow stages" className="flex min-w-0 flex-wrap gap-2">
      {stages.map((stage) => (
        <Button
          key={stage.id}
          variant="outline"
          className="min-h-11 bg-background"
          onClick={() => onSelect(stage.id)}
          aria-label={`Go to ${stage.label}, ${stage.count} orders`}
        >
          {stage.label}
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums">{stage.count}</span>
        </Button>
      ))}
      <p className="basis-full text-xs text-muted-foreground lg:hidden">
        Swipe between stages or use the stage buttons.
      </p>
    </nav>
  );
}
