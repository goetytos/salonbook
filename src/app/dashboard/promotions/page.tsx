"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardContent } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { Promotion } from "@/types";
import { getNairobiDateTime } from "@/lib/validation";

export default function PromotionsPage() {
  const { business } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!business) return;
    if (showLoading) setLoading(true);
    setError("");
    try {
      const data = await api.get<Promotion[]>(`/businesses/${business.id}/promotions`);
      setPromotions(data);
    } catch (requestError) {
      setPromotions([]);
      setError(requestError instanceof Error ? requestError.message : "Promotions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setValidFrom("");
    setValidTo("");
    setMaxUses("");
  };

  const handleCreate = async () => {
    if (!business || !code || !discountValue || !validFrom || !validTo) return;
    setSaving(true);
    setActionError("");
    try {
      await api.post(`/businesses/${business.id}/promotions`, {
        code: code.toUpperCase(),
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        valid_from: validFrom,
        valid_to: validTo,
        max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
      });
      setModalOpen(false);
      resetForm();
      await fetchData(false);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "The promotion could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (promotion: Promotion) => {
    if (!business) return;
    setUpdating(promotion.id);
    setActionError("");
    try {
      await api.put(`/businesses/${business.id}/promotions/${promotion.id}`, {
        active: !promotion.active,
      });
      await fetchData(false);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "The promotion could not be updated.");
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (promotionId: string) => {
    if (!business || !confirm("Delete this promotion?")) return;
    setUpdating(promotionId);
    setActionError("");
    try {
      await api.delete(`/businesses/${business.id}/promotions/${promotionId}`);
      await fetchData(false);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "The promotion could not be deleted.");
    } finally {
      setUpdating(null);
    }
  };

  const today = getNairobiDateTime().date;
  const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        eyebrow="Growth tools"
        title="Promotions"
        description="Create intentional offers, control their availability and track how often each code is used."
        actions={<Button onClick={() => { setActionError(""); setModalOpen(true); }}>Create promotion</Button>}
      />

      {actionError && !modalOpen && (
        <div className="mb-5">
          <DashboardState type="error" title="The change was not saved" description={actionError} />
        </div>
      )}

      {loading ? (
        <DashboardState type="loading" title="Loading promotions" />
      ) : error ? (
        <DashboardState type="error" title="Promotions unavailable" description={error} onRetry={() => void fetchData()} />
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="p-2 sm:p-2">
            <EmptyState
              icon={
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
              title="No promotions yet"
              description="Create a code when you are ready to reward loyal customers or introduce a new service."
              actionLabel="Create promotion"
              onAction={() => { setActionError(""); setModalOpen(true); }}
            />
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2" aria-label="Promotion codes">
          {promotions.map((promotion) => {
            const expired = promotion.valid_to < today;
            const maxedOut = promotion.max_uses != null && promotion.current_uses >= promotion.max_uses;
            const busy = updating === promotion.id;
            const status = !promotion.active
              ? { label: "Inactive", variant: "default" as const }
              : expired
                ? { label: "Expired", variant: "danger" as const }
                : maxedOut
                  ? { label: "Limit reached", variant: "warning" as const }
                  : { label: "Active", variant: "success" as const };

            return (
              <Card key={promotion.id} className={!promotion.active ? "opacity-70" : ""}>
                <CardContent className="flex h-full flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-dark-500">Offer code</p>
                      <code className="mt-2 block font-sans text-xl font-extrabold tracking-[0.08em] text-dark-900">{promotion.code}</code>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>

                  <p className="mt-5 font-display text-2xl font-semibold text-primary-700">
                    {promotion.discount_type === "percentage"
                      ? `${promotion.discount_value}% off`
                      : `KES ${Number(promotion.discount_value).toLocaleString()} off`}
                  </p>

                  <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-dark-200 py-4 text-sm">
                    <div>
                      <dt className="text-xs text-dark-500">Valid window</dt>
                      <dd className="mt-1 font-semibold text-dark-800">{formatDate(promotion.valid_from)}</dd>
                      <dd className="text-xs text-dark-500">to {formatDate(promotion.valid_to)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-dark-500">Redemptions</dt>
                      <dd className="mt-1 font-semibold tabular-nums text-dark-800">
                        {promotion.current_uses}{promotion.max_uses != null ? ` of ${promotion.max_uses}` : ""}
                      </dd>
                      <dd className="text-xs text-dark-500">{promotion.max_uses == null ? "No set limit" : "uses recorded"}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex flex-wrap gap-2 pt-4" aria-busy={busy || undefined}>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleToggle(promotion)}>
                      {promotion.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void handleDelete(promotion.id)}>
                      Delete
                    </Button>
                    {busy && <span className="self-center text-xs text-dark-500" role="status">Updating…</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create promotion">
        <div className="space-y-4">
          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{actionError}</p>
          )}
          <Input
            label="Promotion code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="e.g. WELCOME20"
            autoComplete="off"
            autoFocus
          />
          <Select
            label="Discount type"
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value as "percentage" | "fixed")}
            options={[
              { value: "percentage", label: "Percentage (%)" },
              { value: "fixed", label: "Fixed amount (KES)" },
            ]}
          />
          <Input
            label={discountType === "percentage" ? "Discount (%)" : "Discount (KES)"}
            type="number"
            min={0}
            max={discountType === "percentage" ? 100 : undefined}
            value={discountValue}
            onChange={(event) => setDiscountValue(event.target.value)}
            placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 500"}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Valid from" type="date" min={today} value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
            <Input label="Valid to" type="date" min={validFrom || today} value={validTo} onChange={(event) => setValidTo(event.target.value)} />
          </div>
          <Input
            label="Maximum uses (optional)"
            type="number"
            min={1}
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
            placeholder="Unlimited"
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} loading={saving} disabled={!code || !discountValue || !validFrom || !validTo}>Create promotion</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
