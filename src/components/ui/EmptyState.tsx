import Button from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="studio-grid flex flex-col items-center justify-center rounded-2xl px-4 py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary-200 bg-primary-100 text-primary-700" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="mb-1 font-display text-xl font-semibold text-dark-900">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm leading-6 text-dark-500">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
