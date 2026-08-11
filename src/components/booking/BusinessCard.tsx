import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import StarRating from "@/components/ui/StarRating";

interface BusinessCardProps {
  name: string;
  slug: string;
  location: string;
  category?: string;
  avatar_url?: string;
  avg_rating: number;
  review_count: number;
}

export default function BusinessCard({ name, slug, location, category, avatar_url, avg_rating, review_count }: BusinessCardProps) {
  return (
    <Link
      href={`/profile/${slug}`}
      className="group flex h-full flex-col rounded-2xl border border-dark-200 bg-surface p-4 shadow-[0_12px_36px_rgba(28,37,31,0.045)] transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-[0_18px_44px_rgba(28,37,31,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} src={avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          {category && <p className="truncate text-[0.62rem] font-bold uppercase tracking-[0.12em] text-primary-700">{category.replace("-", " ")}</p>}
          <h3 className="mt-1 truncate font-display text-xl font-semibold text-dark-900 transition-colors group-hover:text-primary-700">{name}</h3>
          <p className="mt-1 truncate text-sm text-dark-500">{location}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-dark-200 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <StarRating rating={Number(avg_rating)} size="sm" />
          <span className="truncate text-xs tabular-nums text-dark-500">{Number(avg_rating).toFixed(1)} · {review_count}</span>
        </div>
        <span className="shrink-0 text-sm font-bold text-primary-700">View studio <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}
