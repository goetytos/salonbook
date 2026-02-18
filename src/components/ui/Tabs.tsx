"use client";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="border-b border-dark-200">
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              activeTab === tab.id
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-dark-500 hover:text-dark-700 hover:border-dark-300"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? "bg-primary-100 text-primary-700"
                    : "bg-dark-100 text-dark-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
