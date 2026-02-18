"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import type { WorkingHours, DaySchedule } from "@/types";

const DAYS: (keyof WorkingHours)[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

const DEFAULT_SCHEDULE: DaySchedule = { open: "09:00", close: "18:00", closed: false };

const CATEGORIES = [
  { value: "", label: "Select category" },
  { value: "hair-salon", label: "Hair Salon" },
  { value: "barbershop", label: "Barbershop" },
  { value: "nail-salon", label: "Nail Salon" },
  { value: "spa", label: "Spa & Wellness" },
  { value: "beauty-salon", label: "Beauty Salon" },
  { value: "braids", label: "Braids & Locks" },
  { value: "makeup", label: "Makeup Studio" },
  { value: "other", label: "Other" },
];

export default function SettingsPage() {
  const { business, refresh } = useAuth();
  const [hours, setHours] = useState<WorkingHours | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Profile fields
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const fetchHours = useCallback(async () => {
    if (!business) return;
    try {
      const data = await api.get<WorkingHours>(
        `/businesses/${business.id}/working-hours`
      );
      setHours(data);
    } catch {
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

  useEffect(() => {
    if (!business) return;
    setDescription(business.description || "");
    setCategory(business.category || "");
    setCoverImageUrl(business.cover_image_url || "");
    setAvatarUrl(business.avatar_url || "");
    setBufferMinutes(business.buffer_minutes || 0);
    setCancellationHours(business.cancellation_hours || 24);
  }, [business]);

  const updateDay = (day: keyof WorkingHours, field: keyof DaySchedule, value: string | boolean) => {
    if (!hours) return;
    setHours({ ...hours, [day]: { ...hours[day], [field]: value } });
  };

  const handleSaveHours = async () => {
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

  const handleSaveProfile = async () => {
    if (!business) return;
    setSavingProfile(true);
    setProfileMessage("");
    try {
      await api.put(`/businesses/${business.id}/profile`, {
        description,
        category,
        cover_image_url: coverImageUrl,
        avatar_url: avatarUrl,
        buffer_minutes: bufferMinutes,
        cancellation_hours: cancellationHours,
      });
      setProfileMessage("Profile updated successfully");
      await refresh();
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingProfile(false);
    }
  };

  if (!hours) return <p className="text-dark-400">Loading...</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-900">Settings</h1>
        <p className="text-dark-500 text-sm mt-1">Manage your business profile and working hours</p>
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

      {/* Business Profile */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-semibold text-dark-900">Business Profile</h2>
        </CardHeader>
        <CardContent>
          {profileMessage && (
            <div
              className={`mb-4 p-3 text-sm rounded-lg ${
                profileMessage.includes("success")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {profileMessage}
            </div>
          )}
          <div className="space-y-4">
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers about your business..."
            />
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={CATEGORIES}
            />
            <Input
              label="Cover Image URL"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://example.com/cover.jpg"
            />
            <Input
              label="Avatar URL"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Buffer Minutes"
                type="number"
                min={0}
                max={60}
                value={String(bufferMinutes)}
                onChange={(e) => setBufferMinutes(parseInt(e.target.value) || 0)}
              />
              <Input
                label="Cancellation Hours"
                type="number"
                min={0}
                max={72}
                value={String(cancellationHours)}
                onChange={(e) => setCancellationHours(parseInt(e.target.value) || 24)}
              />
            </div>
            <p className="text-xs text-dark-400">
              Buffer time is added between appointments. Cancellation hours is the minimum notice required.
            </p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveProfile} loading={savingProfile}>
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

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
              <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 py-2">
                <div className="w-28">
                  <span className="text-sm font-medium text-dark-700 capitalize">{day}</span>
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
                {hours[day].closed && <span className="text-sm text-dark-400">Closed</span>}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveHours} loading={saving}>
              Save Working Hours
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
