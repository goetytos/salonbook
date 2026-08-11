"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { Service } from "@/types";

export default function ServicesPage() {
  const { business } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", price: "", duration_minutes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchServices = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setPageError("");
    try {
      setServices(await api.get<Service[]>(`/businesses/${business.id}/services`));
    } catch (requestError) {
      setServices([]);
      setPageError(requestError instanceof Error ? requestError.message : "Services could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => { void fetchServices(); }, [fetchServices]);

  const openCreate = () => {
    setEditingService(null);
    setForm({ name: "", price: "", duration_minutes: "" });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setForm({ name: service.name, price: String(service.price), duration_minutes: String(service.duration_minutes) });
    setError("");
    setModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!business) return;
    setError("");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      price: Number.parseFloat(form.price),
      duration_minutes: Number.parseInt(form.duration_minutes, 10),
    };

    try {
      if (editingService) await api.put(`/businesses/${business.id}/services/${editingService.id}`, payload);
      else await api.post(`/businesses/${business.id}/services`, payload);
      setModalOpen(false);
      await fetchServices();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The service could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!business || !window.confirm("Delete this service? This cannot be undone.")) return;
    setPageError("");
    try {
      await api.delete(`/businesses/${business.id}/services/${serviceId}`);
      await fetchServices();
    } catch (requestError) {
      setPageError(requestError instanceof Error ? requestError.message : "The service could not be deleted.");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Service menu"
        description="Keep prices and appointment lengths clear so customers know exactly what they are booking."
        actions={<Button onClick={openCreate}>Add service</Button>}
      />

      {loading ? (
        <DashboardState type="loading" title="Loading services" />
      ) : pageError ? (
        <DashboardState type="error" title="Services unavailable" description={pageError} onRetry={fetchServices} />
      ) : services.length === 0 ? (
        <Card><CardContent><EmptyState title="Build your service menu" description="Add the first service customers can choose when they book." actionLabel="Add service" onAction={openCreate} /></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {services.map((service, index) => (
            <Card key={service.id} className="overflow-hidden">
              <CardContent className="flex h-full flex-col py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-primary-600">{String(index + 1).padStart(2, "0")}</p>
                    <h2 className="mt-3 truncate text-lg font-semibold text-dark-900">{service.name}</h2>
                    <p className="mt-2 text-sm text-dark-500">{service.duration_minutes} minutes</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold tabular-nums text-primary-700">KES {Number(service.price).toLocaleString()}</p>
                </div>
                <div className="mt-6 flex gap-2 border-t border-dark-200 pt-4 md:mt-auto">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(service)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(service.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingService ? "Edit service" : "Add service"}>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Service name" placeholder="e.g. Haircut" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <Input label="Price (KES)" type="number" placeholder="500" min="0" step="50" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
          <Input label="Duration (minutes)" type="number" placeholder="30" min="1" max="480" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} required />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingService ? "Save changes" : "Create service"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
