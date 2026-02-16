"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { WorkingHours, DaySchedule } from "@/types";

const DAYS: (keyof WorkingHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DEFAULT_SCHEDULE: DaySchedule = { open: "09:00", close: "18:00", closed: false };

export default function SettingsPage() {
  const { business } = useAuth();
  const [hours, setHours] = useState<WorkingHours | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchHours = useCallback(async () => {
    if (!business) return;
    try {
      const data = await api.get<WorkingHours>(
        `/businesses/${business.id}/working-hours`
      );
      setHours(data);
    } catch {
      // Use defaults
      setHours({
        monday: { ...DEFAULT_SCHEDULE },
        tuesday: { ...DEFAULT_SCHEDULE },
        wednesday: { ...DEFAULT_SCHEDULE },
        thursday: { ...DEFAULT_SCHEDULE },
        friday: { ...DEFAULT_SCHEDULE },
        saturday: { open: "09:00", close: "14:00", closed: false },
        sunday: { open: "00:00", close: "00:00", closed: true },
      });
    }
  }, [business]);

  useEffect(() => {
    fetchHours();
  }, [fetchHours]);

  const updateDay = (day: keyof WorkingHours, field: keyof DaySchedule, value: string | boolean) => {
    if (!hours) return;
    setHours({
      ...hours,
      [day]: { ...hours[day], [field]: value },
    });
  };

  const handleSave = async () => {
    if (!business || !hours) return;
    setSaving(true);
    setMessage("");
    try {
      await api.put(`/businesses/${business.id}/working-hours`, hours);
      setMessage("Working hours updated successfully");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!hours) return <p className="text-dark-400">Loading...</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-900">Settings</h1>
        <p className="text-dark-500 text-sm mt-1">Manage your working hours</p>
      </div>

      {/* Booking Link */}
      {business && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold text-dark-900">Your Booking Link</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-dark-500 mb-2">
              Share this link with your customers so they can book online:
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 px-3 py-2 bg-dark-50 rounded-lg text-sm text-primary-600 font-mono">
                {typeof window !== "undefined" ? window.location.origin : ""}/book/{business.slug}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/book/${business.slug}`
                  );
                  setMessage("Link copied!");
                  setTimeout(() => setMessage(""), 2000);
                }}
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Working Hours */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-dark-900">Working Hours</h2>
        </CardHeader>
        <CardContent>
          {message && (
            <div
              className={`mb-4 p-3 text-sm rounded-lg ${
                message.includes("success") || message.includes("copied")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}

          <div className="space-y-4">
            {DAYS.map((day) => (
              <div
                key={day}
                className="flex flex-col sm:flex-row sm:items-center gap-3 py-2"
              >
                <div className="w-28">
                  <span className="text-sm font-medium text-dark-700 capitalize">
                    {day}
                  </span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hours[day].closed}
                    onChange={(e) => updateDay(day, "closed", !e.target.checked)}
                    className="rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-600">Open</span>
                </label>

                {!hours[day].closed && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={hours[day].open}
                      onChange={(e) => updateDay(day, "open", e.target.value)}
                      className="px-2 py-1 border border-dark-200 rounded text-sm"
                    />
                    <span className="text-dark-400">to</span>
                    <input
                      type="time"
                      value={hours[day].close}
                      onChange={(e) => updateDay(day, "close", e.target.value)}
                      className="px-2 py-1 border border-dark-200 rounded text-sm"
                    />
                  </div>
                )}

                {hours[day].closed && (
                  <span className="text-sm text-dark-400">Closed</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              Save Working Hours
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
