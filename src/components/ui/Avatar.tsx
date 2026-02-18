"use client";

interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}

export default function Avatar({ name, src, size = "md" }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-primary-100 text-primary-700 font-medium flex items-center justify-center`}
    >
      {initials}
    </div>
  );
}
