"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import type { Service } from "@/types";

export default function ServicesPage() {
  const { business } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", price: "", duration_minutes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchServices = useCallback(async () => {
    if (!business) return;
    try {
      const data = await api.get<Service[]>(`/businesses/${business.id}/services`);
      setServices(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const openCreate = () => {
    setEditingService(null);
    setForm({ name: "", price: "", duration_minutes: "" });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      price: String(service.price),
      duration_minutes: String(service.duration_minutes),
    });
    setError("");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setError("");
    setSaving(true);

    const payload = {
      name: form.name,
      price: parseFloat(form.price),
      duration_minutes: parseInt(form.duration_minutes, 10),
    };

    try {
      if (editingService) {
        await api.put(
          `/businesses/${business.id}/services/${editingService.id}`,
          payload
        );
      } else {
        await api.post(`/businesses/${business.id}/services`, payload);
      }
      setModalOpen(false);
      await fetchServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!business || !confirm("Delete this service? This cannot be undone.")) return;
    try {
      await api.delete(`/businesses/${business.id}/services/${serviceId}`);
      await fetchServices();
    } catch {
      // silent
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Services</h1>
          <p className="text-dark-500 text-sm mt-1">Manage your service menu</p>
        </div>
        <Button onClick={openCreate}>Add Service</Button>
      </div>

      {loading ? (
        <p className="text-dark-400">Loading...</p>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-dark-500">No services yet. Add your first service to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-dark-900">{service.name}</h3>
                    <p className="text-sm text-dark-500 mt-1">
                      {service.duration_minutes} min
                    </p>
                  </div>
                  <p className="text-lg font-bold text-primary-600">
                    KES {Number(service.price).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(service)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(service.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? "Edit Service" : "Add Service"}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Service Name"
            placeholder="e.g. Haircut"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Price (KES)"
            type="number"
            placeholder="500"
            min="0"
            step="50"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <Input
            label="Duration (minutes)"
            type="number"
            placeholder="30"
            min="1"
            max="480"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            required
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} className="flex-1">
              {editingService ? "Update" : "Create"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
