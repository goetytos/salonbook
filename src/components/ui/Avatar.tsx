"use client";

import { useEffect, useState } from "react";

interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}

export default function Avatar({ name, src, size = "md" }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };
  const dimensions = { sm: 32, md: 40, lg: 56 };

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name}
        width={dimensions[size]}
        height={dimensions[size]}
        onError={() => setImageFailed(true)}
        className={`${sizes[size]} shrink-0 rounded-xl object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-800`}
      role="img"
      aria-label={name}
    >
      {initials}
    </div>
  );
}
