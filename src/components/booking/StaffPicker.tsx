"use client";

import Avatar from "@/components/ui/Avatar";
import type { Staff } from "@/types";

interface StaffPickerProps {
  staff: Staff[];
  selectedId: string;
  onChange: (id: string) => void;
}

export default function StaffPicker({ staff, selectedId, onChange }: StaffPickerProps) {
  if (staff.length === 0) return null;

  const optionClass = (selected: boolean) => `flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
    selected ? "border-primary-400 bg-primary-50 shadow-[inset_4px_0_0_var(--color-primary-600)]" : "border-dark-200 bg-surface hover:border-primary-300 hover:bg-dark-50"
  }`;

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Choose a stylist">
      <button type="button" aria-pressed={selectedId === ""} onClick={() => onChange("")} className={optionClass(selectedId === "")}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-900 text-white" aria-hidden="true">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </span>
        <span><span className="block font-semibold text-dark-900">Any available</span><span className="mt-0.5 block text-xs text-dark-500">First suitable team member</span></span>
      </button>

      {staff.map((member) => (
        <button key={member.id} type="button" aria-pressed={selectedId === member.id} onClick={() => onChange(member.id)} className={optionClass(selectedId === member.id)}>
          <Avatar name={member.name} src={member.avatar_url} />
          <span className="min-w-0"><span className="block truncate font-semibold text-dark-900">{member.name}</span><span className="mt-0.5 block truncate text-xs capitalize text-dark-500">{member.role}</span></span>
        </button>
      ))}
    </div>
  );
}
