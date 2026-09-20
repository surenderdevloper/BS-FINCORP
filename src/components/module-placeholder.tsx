import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

export function ModulePlaceholder({
  title,
  description,
  planned,
  icon,
}: {
  title: string;
  description: string;
  planned: string[];
  icon: IconName;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
      <Card className="p-8">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Icon name={icon} size={24} />
          </span>
          <h2 className="text-base font-semibold text-zinc-900">
            This module is queued in the build roadmap
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Completed first: Dashboard and New Loan. Next milestones will deliver this module with
            the same design system.
          </p>
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {planned.map((p) => (
              <li
                key={p}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

const meta = (t: string): Metadata => ({ title: t });

export { meta };