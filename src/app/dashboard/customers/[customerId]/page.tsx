"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Tag from "@/components/ui/Tag";
import Avatar from "@/components/ui/Avatar";
import Textarea from "@/components/ui/Textarea";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { Booking, ClientNote, ClientTag } from "@/types";

interface ClientDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  created_at: string;
  bookings: Booking[];
  notes: ClientNote[];
  tags: ClientTag[];
  total_spent: number;
  total_visits: number;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const { business } = useAuth();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [allTags, setAllTags] = useState<ClientTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!business) return;
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [clientData, tags] = await Promise.all([
        api.get<ClientDetail>(`/businesses/${business.id}/customers/${customerId}`),
        api.get<ClientTag[]>(`/businesses/${business.id}/tags`),
      ]);
      setClient(clientData);
      setAllTags(tags);
    } catch (requestError) {
      setClient(null);
      setError(requestError instanceof Error ? requestError.message : "Customer details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business, customerId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const mutate = async (action: () => Promise<unknown>, fallback: string) => {
    setMutationError("");
    try {
      await action();
      await fetchData(false);
      return true;
    } catch (requestError) {
      setMutationError(requestError instanceof Error ? requestError.message : fallback);
      return false;
    }
  };

  const handleAddNote = async () => {
    if (!business || !newNote.trim()) return;
    setSavingNote(true);
    const saved = await mutate(() => api.post(`/businesses/${business.id}/customers/${customerId}/notes`, { note: newNote.trim() }), "The note could not be added.");
    if (saved) setNewNote("");
    setSavingNote(false);
  };

  if (loading) return <DashboardState type="loading" title="Loading customer profile" />;
  if (error || !client) return <DashboardState type="error" title="Customer unavailable" description={error || "This customer record could not be found."} onRetry={() => void fetchData()} />;

  const badgeVariant = (status: string) => status === "Booked" ? "success" as const : status === "Cancelled" || status === "No-Show" ? "danger" as const : "default" as const;
  const unassignedTags = allTags.filter((tag) => !client.tags.some((clientTag) => clientTag.id === tag.id));
  const formatDate = (date: string) => new Date(date + (date.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <Link href="/dashboard/customers" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-primary-700 hover:underline">← Customer directory</Link>
      <PageHeader
        eyebrow="Customer profile"
        title={client.name}
        description={`${client.phone}${client.email ? ` · ${client.email}` : ""}`}
        actions={<Avatar name={client.name} size="lg" />}
      />

      {mutationError && <div className="mb-5"><DashboardState type="error" title="The change was not saved" description={mutationError} /></div>}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Customer totals">
        {[
          ["Visits", client.total_visits],
          ["Total spent", `KES ${client.total_spent.toLocaleString()}`],
          ["Bookings", client.bookings.length],
        ].map(([label, value]) => (
          <Card key={String(label)}><CardContent className="py-5"><p className="text-xs font-bold uppercase tracking-[0.13em] text-dark-500">{label}</p><p className="mt-3 text-2xl font-bold tabular-nums text-dark-900">{value}</p></CardContent></Card>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold text-dark-900">Tags</h2><p className="mt-1 text-xs text-dark-500">Useful context for the next appointment</p></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {client.tags.map((tag) => <Tag key={tag.id} label={tag.name} color={tag.color} onRemove={() => business && mutate(() => api.delete(`/businesses/${business.id}/customers/${customerId}/tags?tag_id=${tag.id}`), "The tag could not be removed.")} />)}
              {client.tags.length === 0 && <p className="text-sm text-dark-500">No tags assigned.</p>}
            </div>
            {unassignedTags.length > 0 && (
              <div className="mt-4 border-t border-dark-200 pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-dark-500">Add a tag</p>
                <div className="flex flex-wrap gap-2">
                  {unassignedTags.map((tag) => <button key={tag.id} type="button" onClick={() => business && mutate(() => api.post(`/businesses/${business.id}/customers/${customerId}/tags`, { tag_id: tag.id }), "The tag could not be added.")} className="inline-flex min-h-11 items-center rounded-lg border border-dark-200 px-3 text-sm font-semibold text-dark-700 hover:bg-dark-50">+ {tag.name}</button>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold text-dark-900">Private notes</h2><p className="mt-1 text-xs text-dark-500">Visible only inside this business workspace</p></CardHeader>
          <CardContent>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {client.notes.length === 0 && <p className="text-sm text-dark-500">No notes yet.</p>}
              {client.notes.map((note) => (
                <div key={note.id} className="flex items-start gap-2 rounded-xl bg-dark-50 p-3 text-sm">
                  <div className="flex-1"><p className="leading-6 text-dark-700">{note.note}</p><p className="mt-1 text-xs text-dark-400">{formatDate(note.created_at)}</p></div>
                  <button type="button" aria-label="Delete note" onClick={() => business && mutate(() => api.delete(`/businesses/${business.id}/customers/${customerId}/notes?note_id=${note.id}`), "The note could not be deleted.")} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-dark-500 hover:bg-red-50 hover:text-red-700">×</button>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-dark-200 pt-4">
              <Textarea label="Add a note" value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Preferences, allergies or useful context" />
              <div className="mt-2 flex justify-end"><Button size="sm" onClick={handleAddNote} loading={savingNote} disabled={!newNote.trim()}>Add note</Button></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader><h2 className="font-semibold text-dark-900">Booking history</h2></CardHeader>
        {client.bookings.length === 0 ? (
          <CardContent><DashboardState title="No booking history" description="Appointments from this customer will appear here." /></CardContent>
        ) : (
          <>
            <div className="divide-y divide-dark-200 md:hidden">
              {client.bookings.map((booking) => (
                <article key={booking.id} className="p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-dark-900">{booking.service_name}</h3><p className="mt-1 text-sm text-dark-500">{formatDate(booking.date)} · {booking.time?.slice(0, 5)}</p>{booking.staff_name && <p className="mt-1 text-xs text-dark-400">With {booking.staff_name}</p>}</div><Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge></div>
                  <p className="mt-3 font-bold tabular-nums text-primary-700">KES {Number(booking.service_price).toLocaleString()}</p>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm"><caption className="sr-only">Booking history for {client.name}</caption>
                <thead><tr className="border-b border-dark-200 bg-dark-50">{['Service', 'Date', 'Time', 'Price', 'Status'].map((heading) => <th key={heading} scope="col" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-dark-500">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-dark-200">{client.bookings.map((booking) => <tr key={booking.id}><td className="px-5 py-4 font-semibold text-dark-900">{booking.service_name}{booking.staff_name && <span className="ml-1 block text-xs font-normal text-dark-400">{booking.staff_name}</span>}</td><td className="px-5 py-4 text-dark-700">{formatDate(booking.date)}</td><td className="px-5 py-4 font-mono text-dark-700">{booking.time?.slice(0, 5)}</td><td className="px-5 py-4 font-semibold tabular-nums text-dark-700">KES {Number(booking.service_price).toLocaleString()}</td><td className="px-5 py-4"><Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge></td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
