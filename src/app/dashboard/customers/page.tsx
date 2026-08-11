"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card from "@/components/ui/Card";
import SearchBar from "@/components/ui/SearchBar";
import Avatar from "@/components/ui/Avatar";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";

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
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchCustomers = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      setCustomers(await api.get<CustomerRow[]>(`/businesses/${business.id}/customers`));
    } catch (requestError) {
      setCustomers([]);
      setError(requestError instanceof Error ? requestError.message : "Customer records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => { void fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter((customer) => customer.name.toLowerCase().includes(search.toLowerCase()) || customer.phone.includes(search));
  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" }) : "No visit yet";

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Customers" description="A customer directory built from completed and upcoming appointments." />

      {customers.length > 0 && (
        <div className="mb-5 max-w-md">
          <SearchBar value={search} onChange={setSearch} label="Search customers by name or phone number" placeholder="Search by name or phone" />
        </div>
      )}

      {loading ? (
        <DashboardState type="loading" title="Loading customers" />
      ) : error ? (
        <DashboardState type="error" title="Customers unavailable" description={error} onRetry={fetchCustomers} />
      ) : customers.length === 0 ? (
        <DashboardState title="No customers yet" description="Customer records are created automatically after someone books an appointment." />
      ) : filtered.length === 0 ? (
        <DashboardState title="No matching customers" description={`No customer name or phone number matches “${search}”.`} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((customer) => (
              <Link key={customer.id} href={`/dashboard/customers/${customer.id}`} className="flex items-center gap-4 rounded-2xl border border-dark-200 bg-surface p-4 hover:border-primary-300">
                <Avatar name={customer.name} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-dark-900">{customer.name}</h2>
                  <p className="mt-1 text-sm text-dark-500">{customer.phone}</p>
                  <p className="mt-2 text-xs text-dark-400">{customer.booking_count} booking{customer.booking_count === 1 ? "" : "s"} · Last visit {formatDate(customer.last_booking)}</p>
                </div>
                <span className="text-primary-700" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>

          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Customer directory</caption>
                <thead><tr className="border-b border-dark-200 bg-dark-50">
                  {['Customer', 'Phone', 'Bookings', 'Last visit'].map((heading) => <th key={heading} scope="col" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-dark-500">{heading}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-dark-200">
                  {filtered.map((customer) => (
                    <tr key={customer.id} className="hover:bg-dark-50/70">
                      <td className="px-5 py-4"><Link href={`/dashboard/customers/${customer.id}`} className="flex items-center gap-3 font-semibold text-dark-900 hover:text-primary-700"><Avatar name={customer.name} size="sm" />{customer.name}</Link></td>
                      <td className="px-5 py-4 text-dark-700">{customer.phone}</td>
                      <td className="px-5 py-4 font-mono tabular-nums text-dark-700">{customer.booking_count}</td>
                      <td className="px-5 py-4 text-dark-700">{formatDate(customer.last_booking)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
