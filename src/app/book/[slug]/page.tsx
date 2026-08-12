"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BrandMark from "@/components/brand/BrandMark";
import BookingSummaryCard from "@/components/booking/BookingSummaryCard";
import StaffPicker from "@/components/booking/StaffPicker";
import TimeSlotGrid from "@/components/booking/TimeSlotGrid";
import DashboardState from "@/components/dashboard/DashboardState";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { getNairobiDateTime } from "@/lib/validation";
import type { Booking, Service, Staff, TimeSlot } from "@/types";

type Step = "service" | "staff" | "datetime" | "details" | "confirmed";

interface BusinessPublic {
  id: string;
  name: string;
  slug: string;
  phone: string;
  location: string;
  avatar_url?: string;
}

const STEP_LABELS: Record<Exclude<Step, "confirmed">, string> = {
  service: "Service",
  staff: "Stylist",
  datetime: "Date & time",
  details: "Your details",
};

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [business, setBusiness] = useState<BusinessPublic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; value: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState("");
  const [staffRetry, setStaffRetry] = useState(0);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const loadBookingPage = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNotFound(false);
    try {
      const response = await fetch(`/api/bookings/business?slug=${slug}`);
      if (response.status === 404) {
        setNotFound(true);
        setBusiness(null);
        return;
      }
      if (!response.ok) throw new Error("This booking page could not be loaded.");
      const data = await response.json();
      setBusiness(data.business);
      setServices(Array.isArray(data.services) ? data.services : []);
    } catch (requestError) {
      setBusiness(null);
      setLoadError(requestError instanceof Error ? requestError.message : "This booking page could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBookingPage();
  }, [loadBookingPage]);

  // Keep the stylist step pending until the service-specific request settles.
  useEffect(() => {
    if (!business || !selectedService) return;
    const controller = new AbortController();
    setStaffLoading(true);
    setStaffLoadError("");
    setStaff([]);

    fetch(`/api/businesses/${business.id}/staff`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Staff could not be loaded");
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const serviceStaff = data.filter((staffMember: Staff) => staffMember.active && staffMember.service_ids?.includes(selectedService.id));
          setStaff(serviceStaff);
        }
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setStaff([]);
        setStaffLoadError("We couldn’t load the available stylists. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setStaffLoading(false);
      });

    return () => controller.abort();
  }, [business, selectedService, staffRetry]);

  const fetchSlots = useCallback(async () => {
    if (!business || !selectedDate || !selectedService) {
      setSlots([]);
      setSlotsError("");
      setSelectedTime("");
      return;
    }
    setSlotsLoading(true);
    setSlotsError("");
    setSelectedTime("");
    try {
      const searchParams = new URLSearchParams({
        date: selectedDate,
        duration: String(selectedService.duration_minutes),
        service_id: selectedService.id,
      });
      if (selectedStaffId) searchParams.set("staff_id", selectedStaffId);
      const response = await fetch(`/api/businesses/${business.id}/slots?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Available times could not be loaded.");
      const data = await response.json();
      setSlots(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setSlots([]);
      setSlotsError(requestError instanceof Error ? requestError.message : "Available times could not be loaded.");
    } finally {
      setSlotsLoading(false);
    }
  }, [business, selectedDate, selectedService, selectedStaffId]);

  useEffect(() => {
    void fetchSlots();
  }, [fetchSlots]);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedStaffId("");
    setStaff([]);
    setStaffLoadError("");
    setStaffLoading(true);
    setStep("staff");
  };

  const handleSubmit = async () => {
    if (!business || !selectedService) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_slug: slug,
          service_id: selectedService.id,
          date: selectedDate,
          time: selectedTime,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          staff_id: selectedStaffId || undefined,
          notes: notes.trim() || undefined,
          promotion_code: promoCode.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Booking failed");
      }
      const createdBooking = await response.json() as Booking;
      setConfirmedBooking(createdBooking);
      setStep("confirmed");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The appointment could not be booked.");
    } finally {
      setSubmitting(false);
    }
  };

  const validatePromo = async () => {
    if (!promoCode.trim() || !business || !selectedService || !selectedDate) {
      return;
    }
    setPromoError("");
    setPromoLoading(true);
    try {
      const response = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: business.id,
          code: promoCode.trim(),
          booking_date: selectedDate,
          service_id: selectedService.id,
        }),
      });
      if (!response.ok) {
        setPromoDiscount(null);
        setPromoError("This promotion code is invalid or has expired.");
        return;
      }
      const data = await response.json();
      setPromoDiscount({ type: data.discount_type, value: data.discount_value });
    } catch {
      setPromoDiscount(null);
      setPromoError("The promotion code could not be checked.");
    } finally {
      setPromoLoading(false);
    }
  };

  const getDiscountedPrice = () => {
    if (!selectedService || !promoDiscount) return undefined;
    const price = Number(selectedService.price);
    return promoDiscount.type === "percentage"
      ? Math.max(0, price - price * (promoDiscount.value / 100))
      : Math.max(0, price - promoDiscount.value);
  };

  const today = getNairobiDateTime().date;
  const allSteps: Step[] = staffLoading || staff.length > 0 || step === "staff"
    ? ["service", "staff", "datetime", "details"]
    : ["service", "datetime", "details"];
  const currentStepIndex = allSteps.indexOf(step);

  const goBack = () => {
    if (currentStepIndex > 0) setStep(allSteps[currentStepIndex - 1]);
  };

  // Only skip stylist selection after the delayed request succeeds with no eligible staff.
  useEffect(() => {
    if (step === "staff" && !staffLoading && !staffLoadError && staff.length === 0 && selectedService) {
      setStep("datetime");
    }
  }, [step, staff, staffLoading, staffLoadError, selectedService]);

  if (loading) {
    return <main id="main-content" className="mx-auto min-h-dvh max-w-3xl bg-canvas px-4 py-16"><DashboardState type="loading" title="Loading booking page" /></main>;
  }

  if (notFound) {
    return (
      <main id="main-content" className="studio-grid flex min-h-dvh items-center justify-center bg-canvas px-4 py-16">
        <div className="max-w-xl rounded-[1.4rem] border border-dark-200 bg-surface p-8 text-center shadow-[0_20px_60px_rgba(28,37,31,0.08)]">
          <BrandMark className="justify-center" />
          <h1 className="mt-7 font-display text-4xl font-semibold tracking-[-0.04em] text-dark-900">This booking page isn’t available.</h1>
          <p className="mt-4 text-sm leading-6 text-dark-500">The studio may have moved its profile or paused online bookings.</p>
          <Link href="/explore" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-900 px-4 text-sm font-bold text-white hover:bg-primary-700">Browse other studios</Link>
        </div>
      </main>
    );
  }

  if (loadError || !business) {
    return <main id="main-content" className="mx-auto min-h-dvh max-w-3xl bg-canvas px-4 py-16"><DashboardState type="error" title="Booking page unavailable" description={loadError || "No business details were returned."} onRetry={() => void loadBookingPage()} /></main>;
  }

  const selectedStaffMember = staff.find((staffMember) => staffMember.id === selectedStaffId);
  const activeServices = services.filter((service) => service.active !== false);

  const resetBooking = () => {
    setStep("service");
    setSelectedService(null);
    setSelectedStaffId("");
    setSelectedDate("");
    setSlots([]);
    setSelectedTime("");
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setPromoCode("");
    setPromoDiscount(null);
    setPromoError("");
    setError("");
    setConfirmedBooking(null);
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="studio-grain bg-primary-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between gap-4" aria-label="Booking page navigation">
            <Link href="/" aria-label="SalonBook home" className="rounded-lg"><BrandMark inverse /></Link>
            <Link href={`/profile/${slug}`} className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3 text-sm font-bold text-primary-100 hover:bg-white/10 hover:text-white">View studio profile</Link>
          </nav>
          <div className="mt-9 max-w-2xl pb-5">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-accent-300">Book with {business.name}</p>
            <h1 className="mt-3 text-balance font-display text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Choose the appointment that fits your day.</h1>
            <p className="mt-3 text-sm text-primary-100">{business.location}</p>
          </div>
        </div>
      </header>

      <main id="main-content" className="studio-grid">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:px-8">
          <div className="min-w-0">
            {step !== "confirmed" && (
              <nav className="mb-5 overflow-x-auto rounded-2xl border border-dark-200 bg-surface px-3 py-3" aria-label="Booking progress">
                <ol className="flex min-w-max items-center">
                  {allSteps.filter((item): item is Exclude<Step, "confirmed"> => item !== "confirmed").map((item, index) => (
                    <li key={item} aria-current={step === item ? "step" : undefined} className="flex items-center">
                      <span className="flex items-center gap-2">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-extrabold ${step === item ? "bg-primary-900 text-white" : currentStepIndex > index ? "bg-primary-100 text-primary-800" : "bg-dark-100 text-dark-500"}`}>
                          {currentStepIndex > index ? <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 10 4 4 8-8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : index + 1}
                        </span>
                        <span className={`text-xs font-bold ${step === item ? "text-primary-800" : "text-dark-500"}`}>{STEP_LABELS[item]}</span>
                      </span>
                      {index < allSteps.length - 1 && <span className={`mx-3 h-px w-8 sm:w-12 ${currentStepIndex > index ? "bg-primary-400" : "bg-dark-200"}`} aria-hidden="true" />}
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            {error && <div className="mb-5"><DashboardState type="error" title="The appointment was not booked" description={error} /></div>}

            <div className="rounded-[1.35rem] border border-dark-200 bg-surface p-5 shadow-[0_20px_60px_rgba(28,37,31,0.07)] sm:p-7">
              {step === "service" && (
                <section aria-labelledby="service-step-title">
                  <StepHeading eyebrow="Step one" title="Select a service" description="Choose what you would like to book." id="service-step-title" />
                  {activeServices.length === 0 ? (
                    <DashboardState title="No services available" description="This studio has not opened any services for online booking yet." />
                  ) : (
                    <div className="grid gap-3">
                      {activeServices.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => handleServiceSelect(service)}
                          className="group grid min-h-20 w-full gap-3 rounded-2xl border border-dark-200 bg-surface p-4 text-left transition duration-200 hover:border-primary-400 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <span><span className="block font-display text-xl font-semibold text-dark-900 group-hover:text-primary-800">{service.name}</span><span className="mt-1 block text-sm text-dark-500">{service.duration_minutes} minutes{service.description ? ` · ${service.description}` : ""}</span></span>
                          <span className="font-bold tabular-nums text-primary-700">KES {Number(service.price).toLocaleString()} <span aria-hidden="true">→</span></span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {step === "staff" && selectedService && (
                <section aria-labelledby="staff-step-title">
                  <BackButton onClick={goBack} />
                  <StepHeading eyebrow="Step two" title="Choose a stylist" description={`${selectedService.name} · ${selectedService.duration_minutes} minutes`} id="staff-step-title" />
                  {staffLoading ? (
                    <div className="space-y-3" role="status" aria-label="Loading available stylists"><div className="h-20 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" /><div className="h-20 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" /><span className="sr-only">Loading available stylists</span></div>
                  ) : staffLoadError ? (
                    <DashboardState type="error" title="Stylists unavailable" description={staffLoadError} onRetry={() => setStaffRetry((attempt) => attempt + 1)} />
                  ) : staff.length > 0 ? (
                    <StaffPicker staff={staff} selectedId={selectedStaffId} onChange={(id) => { setSelectedStaffId(id); setStep("datetime"); }} />
                  ) : (
                    <DashboardState type="loading" title="Opening available times" />
                  )}
                </section>
              )}

              {step === "datetime" && selectedService && (
                <section aria-labelledby="datetime-step-title">
                  <BackButton onClick={goBack} />
                  <StepHeading eyebrow="Choose a time" title="Pick a date and time" description={`${selectedService.name} · ${selectedService.duration_minutes} minutes · KES ${Number(selectedService.price).toLocaleString()}${selectedStaffMember ? ` · ${selectedStaffMember.name}` : ""}`} id="datetime-step-title" />
                  <Input
                    label="Appointment date"
                    type="date"
                    min={today}
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  />

                  {selectedDate && (
                    <div className="mt-6 border-t border-dark-200 pt-5">
                      <h3 className="mb-4 text-sm font-semibold text-dark-800">Available times</h3>
                      {slotsLoading ? (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="status" aria-label="Loading available times">{Array.from({ length: 8 }, (_, index) => <span key={index} className="h-11 animate-pulse rounded-lg bg-dark-100 motion-reduce:animate-none" />)}<span className="sr-only">Loading available times</span></div>
                      ) : slotsError ? (
                        <DashboardState type="error" title="Times unavailable" description={slotsError} onRetry={() => void fetchSlots()} />
                      ) : (
                        <TimeSlotGrid slots={slots} selectedTime={selectedTime} onSelect={setSelectedTime} />
                      )}
                    </div>
                  )}

                  {selectedDate && selectedTime && <div className="mt-6 flex justify-end"><Button className="w-full sm:w-auto" onClick={() => setStep("details")}>Continue to details</Button></div>}
                </section>
              )}

              {step === "details" && selectedService && (
                <section aria-labelledby="details-step-title">
                  <BackButton onClick={goBack} />
                  <StepHeading eyebrow="Final step" title="Add your details" description="We’ll use these details to confirm the appointment." id="details-step-title" />
                  <BookingSummaryCard serviceName={selectedService.name} date={selectedDate} time={selectedTime} price={Number(selectedService.price)} staffName={selectedStaffMember?.name} discountedPrice={getDiscountedPrice()} />

                  <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }} aria-busy={submitting || undefined}>
                    <Input label="Your name" autoComplete="name" placeholder="e.g. Akinyi Wambui" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required autoFocus />
                    <Input label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="07XXXXXXXX" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required />
                    <Textarea label="Notes (optional)" placeholder="Style preferences or arrival details" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
                    <p className="-mt-2 text-xs leading-5 text-dark-500">Please do not include health, identity-document or payment information.</p>

                    <div className="rounded-2xl border border-dark-200 bg-dark-50/55 p-4">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <Input
                          label="Promotion code (optional)"
                          autoComplete="off"
                          placeholder="Enter code"
                          value={promoCode}
                          error={promoError || undefined}
                          onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setPromoDiscount(null); setPromoError(""); }}
                        />
                        <Button type="button" variant="secondary" loading={promoLoading} disabled={!promoCode.trim()} onClick={() => void validatePromo()}>Apply code</Button>
                      </div>
                      {promoDiscount && <p className="mt-2 text-sm font-semibold text-green-700" role="status">{promoDiscount.type === "percentage" ? `${promoDiscount.value}% off` : `KES ${promoDiscount.value} off`} applied.</p>}
                    </div>

                    <Button type="submit" loading={submitting} disabled={!customerName.trim() || !customerPhone.trim()} className="w-full" size="lg">Confirm appointment</Button>
                    <p className="text-xs leading-5 text-dark-500">By confirming, you acknowledge the <Link href="/privacy" className="font-semibold text-primary-700 hover:underline">Privacy Notice</Link> and agree to the <Link href="/terms" className="font-semibold text-primary-700 hover:underline">Booking Terms</Link>.</p>
                  </form>
                </section>
              )}

              {step === "confirmed" && selectedService && (
                <section className="py-3 text-center" aria-labelledby="confirmation-title" aria-live="polite">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-700" aria-hidden="true"><svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span>
                  <p className="mt-5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-green-700">Appointment confirmed</p>
                  <h2 id="confirmation-title" className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-dark-900">Your time is reserved.</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-dark-500">The appointment is saved in the studio calendar. Keep this reference and contact the studio directly if anything changes.</p>
                  {confirmedBooking && <p className="mx-auto mt-4 w-fit rounded-lg bg-dark-50 px-3 py-2 font-mono text-sm font-bold tracking-[0.08em] text-dark-800">Reference {confirmedBooking.id.slice(-8).toUpperCase()}</p>}
                  <div className="mx-auto mt-6 max-w-lg text-left"><BookingSummaryCard serviceName={selectedService.name} date={selectedDate} time={selectedTime} price={Number(selectedService.price)} staffName={selectedStaffMember?.name} discountedPrice={getDiscountedPrice()} /></div>
                  <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
                    <Button onClick={resetBooking}>Book another appointment</Button>
                    <Link href={`/profile/${slug}`} className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-bold text-primary-700 hover:bg-primary-50">Return to studio profile</Link>
                  </div>
                  <p className="mt-5 text-sm text-dark-500">Need to cancel or change the time? Call <a href={`tel:${business.phone}`} className="font-bold text-primary-700 hover:underline">{business.phone}</a>. Online rescheduling is not available yet.</p>
                </section>
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-dark-200 bg-surface p-5 lg:sticky lg:top-6" aria-label="Studio contact">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-900 font-display text-xl font-semibold text-white" aria-hidden="true">{business.name.charAt(0)}</div>
            <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-primary-700">Booking with</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-dark-900">{business.name}</h2>
            <p className="mt-2 text-sm leading-6 text-dark-500">{business.location}</p>
            <a href={`tel:${business.phone}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-primary-700 hover:underline">{business.phone}</a>
            {selectedService && (
              <dl className="mt-5 space-y-3 border-t border-dark-200 pt-5 text-sm">
                <div><dt className="text-xs text-dark-500">Selected service</dt><dd className="mt-1 font-semibold text-dark-900">{selectedService.name}</dd></div>
                {selectedDate && <div><dt className="text-xs text-dark-500">Date</dt><dd className="mt-1 font-semibold text-dark-900">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-KE", { month: "long", day: "numeric" })}</dd></div>}
                {selectedTime && <div><dt className="text-xs text-dark-500">Time</dt><dd className="mt-1 font-mono font-semibold tabular-nums text-dark-900">{selectedTime}</dd></div>}
              </dl>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function StepHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description: string; id: string }) {
  return (
    <header className="mb-6">
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.15em] text-primary-700">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-dark-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-dark-500">{description}</p>
    </header>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-5 inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-primary-700 hover:bg-primary-50 hover:underline">
      <span aria-hidden="true">←</span>&nbsp; Back
    </button>
  );
}
