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

export default function BusinessCard({
  name,
  slug,
  location,
  category,
  avatar_url,
  avg_rating,
  review_count,
}: BusinessCardProps) {
  return (
    <Link
      href={`/profile/${slug}`}
      className="block bg-white rounded-xl border border-dark-200 p-4 hover:shadow-md hover:border-primary-200 transition group"
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} src={avatar_url} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-dark-900 group-hover:text-primary-700 transition truncate">
            {name}
          </h3>
          <p className="text-sm text-dark-500 truncate">{location}</p>
          {category && (
            <p className="text-xs text-dark-400 capitalize mt-0.5">
              {category.replace("-", " ")}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <StarRating rating={Math.round(avg_rating)} size="sm" />
            <span className="text-xs text-dark-500">
              {Number(avg_rating).toFixed(1)} ({review_count})
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <span className="text-sm font-medium text-primary-600 group-hover:text-primary-700">
          Book Now →
        </span>
      </div>
    </Link>
  );
}
