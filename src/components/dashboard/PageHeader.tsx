interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({
  eyebrow = "Business workspace",
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-7 flex flex-col gap-4 border-b border-dark-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary-700">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] text-dark-900 sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-dark-500 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
