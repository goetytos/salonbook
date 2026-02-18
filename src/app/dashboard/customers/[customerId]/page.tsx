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
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchData = useCallback(async () => {
    if (!business) return;
    try {
      const [clientData, tags] = await Promise.all([
        api.get<ClientDetail>(`/businesses/${business.id}/customers/${customerId}`),
        api.get<ClientTag[]>(`/businesses/${business.id}/tags`),
      ]);
      setClient(clientData);
      setAllTags(tags);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business, customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNote = async () => {
    if (!business || !newNote.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/businesses/${business.id}/customers/${customerId}/notes`, {
        note: newNote.trim(),
      });
      setNewNote("");
      await fetchData();
    } catch {
      // silent
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!business) return;
    try {
      await api.delete(`/businesses/${business.id}/customers/${customerId}/notes?note_id=${noteId}`);
      await fetchData();
    } catch {
      // silent
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!business) return;
    try {
      await api.post(`/businesses/${business.id}/customers/${customerId}/tags`, { tag_id: tagId });
      await fetchData();
    } catch {
      // silent
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!business) return;
    try {
      await api.delete(`/businesses/${business.id}/customers/${customerId}/tags?tag_id=${tagId}`);
      await fetchData();
    } catch {
      // silent
    }
  };

  if (loading) return <p className="text-dark-400">Loading...</p>;
  if (!client) return <p className="text-dark-500">Customer not found.</p>;

  const badgeVariant = (status: string) => {
    if (status === "Booked") return "success" as const;
    if (status === "Cancelled" || status === "No-Show") return "danger" as const;
    return "default" as const;
  };

  const unassignedTags = allTags.filter(
    (t) => !client.tags.some((ct) => ct.id === t.id)
  );

  return (
    <div>
      <Link
        href="/dashboard/customers"
        className="text-sm text-primary-600 hover:text-primary-700 mb-4 inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Customers
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Avatar name={client.name} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-dark-900">{client.name}</h1>
          <p className="text-dark-500">{client.phone}</p>
          {client.email && <p className="text-dark-400 text-sm">{client.email}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent>
            <p className="text-sm text-dark-500">Total Visits</p>
            <p className="text-2xl font-bold text-dark-900">{client.total_visits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-dark-500">Total Spent</p>
            <p className="text-2xl font-bold text-primary-600">
              KES {client.total_spent.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-dark-500">All Bookings</p>
            <p className="text-2xl font-bold text-dark-900">{client.bookings.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tags */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-dark-900">Tags</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {client.tags.map((tag) => (
                <Tag
                  key={tag.id}
                  label={tag.name}
                  color={tag.color}
                  onRemove={() => handleRemoveTag(tag.id)}
                />
              ))}
              {client.tags.length === 0 && (
                <p className="text-sm text-dark-400">No tags assigned</p>
              )}
            </div>
            {unassignedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2 border-t border-dark-100">
                <span className="text-xs text-dark-400 mr-1 self-center">Add:</span>
                {unassignedTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    className="text-xs px-2 py-0.5 rounded-full border border-dark-200 text-dark-500 hover:bg-dark-50"
                  >
                    + {tag.name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-dark-900">Notes</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              {client.notes.map((note) => (
                <div key={note.id} className="flex items-start gap-2 text-sm">
                  <div className="flex-1 bg-dark-50 rounded-lg p-2">
                    <p className="text-dark-700">{note.note}</p>
                    <p className="text-xs text-dark-400 mt-1">
                      {new Date(note.created_at).toLocaleDateString("en-KE", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-dark-300 hover:text-red-500 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={handleAddNote} loading={savingNote} disabled={!newNote.trim()}>
                Add Note
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking History */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-semibold text-dark-900">Booking History</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-100">
                <th className="text-left px-6 py-3 font-medium text-dark-500">Service</th>
                <th className="text-left px-6 py-3 font-medium text-dark-500">Date</th>
                <th className="text-left px-6 py-3 font-medium text-dark-500">Time</th>
                <th className="text-left px-6 py-3 font-medium text-dark-500">Price</th>
                <th className="text-left px-6 py-3 font-medium text-dark-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {client.bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-dark-50">
                  <td className="px-6 py-3 text-dark-900">
                    {booking.service_name}
                    {booking.staff_name && (
                      <span className="text-dark-400 text-xs ml-1">({booking.staff_name})</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-dark-700">
                    {new Date(booking.date).toLocaleDateString("en-KE", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-3 text-dark-700">{booking.time?.slice(0, 5)}</td>
                  <td className="px-6 py-3 text-dark-700">
                    KES {Number(booking.service_price).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
