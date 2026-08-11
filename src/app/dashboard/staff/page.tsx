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
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { Staff, Service } from "@/types";

export default function StaffPage() {
  const { business } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("stylist");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchData = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setPageError("");
    try {
      const [staffData, servicesData] = await Promise.all([
        api.get<Staff[]>(`/businesses/${business.id}/staff`),
        api.get<Service[]>(`/businesses/${business.id}/services`),
      ]);
      setStaffList(staffData);
      setServices(servicesData);
    } catch (requestError) {
      setStaffList([]);
      setPageError(requestError instanceof Error ? requestError.message : "Team data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditingStaff(null); setName(""); setEmail(""); setPhone(""); setRole("stylist"); setAvatarUrl(""); setSelectedServiceIds([]); setFormError(""); setModalOpen(true);
  };

  const openEdit = (staff: Staff) => {
    setEditingStaff(staff); setName(staff.name); setEmail(staff.email || ""); setPhone(staff.phone || ""); setRole(staff.role); setAvatarUrl(staff.avatar_url || ""); setSelectedServiceIds(staff.service_ids || []); setFormError(""); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!business || !name.trim()) return;
    setSaving(true);
    setFormError("");
    const payload = { name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, role, avatar_url: avatarUrl.trim() || undefined, service_ids: selectedServiceIds };
    try {
      if (editingStaff) await api.put(`/businesses/${business.id}/staff/${editingStaff.id}`, payload);
      else await api.post(`/businesses/${business.id}/staff`, payload);
      setModalOpen(false);
      await fetchData();
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "The team member could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    if (!business || !window.confirm("Deactivate this staff member?")) return;
    setPageError("");
    try {
      await api.delete(`/businesses/${business.id}/staff/${staffId}`);
      await fetchData();
    } catch (requestError) {
      setPageError(requestError instanceof Error ? requestError.message : "The team member could not be deactivated.");
    }
  };

  const toggleServiceId = (id: string) => setSelectedServiceIds((current) => current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id]);
  const activeStaff = staffList.filter((staff) => staff.active);
  const inactiveStaff = staffList.filter((staff) => !staff.active);

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Team" description="Assign staff to the services they perform and keep the booking experience accurate." actions={<Button onClick={openCreate}>Add team member</Button>} />

      {loading ? (
        <DashboardState type="loading" title="Loading team" />
      ) : pageError ? (
        <DashboardState type="error" title="Team unavailable" description={pageError} onRetry={fetchData} />
      ) : staffList.length === 0 ? (
        <Card><CardContent><EmptyState title="No team members yet" description="Add the people customers can choose when booking a service." actionLabel="Add team member" onAction={openCreate} /></CardContent></Card>
      ) : (
        <>
          <section aria-labelledby="active-team-heading">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="active-team-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-dark-600">Active team</h2>
              <span className="font-mono text-sm text-dark-500">{activeStaff.length}</span>
            </div>
            {activeStaff.length === 0 ? (
              <DashboardState title="No active staff" description="Add a team member to make stylist selection available to customers." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {activeStaff.map((staff) => (
                  <Card key={staff.id}>
                    <CardContent className="py-5">
                      <div className="flex items-start gap-4">
                        <Avatar name={staff.name} src={staff.avatar_url} size="lg" />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-lg font-semibold text-dark-900">{staff.name}</h3>
                          <p className="mt-1 text-sm capitalize text-dark-500">{staff.role}</p>
                          {staff.phone && <p className="mt-2 text-xs text-dark-500">{staff.phone}</p>}
                        </div>
                      </div>
                      {staff.service_ids && staff.service_ids.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-dark-200 pt-4">
                          {staff.service_ids.slice(0, 3).map((serviceId) => {
                            const service = services.find((item) => item.id === serviceId);
                            return service ? <Badge key={serviceId}>{service.name}</Badge> : null;
                          })}
                          {staff.service_ids.length > 3 && <Badge>+{staff.service_ids.length - 3}</Badge>}
                        </div>
                      )}
                      <div className="mt-5 flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(staff)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(staff.id)}>Deactivate</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {inactiveStaff.length > 0 && (
            <section className="mt-10" aria-labelledby="inactive-team-heading">
              <h2 id="inactive-team-heading" className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-dark-500">Inactive</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {inactiveStaff.map((staff) => (
                  <div key={staff.id} className="flex items-center gap-3 rounded-xl border border-dark-200 bg-dark-50 p-4">
                    <Avatar name={staff.name} src={staff.avatar_url} />
                    <div className="min-w-0"><p className="truncate font-semibold text-dark-700">{staff.name}</p><p className="mt-1 text-xs capitalize text-dark-500">{staff.role}</p></div>
                    <Badge variant="danger">Inactive</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingStaff ? "Edit team member" : "Add team member"}>
        {formError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{formError}</div>}
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Jane Wanjiku" required />
          <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jane@example.com" />
          <Input label="Phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07XXXXXXXX" />
          <Select label="Role" value={role} onChange={(event) => setRole(event.target.value)} options={[{ value: "stylist", label: "Stylist" }, { value: "barber", label: "Barber" }, { value: "manager", label: "Manager" }, { value: "receptionist", label: "Receptionist" }]} />
          <Input label="Avatar URL" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://example.com/photo.jpg" />
          {services.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium text-dark-700">Assigned services</legend>
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-dark-200 p-2">
                {services.map((service) => (
                  <label key={service.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-dark-50">
                    <input type="checkbox" checked={selectedServiceIds.includes(service.id)} onChange={() => toggleServiceId(service.id)} className="h-4 w-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-dark-700">{service.name} · {service.duration_minutes} min</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>{editingStaff ? "Save changes" : "Add team member"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
