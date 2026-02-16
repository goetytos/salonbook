"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Service, TimeSlot } from "@/types";

type Step = "service" | "datetime" | "details" | "confirmed";

interface BusinessPublic {
  id: string;
  name: string;
  slug: string;
  phone: string;
  location: string;
}

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<BusinessPublic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  // Fetch business info + services
  useEffect(() => {
    async function load() {
      try {
        // Use a server-side approach: fetch from our own API
        const res = await fetch(`/api/bookings/business?slug=${slug}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setBusiness(data.business);
        setServices(data.services);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  // Fetch available slots when date changes
  const fetchSlots = useCallback(async () => {
    if (!business || !selectedDate || !selectedService) return;
    setSlotsLoading(true);
    setSelectedTime("");
    try {
      const res = await fetch(
        `/api/businesses/${business.id}/slots?date=${selectedDate}&duration=${selectedService.duration_minutes}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setSlots(data);
      } else {
        setSlots([]);
      }
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [business, selectedDate, selectedService]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleSubmit = async () => {
    if (!business || !selectedService) return;
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_slug: slug,
          service_id: selectedService.id,
          date: selectedDate,
          time: selectedTime,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Booking failed");
      }

      setStep("confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Today's date for min attribute
  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-dark-900 mb-2">Business not found</h1>
          <p className="text-dark-500">This booking page doesn&apos;t exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-50">
      {/* Header */}
      <div className="bg-white border-b border-dark-100">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">
                {business?.name.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark-900">{business?.name}</h1>
              <p className="text-sm text-dark-500">{business?.location}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress Indicator */}
        {step !== "confirmed" && (
          <div className="flex items-center gap-2 mb-8">
            {(["service", "datetime", "details"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? "bg-primary-600 text-white"
                      : ["service", "datetime", "details"].indexOf(step) > i
                      ? "bg-primary-100 text-primary-700"
                      : "bg-dark-100 text-dark-400"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div
                    className={`w-12 h-0.5 ${
                      ["service", "datetime", "details"].indexOf(step) > i
                        ? "bg-primary-300"
                        : "bg-dark-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Step 1: Select Service */}
        {step === "service" && (
          <div>
            <h2 className="text-xl font-bold text-dark-900 mb-1">Select a service</h2>
            <p className="text-dark-500 text-sm mb-6">Choose the service you&apos;d like to book</p>

            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    setSelectedService(service);
                    setStep("datetime");
                  }}
                  className="w-full text-left bg-white rounded-xl border border-dark-200 p-4 hover:border-primary-300 hover:shadow-sm transition group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-dark-900 group-hover:text-primary-700 transition">
                        {service.name}
                      </h3>
                      <p className="text-sm text-dark-500 mt-0.5">
                        {service.duration_minutes} minutes
                      </p>
                    </div>
                    <span className="text-lg font-bold text-primary-600">
                      KES {Number(service.price).toLocaleString()}
                    </span>
                  </div>
                </button>
              ))}

              {services.length === 0 && (
                <div className="text-center py-8 text-dark-500">
                  No services available at the moment.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === "datetime" && selectedService && (
          <div>
            <button
              onClick={() => setStep("service")}
              className="text-sm text-primary-600 hover:text-primary-700 mb-4 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <h2 className="text-xl font-bold text-dark-900 mb-1">Pick a date & time</h2>
            <p className="text-dark-500 text-sm mb-6">
              {selectedService.name} &middot; {selectedService.duration_minutes} min &middot; KES{" "}
              {Number(selectedService.price).toLocaleString()}
            </p>

            {/* Date Picker */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-dark-700 mb-2">
                Date
              </label>
              <input
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-dark-200 rounded-lg text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-2">
                  Available Times
                </label>
                {slotsLoading ? (
                  <p className="text-dark-400 text-sm">Loading available times...</p>
                ) : slots.length === 0 ? (
                  <p className="text-dark-500 text-sm">
                    No available times on this date. Try another day.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots
                      .filter((s) => s.available)
                      .map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`py-2 px-3 rounded-lg text-sm font-medium border transition ${
                            selectedTime === slot.time
                              ? "bg-primary-600 text-white border-primary-600"
                              : "bg-white text-dark-700 border-dark-200 hover:border-primary-300"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                  </div>
                )}

                {slots.length > 0 && slots.every((s) => !s.available) && (
                  <p className="text-dark-500 text-sm mt-2">
                    All times are booked on this date. Try another day.
                  </p>
                )}
              </div>
            )}

            {selectedTime && (
              <div className="mt-6">
                <button
                  onClick={() => setStep("details")}
                  className="w-full py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Customer Details */}
        {step === "details" && selectedService && (
          <div>
            <button
              onClick={() => setStep("datetime")}
              className="text-sm text-primary-600 hover:text-primary-700 mb-4 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <h2 className="text-xl font-bold text-dark-900 mb-1">Your details</h2>
            <p className="text-dark-500 text-sm mb-6">
              Almost done! Enter your name and phone number.
            </p>

            {/* Booking Summary */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-medium text-primary-800 mb-2">Booking Summary</h3>
              <div className="space-y-1 text-sm text-primary-700">
                <p>{selectedService.name}</p>
                <p>
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-KE", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at {selectedTime}
                </p>
                <p className="font-semibold">
                  KES {Number(selectedService.price).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Wanjiku"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-200 rounded-lg text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="07XXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-200 rounded-lg text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!customerName.trim() || !customerPhone.trim() || submitting}
              className="w-full mt-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Confirm Booking"
              )}
            </button>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === "confirmed" && selectedService && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-dark-900 mb-2">Booking Confirmed!</h2>
            <p className="text-dark-500 mb-6">
              Your appointment has been booked successfully.
            </p>

            <div className="bg-white border border-dark-200 rounded-xl p-6 text-left max-w-sm mx-auto mb-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-500">Service</span>
                  <span className="font-medium text-dark-900">{selectedService.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Date</span>
                  <span className="font-medium text-dark-900">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-KE", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Time</span>
                  <span className="font-medium text-dark-900">{selectedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Price</span>
                  <span className="font-medium text-primary-600">
                    KES {Number(selectedService.price).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setStep("service");
                setSelectedService(null);
                setSelectedDate("");
                setSelectedTime("");
                setCustomerName("");
                setCustomerPhone("");
                setError("");
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Book another appointment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
