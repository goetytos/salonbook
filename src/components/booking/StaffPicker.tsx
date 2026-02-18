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

  return (
    <div className="space-y-3">
      {/* "Any Available" option */}
      <button
        onClick={() => onChange("")}
        className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition ${
          selectedId === ""
            ? "border-primary-300 bg-primary-50 ring-2 ring-primary-200"
            : "border-dark-200 bg-white hover:border-primary-200"
        }`}
      >
        <div className="w-10 h-10 rounded-full bg-dark-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-dark-900">Any available</p>
          <p className="text-xs text-dark-500">First available staff member</p>
        </div>
      </button>

      {staff.map((member) => (
        <button
          key={member.id}
          onClick={() => onChange(member.id)}
          className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition ${
            selectedId === member.id
              ? "border-primary-300 bg-primary-50 ring-2 ring-primary-200"
              : "border-dark-200 bg-white hover:border-primary-200"
          }`}
        >
          <Avatar name={member.name} src={member.avatar_url} />
          <div>
            <p className="font-medium text-dark-900">{member.name}</p>
            <p className="text-xs text-dark-500 capitalize">{member.role}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
