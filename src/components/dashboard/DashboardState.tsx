import Button from "@/components/ui/Button";

interface DashboardStateProps {
  type?: "loading" | "error" | "empty";
  title: string;
  description?: string;
  onRetry?: () => void;
}

export default function DashboardState({
  type = "empty",
  title,
  description,
  onRetry,
}: DashboardStateProps) {
  if (type === "loading") {
    return (
      <div className="space-y-3" role="status" aria-label={title}>
        <div className="h-24 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" />
        <span className="sr-only">{title}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-6 ${
        type === "error" ? "border-red-200 bg-red-50" : "border-dark-200 bg-surface"
      }`}
      role={type === "error" ? "alert" : "status"}
    >
      <h2 className={`font-semibold ${type === "error" ? "text-red-900" : "text-dark-900"}`}>{title}</h2>
      {description && (
        <p className={`mt-2 max-w-2xl text-sm leading-6 ${type === "error" ? "text-red-700" : "text-dark-500"}`}>
          {description}
        </p>
      )}
      {onRetry && (
        <Button size="sm" variant={type === "error" ? "danger" : "secondary"} onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}
