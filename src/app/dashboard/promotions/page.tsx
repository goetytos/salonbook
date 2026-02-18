"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { Promotion } from "@/types";

export default function PromotionsPage() {
  const { business } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!business) return;
    try {
      const data = await api.get<Promotion[]>(`/businesses/${business.id}/promotions`);
      setPromotions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!business || !code || !discountValue || !validFrom || !validTo) return;
    setSaving(true);
    try {
      await api.post(`/businesses/${business.id}/promotions`, {
        code: code.toUpperCase(),
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        valid_from: validFrom,
        valid_to: validTo,
        max_uses: maxUses ? parseInt(maxUses) : undefined,
      });
      setModalOpen(false);
      resetForm();
      await fetchData();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (promo: Promotion) => {
    if (!business) return;
    try {
      await api.put(`/businesses/${business.id}/promotions/${promo.id}`, {
        active: !promo.active,
      });
      await fetchData();
    } catch {
      // silent
    }
  };

  const handleDelete = async (promoId: string) => {
    if (!business || !confirm("Delete this promotion?")) return;
    try {
      await api.delete(`/businesses/${business.id}/promotions/${promoId}`);
      await fetchData();
    } catch {
      // silent
    }
  };

  const resetForm = () => {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setValidFrom("");
    setValidTo("");
    setMaxUses("");
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Promotions</h1>
          <p className="text-dark-500 text-sm mt-1">Create and manage promo codes</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Create Promo</Button>
      </div>

      {loading ? (
        <p className="text-dark-400">Loading...</p>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
              title="No promotions yet"
              description="Create promo codes to give customers discounts on bookings."
              actionLabel="Create Promo"
              onAction={() => setModalOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promotions.map((promo) => {
            const isExpired = promo.valid_to < today;
            const isMaxedOut = promo.max_uses !== null && promo.current_uses >= (promo.max_uses || 0);
            return (
              <Card key={promo.id} className={!promo.active ? "opacity-60" : ""}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-lg font-bold text-dark-900">{promo.code}</code>
                        {promo.active && !isExpired && !isMaxedOut && (
                          <Badge variant="success">Active</Badge>
                        )}
                        {!promo.active && <Badge variant="default">Inactive</Badge>}
                        {isExpired && <Badge variant="danger">Expired</Badge>}
                        {isMaxedOut && <Badge variant="warning">Maxed Out</Badge>}
                      </div>
                      <p className="text-sm text-dark-700">
                        {promo.discount_type === "percentage"
                          ? `${promo.discount_value}% off`
                          : `KES ${Number(promo.discount_value).toLocaleString()} off`}
                      </p>
                      <p className="text-xs text-dark-400 mt-1">
                        {promo.valid_from} to {promo.valid_to}
                        {promo.max_uses && ` · ${promo.current_uses}/${promo.max_uses} used`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggle(promo)}
                      >
                        {promo.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(promo.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Promotion"
      >
        <div className="space-y-4">
          <Input
            label="Promo Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. SUMMER20"
          />
          <Select
            label="Discount Type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
            options={[
              { value: "percentage", label: "Percentage (%)" },
              { value: "fixed", label: "Fixed Amount (KES)" },
            ]}
          />
          <Input
            label={discountType === "percentage" ? "Discount (%)" : "Discount (KES)"}
            type="number"
            min={0}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 500"}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valid From"
              type="date"
              min={today}
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
            <Input
              label="Valid To"
              type="date"
              min={validFrom || today}
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
            />
          </div>
          <Input
            label="Max Uses (optional)"
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Unlimited"
          />
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCreate}
              loading={saving}
              disabled={!code || !discountValue || !validFrom || !validTo}
            >
              Create
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
