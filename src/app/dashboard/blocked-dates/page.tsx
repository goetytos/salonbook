"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import type { BlockedDate, Staff } from "@/types";

export default function BlockedDatesPage() {
  const { business } = useAuth();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [date, setDate] = useState("");
  const [staffId, setStaffId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!business) return;
    try {
      const [blocked, staff] = await Promise.all([
        api.get<BlockedDate[]>(`/businesses/${business.id}/blocked-dates`),
        api.get<Staff[]>(`/businesses/${business.id}/staff`),
      ]);
      setBlockedDates(blocked);
      setStaffList(staff.filter((s) => s.active));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!business || !date) return;
    setSaving(true);
    try {
      await api.post(`/businesses/${business.id}/blocked-dates`, {
        date,
        staff_id: staffId || undefined,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        reason: reason || undefined,
      });
      setModalOpen(false);
      setDate("");
      setStaffId("");
      setStartTime("");
      setEndTime("");
      setReason("");
      await fetchData();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blockedId: string) => {
    if (!business || !confirm("Remove this blocked date?")) return;
    try {
      await api.delete(`/businesses/${business.id}/blocked-dates?blocked_id=${blockedId}`);
      await fetchData();
    } catch {
      // silent
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Blocked Dates</h1>
          <p className="text-dark-500 text-sm mt-1">
            Block off dates when you or your staff are unavailable
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Block Date</Button>
      </div>

      {loading ? (
        <p className="text-dark-400">Loading...</p>
      ) : blockedDates.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              }
              title="No blocked dates"
              description="Block off dates when you can't accept bookings, like holidays or personal days."
              actionLabel="Block a Date"
              onAction={() => setModalOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {blockedDates.map((bd) => (
            <Card key={bd.id}>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-dark-900">
                      {new Date(bd.date + "T00:00:00").toLocaleDateString("en-KE", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {bd.staff_name && (
                        <span className="text-sm text-dark-500">{bd.staff_name}</span>
                      )}
                      {bd.start_time && bd.end_time && (
                        <span className="text-sm text-dark-500">
                          {bd.start_time.slice(0, 5)} - {bd.end_time.slice(0, 5)}
                        </span>
                      )}
                      {!bd.start_time && (
                        <span className="text-sm text-dark-400">Full day</span>
                      )}
                    </div>
                    {bd.reason && (
                      <p className="text-sm text-dark-400 mt-1">{bd.reason}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(bd.id)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Block a Date"
      >
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {staffList.length > 0 && (
            <Select
              label="Staff Member (optional)"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="All staff"
              options={staffList.map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time (optional)"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="End Time (optional)"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <p className="text-xs text-dark-400">
            Leave times empty to block the entire day
          </p>
          <Input
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Public holiday"
          />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreate} loading={saving} disabled={!date}>
              Block Date
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
