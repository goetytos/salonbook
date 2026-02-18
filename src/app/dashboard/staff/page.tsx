"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { Staff, Service } from "@/types";

export default function StaffPage() {
  const { business } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("stylist");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!business) return;
    try {
      const [staffData, servicesData] = await Promise.all([
        api.get<Staff[]>(`/businesses/${business.id}/staff`),
        api.get<Service[]>(`/businesses/${business.id}/services`),
      ]);
      setStaffList(staffData);
      setServices(servicesData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingStaff(null);
    setName("");
    setEmail("");
    setPhone("");
    setRole("stylist");
    setAvatarUrl("");
    setSelectedServiceIds([]);
    setModalOpen(true);
  };

  const openEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setName(staff.name);
    setEmail(staff.email || "");
    setPhone(staff.phone || "");
    setRole(staff.role);
    setAvatarUrl(staff.avatar_url || "");
    setSelectedServiceIds(staff.service_ids || []);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!business || !name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        avatar_url: avatarUrl.trim() || undefined,
        service_ids: selectedServiceIds,
      };

      if (editingStaff) {
        await api.put(`/businesses/${business.id}/staff/${editingStaff.id}`, payload);
      } else {
        await api.post(`/businesses/${business.id}/staff`, payload);
      }
      setModalOpen(false);
      await fetchData();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    if (!business || !confirm("Deactivate this staff member?")) return;
    try {
      await api.delete(`/businesses/${business.id}/staff/${staffId}`);
      await fetchData();
    } catch {
      // silent
    }
  };

  const toggleServiceId = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const activeStaff = staffList.filter((s) => s.active);
  const inactiveStaff = staffList.filter((s) => !s.active);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Staff</h1>
          <p className="text-dark-500 text-sm mt-1">Manage your team members</p>
        </div>
        <Button onClick={openCreate}>Add Staff</Button>
      </div>

      {loading ? (
        <p className="text-dark-400">Loading...</p>
      ) : activeStaff.length === 0 && inactiveStaff.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              title="No staff members yet"
              description="Add your team members to assign them to services and bookings."
              actionLabel="Add Staff"
              onAction={openCreate}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeStaff.map((staff) => (
            <Card key={staff.id}>
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar name={staff.name} src={staff.avatar_url} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-dark-900 truncate">{staff.name}</h3>
                    <p className="text-sm text-dark-500 capitalize">{staff.role}</p>
                    {staff.phone && (
                      <p className="text-xs text-dark-400 mt-1">{staff.phone}</p>
                    )}
                    {staff.service_ids && staff.service_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {staff.service_ids.slice(0, 3).map((sid) => {
                          const svc = services.find((s) => s.id === sid);
                          return svc ? (
                            <Badge key={sid} variant="default">{svc.name}</Badge>
                          ) : null;
                        })}
                        {staff.service_ids.length > 3 && (
                          <Badge variant="default">+{staff.service_ids.length - 3}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(staff)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(staff.id)}>
                    Deactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {inactiveStaff.map((staff) => (
            <Card key={staff.id} className="opacity-60">
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar name={staff.name} src={staff.avatar_url} size="lg" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-dark-900">{staff.name}</h3>
                    <Badge variant="danger">Inactive</Badge>
                  </div>
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
        title={editingStaff ? "Edit Staff" : "Add Staff"}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Wanjiku"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXXXXXXX"
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: "stylist", label: "Stylist" },
              { value: "barber", label: "Barber" },
              { value: "manager", label: "Manager" },
              { value: "receptionist", label: "Receptionist" },
            ]}
          />
          <Input
            label="Avatar URL"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
          {services.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-dark-700">
                Assigned Services
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {services.map((service) => (
                  <label key={service.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(service.id)}
                      onChange={() => toggleServiceId(service.id)}
                      className="rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-dark-700">
                      {service.name} ({service.duration_minutes}min)
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
              {editingStaff ? "Update" : "Create"}
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
