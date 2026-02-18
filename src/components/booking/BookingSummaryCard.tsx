interface BookingSummaryCardProps {
  serviceName: string;
  date: string;
  time: string;
  price: number;
  staffName?: string;
  discountedPrice?: number;
}

export default function BookingSummaryCard({
  serviceName,
  date,
  time,
  price,
  staffName,
  discountedPrice,
}: BookingSummaryCardProps) {
  return (
    <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
      <h3 className="text-sm font-medium text-primary-800 mb-2">Booking Summary</h3>
      <div className="space-y-1 text-sm text-primary-700">
        <p>{serviceName}</p>
        {staffName && <p>with {staffName}</p>}
        <p>
          {new Date(date + "T00:00:00").toLocaleDateString("en-KE", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}{" "}
          at {time}
        </p>
        <div className="flex items-center gap-2">
          {discountedPrice !== undefined && discountedPrice < price ? (
            <>
              <p className="font-semibold">
                KES {discountedPrice.toLocaleString()}
              </p>
              <p className="line-through text-primary-400 text-xs">
                KES {Number(price).toLocaleString()}
              </p>
            </>
          ) : (
            <p className="font-semibold">
              KES {Number(price).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
