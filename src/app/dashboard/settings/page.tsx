"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { assessBusinessReadiness } from "@/lib/business-readiness";
import Button from "@/components/ui/Button";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { DaySchedule, Service, WorkingHours } from "@/types";

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

const DEFAULT_HOURS: WorkingHours = {
  monday: { ...DEFAULT_SCHEDULE },
  tuesday: { ...DEFAULT_SCHEDULE },
  wednesday: { ...DEFAULT_SCHEDULE },
  thursday: { ...DEFAULT_SCHEDULE },
  friday: { ...DEFAULT_SCHEDULE },
  saturday: { open: "09:00", close: "14:00", closed: false },
  sunday: { open: "00:00", close: "00:00", closed: true },
};

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
  const [hoursWarning, setHoursWarning] = useState("");
  const [saving, setSaving] = useState(false);
  const [hoursMessage, setHoursMessage] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [website, setWebsite] = useState("");
  const [activeServiceCount, setActiveServiceCount] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const fetchHours = useCallback(async () => {
    if (!business) return;
    setHoursWarning("");
    try {
      const data = await api.get<WorkingHours>(`/businesses/${business.id}/working-hours`);
      setHours(data);
    } catch (requestError) {
      setHours({ ...DEFAULT_HOURS });
      setHoursWarning(requestError instanceof Error
        ? `${requestError.message} Default hours are shown below and have not been saved.`
        : "Saved working hours could not be loaded. Default hours are shown below and have not been saved.");
    }
  }, [business]);

  useEffect(() => {
    void fetchHours();
  }, [fetchHours]);

  useEffect(() => {
    if (!business) return;
    setBusinessName(business.name || "");
    setPhone(business.phone || "");
    setLocation(business.location || "");
    setDescription(business.description || "");
    setCategory(business.category || "");
    setCoverImageUrl(business.cover_image_url || "");
    setAvatarUrl(business.avatar_url || "");
    setBufferMinutes(business.buffer_minutes || 0);
    setCancellationHours(business.cancellation_hours || 24);
    setInstagram(business.social_links?.instagram || "");
    setFacebook(business.social_links?.facebook || "");
    setTiktok(business.social_links?.tiktok || "");
    setWebsite(business.social_links?.website || "");
    setBookingUrl(`${window.location.origin}/book/${business.slug}`);
  }, [business]);

  useEffect(() => {
    if (!business) return;
    api.get<Service[]>(`/businesses/${business.id}/services`)
      .then((services) => {
        setActiveServiceCount(services.filter((service) => service.active !== false).length);
      })
      .catch(() => setActiveServiceCount(0));
  }, [business]);

  const updateDay = (day: keyof WorkingHours, field: keyof DaySchedule, value: string | boolean) => {
    if (!hours) return;
    setHours({ ...hours, [day]: { ...hours[day], [field]: value } });
  };

  const handleSaveHours = async () => {
    if (!business || !hours) return;
    setSaving(true);
    setHoursMessage("");
    try {
      await api.put(`/businesses/${business.id}/working-hours`, hours);
      setHoursWarning("");
      setHoursMessage("Working hours updated successfully.");
    } catch (requestError) {
      setHoursMessage(requestError instanceof Error ? requestError.message : "Working hours could not be saved.");
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
        name: businessName,
        phone,
        location,
        description,
        category,
        cover_image_url: coverImageUrl,
        avatar_url: avatarUrl,
        buffer_minutes: bufferMinutes,
        cancellation_hours: cancellationHours,
        social_links: Object.fromEntries(
          Object.entries({ instagram, facebook, tiktok, website }).filter(
            ([, value]) => value.trim().length > 0
          )
        ),
      });
      setProfileMessage("Profile updated successfully.");
      await refresh();
    } catch (requestError) {
      setProfileMessage(requestError instanceof Error ? requestError.message : "Business profile could not be saved.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCopy = async () => {
    if (!business) return;
    const url = bookingUrl || `${window.location.origin}/book/${business.slug}`;
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("Booking link copied.");
      window.setTimeout(() => setCopyMessage(""), 2000);
    } catch {
      setCopyMessage("The link could not be copied. Select it and copy it manually.");
    }
  };

  if (!hours) return <DashboardState type="loading" title="Loading business settings" />;

  const bookingPath = business ? `/book/${business.slug}` : "";
  const readiness = assessBusinessReadiness({
    ...(business || {}),
    name: businessName,
    phone,
    location,
    description,
    category,
    working_hours: hours,
    active_service_count: activeServiceCount,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Business setup"
        title="Settings"
        description="Shape what customers see, define booking rules and keep your weekly availability accurate."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <div className="space-y-6">
          {business && (
            <Card className={readiness.ready ? "border-green-200 bg-green-50/55" : "border-amber-200 bg-amber-50/55"}>
              <CardHeader>
                <p className={`text-[0.68rem] font-bold uppercase tracking-[0.15em] ${readiness.ready ? "text-green-700" : "text-amber-800"}`}>Listing readiness</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-dark-900">
                  {readiness.ready ? "Ready for administrator review" : `${readiness.completed} of ${readiness.total} essentials complete`}
                </h2>
                <p className="mt-2 text-sm leading-6 text-dark-600">Only complete listings can be activated and shown to customers.</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {readiness.checks.map((check) => (
                    <li key={check.key} className="flex items-start gap-3 text-sm">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${check.complete ? "bg-green-700 text-white" : "border border-amber-400 bg-white text-amber-800"}`} aria-hidden="true">{check.complete ? "✓" : "!"}</span>
                      <span><strong className="text-dark-900">{check.label}</strong>{!check.complete && <span className="mt-0.5 block text-xs leading-5 text-dark-600">{check.action}</span>}</span>
                    </li>
                  ))}
                </ul>
                {!readiness.checks.find((check) => check.key === "services")?.complete && (
                  <Link href="/dashboard/services" className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-primary-700 hover:underline">Add a service <span aria-hidden="true">→</span></Link>
                )}
              </CardContent>
            </Card>
          )}

          {business && (
            <Card className="overflow-hidden border-primary-300 bg-primary-900 text-white">
              <CardContent>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-primary-200">Customer-facing link</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">Your online booking desk</h2>
                <p className="mt-2 text-sm leading-6 text-primary-100">Share this address anywhere customers discover your business.</p>
                <code className="mt-5 block overflow-x-auto rounded-xl border border-white/15 bg-white/10 px-3 py-3 font-mono text-sm text-white">
                  {bookingUrl || bookingPath}
                </code>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button size="sm" variant="secondary" onClick={() => void handleCopy()}>Copy link</Button>
                  <a
                    href={business.status === "active" ? bookingPath : `/profile/${business.slug}?preview=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-bold text-primary-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {business.status === "active" ? "Preview booking page" : "Private profile preview"} <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <p className="mt-3 min-h-5 text-xs text-primary-100" aria-live="polite">{copyMessage}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-semibold text-dark-900">Business profile</h2>
              <p className="mt-1 text-xs leading-5 text-dark-500">The details customers use to understand and recognise your studio.</p>
            </CardHeader>
            <CardContent>
              {profileMessage && (
                <Notice success={profileMessage.includes("successfully")} message={profileMessage} />
              )}
              <div className="space-y-4">
                <Input label="Business name" autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} required />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Phone number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
                  <Input label="Customer-facing location" autoComplete="street-address" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Westlands, Nairobi" required />
                </div>
                <Textarea
                  label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Tell customers what makes your business special…"
                  rows={5}
                />
                <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} options={CATEGORIES} />
                <Input label="Cover image URL" type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="https://example.com/cover.jpg" />
                <Input label="Avatar URL" type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://example.com/avatar.jpg" />
                <fieldset className="rounded-2xl border border-dark-200 p-4">
                  <legend className="px-1 text-sm font-semibold text-dark-800">Social and website links (optional)</legend>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    <Input label="Instagram URL" type="url" value={instagram} onChange={(event) => setInstagram(event.target.value)} placeholder="https://instagram.com/…" />
                    <Input label="Facebook URL" type="url" value={facebook} onChange={(event) => setFacebook(event.target.value)} placeholder="https://facebook.com/…" />
                    <Input label="TikTok URL" type="url" value={tiktok} onChange={(event) => setTiktok(event.target.value)} placeholder="https://tiktok.com/@…" />
                    <Input label="Website URL" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" />
                  </div>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Buffer minutes"
                    type="number"
                    min={0}
                    max={60}
                    value={String(bufferMinutes)}
                    onChange={(event) => setBufferMinutes(parseInt(event.target.value, 10) || 0)}
                  />
                  <Input
                    label="Cancellation notice (hours)"
                    type="number"
                    min={0}
                    max={72}
                    value={String(cancellationHours)}
                    onChange={(event) => setCancellationHours(parseInt(event.target.value, 10) || 24)}
                  />
                </div>
                <p className="text-xs leading-5 text-dark-500">Buffer time separates appointments. Cancellation notice is the minimum lead time customers need to cancel.</p>
              </div>
              <div className="mt-6 flex justify-end">
                <Button className="w-full sm:w-auto" onClick={() => void handleSaveProfile()} loading={savingProfile}>Save profile</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="font-display text-xl font-semibold text-dark-900">Working hours</h2>
            <p className="mt-1 text-xs leading-5 text-dark-500">These hours form the base availability customers see when booking.</p>
          </CardHeader>
          <CardContent>
            {hoursWarning && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="alert">
                <p className="font-semibold">Using unsaved default hours</p>
                <p className="mt-1">{hoursWarning}</p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => void fetchHours()}>Try loading again</Button>
              </div>
            )}
            {hoursMessage && <Notice success={hoursMessage.includes("successfully")} message={hoursMessage} />}

            <div className="divide-y divide-dark-200">
              {DAYS.map((day) => {
                const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                return (
                  <fieldset key={day} className="py-4 first:pt-0 last:pb-0">
                    <legend className="sr-only">{dayLabel} working hours</legend>
                    <div className="grid gap-3 sm:grid-cols-[7rem_6rem_1fr] sm:items-center">
                      <span className="font-semibold text-dark-900">{dayLabel}</span>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg focus-within:ring-2 focus-within:ring-primary-500">
                        <input
                          type="checkbox"
                          checked={!hours[day].closed}
                          onChange={(event) => updateDay(day, "closed", !event.target.checked)}
                          className="h-5 w-5 rounded border-dark-300 text-primary-600"
                        />
                        <span className="text-sm text-dark-600">Open</span>
                      </label>
                      {hours[day].closed ? (
                        <span className="inline-flex min-h-11 items-center rounded-lg bg-dark-50 px-3 text-sm text-dark-500">Closed all day</span>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <label>
                            <span className="sr-only">{dayLabel} opening time</span>
                            <input
                              type="time"
                              value={hours[day].open}
                              onChange={(event) => updateDay(day, "open", event.target.value)}
                              className="min-h-11 w-full rounded-lg border border-dark-200 bg-white px-2 text-sm text-dark-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                            />
                          </label>
                          <span className="text-xs text-dark-400">to</span>
                          <label>
                            <span className="sr-only">{dayLabel} closing time</span>
                            <input
                              type="time"
                              value={hours[day].close}
                              onChange={(event) => updateDay(day, "close", event.target.value)}
                              className="min-h-11 w-full rounded-lg border border-dark-200 bg-white px-2 text-sm text-dark-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </fieldset>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end border-t border-dark-200 pt-5">
              <Button className="w-full sm:w-auto" onClick={() => void handleSaveHours()} loading={saving}>Save working hours</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Notice({ success, message }: { success: boolean; message: string }) {
  return (
    <div
      className={`mb-4 rounded-xl border p-3 text-sm ${success ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}
      role={success ? "status" : "alert"}
      aria-live="polite"
    >
      {message}
    </div>
  );
}
