"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import Button from "@/components/ui/Button";

interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  location: string;
  category: string | null;
  status: string;
  created_at: string;
  booking_count: number;
  customer_count: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  suspended: "bg-red-100 text-red-800",
};

function adminFetchWithToken<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("salonbook_admin_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`/api/admin${path}`, { ...options, headers }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error);
    }
    return res.json();
  });
}

export default function AdminDashboard() {
  const { stats, refreshStats } = useAdminAuth();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchBusinesses = useCallback(async () => {
    try {
      const params = filter ? `?status=${filter}` : "";
      const data = await adminFetchWithToken<BusinessRow[]>(`/businesses${params}`);
      setBusinesses(data);
    } catch {
      // failed to load
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const updateStatus = async (businessId: string, status: string) => {
    setUpdating(businessId);
    try {
      await adminFetchWithToken(`/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await fetchBusinesses();
      await refreshStats();
    } catch {
      // update failed
    } finally {
      setUpdating(null);
    }
  };

  const statCards = [
    { label: "Total Businesses", value: stats?.total_businesses ?? "—", color: "bg-dark-800 text-white" },
    { label: "Pending Approval", value: stats?.pending_businesses ?? "—", color: "bg-amber-50 text-amber-800 border border-amber-200" },
    { label: "Active", value: stats?.active_businesses ?? "—", color: "bg-green-50 text-green-800 border border-green-200" },
    { label: "Suspended", value: stats?.suspended_businesses ?? "—", color: "bg-red-50 text-red-800 border border-red-200" },
    { label: "Total Bookings", value: stats?.total_bookings ?? "—", color: "bg-primary-50 text-primary-800 border border-primary-200" },
    { label: "Total Revenue", value: stats?.total_revenue != null ? `KES ${Number(stats.total_revenue).toLocaleString()}` : "—", color: "bg-accent-50 text-accent-800 border border-accent-200" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-dark-900">Platform Dashboard</h1>
        <p className="text-dark-500 mt-1">Manage businesses and monitor platform activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-xl p-4 ${card.color}`}>
            <p className="text-sm opacity-80">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Businesses Table */}
      <div className="bg-white rounded-xl border border-dark-200 shadow-sm">
        <div className="p-4 border-b border-dark-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-dark-900">Businesses</h2>
          <div className="flex gap-2">
            {["", "pending", "active", "suspended"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === f
                    ? "bg-dark-800 text-white"
                    : "bg-dark-100 text-dark-600 hover:bg-dark-200"
                }`}
              >
                {f || "All"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-dark-400">Loading businesses...</div>
        ) : businesses.length === 0 ? (
          <div className="p-8 text-center text-dark-400">No businesses found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-200 bg-dark-50">
                  <th className="text-left p-3 font-medium text-dark-600">Business</th>
                  <th className="text-left p-3 font-medium text-dark-600">Location</th>
                  <th className="text-left p-3 font-medium text-dark-600">Status</th>
                  <th className="text-left p-3 font-medium text-dark-600">Bookings</th>
                  <th className="text-left p-3 font-medium text-dark-600">Customers</th>
                  <th className="text-left p-3 font-medium text-dark-600">Joined</th>
                  <th className="text-right p-3 font-medium text-dark-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((biz) => (
                  <tr key={biz.id} className="border-b border-dark-100 hover:bg-dark-50">
                    <td className="p-3">
                      <div className="font-medium text-dark-900">{biz.name}</div>
                      <div className="text-dark-400 text-xs">{biz.email}</div>
                    </td>
                    <td className="p-3 text-dark-600">{biz.location}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[biz.status] || "bg-dark-100 text-dark-600"}`}>
                        {biz.status}
                      </span>
                    </td>
                    <td className="p-3 text-dark-600">{biz.booking_count}</td>
                    <td className="p-3 text-dark-600">{biz.customer_count}</td>
                    <td className="p-3 text-dark-400 text-xs">
                      {new Date(biz.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {biz.status !== "active" && (
                          <Button
                            size="sm"
                            variant="primary"
                            loading={updating === biz.id}
                            onClick={() => updateStatus(biz.id, "active")}
                          >
                            Activate
                          </Button>
                        )}
                        {biz.status !== "suspended" && (
                          <Button
                            size="sm"
                            variant="danger"
                            loading={updating === biz.id}
                            onClick={() => updateStatus(biz.id, "suspended")}
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
