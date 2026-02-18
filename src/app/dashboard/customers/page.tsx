"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent } from "@/components/ui/Card";
import SearchBar from "@/components/ui/SearchBar";
import EmptyState from "@/components/ui/EmptyState";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  booking_count: number;
  last_booking: string;
  created_at: string;
}

export default function CustomersPage() {
  const { business } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!business) return;
    api
      .get<CustomerRow[]>(`/businesses/${business.id}/customers`)
      .then(setCustomers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [business]);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Customers</h1>
          <p className="text-dark-500 text-sm mt-1">
            Your client list, built automatically from bookings
          </p>
        </div>
      </div>

      {customers.length > 0 && (
        <div className="mb-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name or phone..."
            className="max-w-sm"
          />
        </div>
      )}

      {loading ? (
        <p className="text-dark-400">Loading...</p>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No customers yet"
              description="Customers are added automatically when they book an appointment."
            />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-dark-500">No customers matching &quot;{search}&quot;</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-100">
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Name</th>
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Phone</th>
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Bookings</th>
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Last Visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100">
                {filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-dark-50 transition">
                    <td className="px-6 py-3">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-dark-700">{customer.phone}</td>
                    <td className="px-6 py-3 text-dark-700">{customer.booking_count}</td>
                    <td className="px-6 py-3 text-dark-700">
                      {customer.last_booking
                        ? new Date(customer.last_booking).toLocaleDateString("en-KE", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
