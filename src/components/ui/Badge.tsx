interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "default";
}

const variants = {
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  default: "border-dark-200 bg-dark-50 text-dark-700",
};

export default function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[0.7rem] font-bold leading-none ${variants[variant]}`}>
      {children}
    </span>
  );
}
