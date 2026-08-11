interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-[1.125rem] border border-dark-200 bg-surface shadow-[0_12px_36px_rgba(28,37,31,0.045)] ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return (
    <div className={`border-b border-dark-200 px-4 py-4 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={`px-4 py-4 sm:px-6 ${className}`}>{children}</div>;
}
