"use client";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CrmDetailTab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
};

type Props = {
  header: React.ReactNode;
  sidePanel: React.ReactNode;
  tabs: CrmDetailTab[];
  defaultTab?: string;
  className?: string;
};

export function CrmDetailLayout({
  header,
  sidePanel,
  tabs,
  defaultTab,
  className,
}: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border bg-card/60 px-4 py-3">{header}</div>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        <aside className="rounded-xl border bg-card/40 p-4 lg:sticky lg:top-4 space-y-4">
          {sidePanel}
        </aside>
        <section className="rounded-xl border bg-card/40 min-h-[480px]">
          <Tabs defaultValue={defaultTab || tabs[0]?.id}>
            <div className="border-b px-2 overflow-x-auto">
              <TabsList className="h-11 bg-transparent gap-1">
                {tabs.map((t) => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="text-xs data-[state=active]:bg-muted gap-1.5"
                  >
                    {t.icon}
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {tabs.map((t) => (
              <TabsContent key={t.id} value={t.id} className="p-4 mt-0">
                {t.content}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      </div>
    </div>
  );
}
