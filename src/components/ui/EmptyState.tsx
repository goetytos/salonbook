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
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 bg-dark-100 rounded-full flex items-center justify-center mb-4 text-dark-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-dark-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-dark-500 max-w-sm mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
