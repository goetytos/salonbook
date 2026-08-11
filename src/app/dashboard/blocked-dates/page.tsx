"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Button from "@/components/ui/Button";
import Card, { CardContent } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { BlockedDate, Staff } from "@/types";

export default function BlockedDatesPage() {
  const { business } = useAuth();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState("");
  const [staffId, setStaffId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!business) return;
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [blocked, staff] = await Promise.all([
        api.get<BlockedDate[]>(`/businesses/${business.id}/blocked-dates`),
        api.get<Staff[]>(`/businesses/${business.id}/staff`),
      ]);
      setBlockedDates(blocked);
      setStaffList(staff.filter((member) => member.active));
    } catch (requestError) {
      setBlockedDates([]);
      setError(requestError instanceof Error ? requestError.message : "Unavailable dates could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setDate("");
    setStaffId("");
    setStartTime("");
    setEndTime("");
    setReason("");
  };

  const handleCreate = async () => {
    if (!business || !date) return;
    setSaving(true);
    setActionError("");
    try {
      await api.post(`/businesses/${business.id}/blocked-dates`, {
        date,
        staff_id: staffId || undefined,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        reason: reason || undefined,
      });
      setModalOpen(false);
      resetForm();
      await fetchData(false);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "The unavailable time could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blockedId: string) => {
    if (!business || !confirm("Remove this blocked date?")) return;
    setRemoving(blockedId);
    setActionError("");
    try {
      await api.delete(`/businesses/${business.id}/blocked-dates?blocked_id=${blockedId}`);
      await fetchData(false);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "The unavailable time could not be removed.");
    } finally {
      setRemoving(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const formatDate = (value: string) => new Date(`${value.split("T")[0]}T00:00:00`).toLocaleDateString("en-KE", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        eyebrow="Availability"
        title="Blocked dates"
        description="Protect time for leave, private commitments and pauses in the studio schedule."
        actions={<Button onClick={() => { setActionError(""); setModalOpen(true); }}>Block time</Button>}
      />

      <div className="mb-6 flex gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm leading-6 text-primary-900">
        <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>Choose all staff to close the business for that period, or assign the block to one team member.</p>
      </div>

      {actionError && !modalOpen && (
        <div className="mb-5">
          <DashboardState type="error" title="The schedule was not changed" description={actionError} />
        </div>
      )}

      {loading ? (
        <DashboardState type="loading" title="Loading blocked dates" />
      ) : error ? (
        <DashboardState type="error" title="Availability unavailable" description={error} onRetry={() => void fetchData()} />
      ) : blockedDates.length === 0 ? (
        <Card>
          <CardContent className="p-2 sm:p-2">
            <EmptyState
              icon={
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              }
              title="No time blocked"
              description="Your current working schedule is available for bookings. Add a block whenever plans change."
              actionLabel="Block time"
              onAction={() => { setActionError(""); setModalOpen(true); }}
            />
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Unavailable dates">
          {blockedDates.map((blockedDate) => {
            const busy = removing === blockedDate.id;
            const fullDay = !blockedDate.start_time || !blockedDate.end_time;
            return (
              <Card key={blockedDate.id}>
                <CardContent className="flex h-full flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-900 text-white" aria-hidden="true">
                    <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em]">
                      {new Date(`${blockedDate.date.split("T")[0]}T00:00:00`).toLocaleDateString("en-KE", { month: "short" })}
                    </span>
                    <span className="font-display text-2xl font-semibold leading-none">
                      {new Date(`${blockedDate.date.split("T")[0]}T00:00:00`).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-dark-900">{formatDate(blockedDate.date)}</h2>
                    <p className="mt-2 text-sm font-medium text-dark-700">
                      {fullDay ? "Full day" : `${blockedDate.start_time?.slice(0, 5)} – ${blockedDate.end_time?.slice(0, 5)}`}
                    </p>
                    <p className="mt-1 text-sm text-dark-500">{blockedDate.staff_name || "All staff"}</p>
                    {blockedDate.reason && <p className="mt-3 rounded-lg bg-dark-50 px-3 py-2 text-sm leading-6 text-dark-600">{blockedDate.reason}</p>}
                    <div className="mt-4 flex items-center gap-3" aria-busy={busy || undefined}>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => void handleDelete(blockedDate.id)}>Remove block</Button>
                      {busy && <span className="text-xs text-dark-500" role="status">Removing…</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Block time">
        <div className="space-y-4">
          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{actionError}</p>
          )}
          <Input label="Date" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} autoFocus />
          {staffList.length > 0 && (
            <Select
              label="Staff member (optional)"
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              placeholder="All staff"
              options={staffList.map((staff) => ({ value: staff.id, label: staff.name }))}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Start time (optional)" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            <Input label="End time (optional)" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </div>
          <p className="text-xs leading-5 text-dark-500">Leave both times empty to block the full day.</p>
          <Input label="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Public holiday" />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} loading={saving} disabled={!date}>Block time</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
