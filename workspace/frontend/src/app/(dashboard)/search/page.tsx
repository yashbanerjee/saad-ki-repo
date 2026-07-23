"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderKanban, Bug, FileText, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const allResults = {
  projects: [
    { id: "1", title: "Website Redesign", subtitle: "Acme Corp · 68% complete" },
    { id: "2", title: "Mobile App v2", subtitle: "TechStart Inc · 35% complete" },
  ],
  issues: [
    { id: "1", title: "Login redirect loop on Safari", subtitle: "Bug · High priority" },
    { id: "2", title: "Add export to CSV", subtitle: "Feature · Medium priority" },
  ],
  documents: [
    { id: "1", title: "Project Requirements.pdf", subtitle: "Requirements · 2.4 MB" },
    { id: "2", title: "API Specification.md", subtitle: "Technical · 124 KB" },
  ],
  people: [
    { id: "1", title: "Alex Morgan", subtitle: "alex@company.com · Admin" },
    { id: "2", title: "Sarah Kim", subtitle: "sarah@company.com · Manager" },
  ],
};

type Category = keyof typeof allResults;

const categoryIcons = { projects: FolderKanban, issues: Bug, documents: FileText, people: Users };
const categoryRoutes: Record<Category, (id: string) => string> = {
  projects: (id) => `/projects/${id}`,
  issues: (id) => `/issues/${id}`,
  documents: () => `/documents`,
  people: () => `/team`,
};

function ResultList({ category, query }: { category: Category; query: string }) {
  const router = useRouter();
  const Icon = categoryIcons[category];
  const filtered = allResults[category].filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No {category} found</p>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {filtered.map((item) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors text-left"
              onClick={() => router.push(categoryRoutes[category](item.id))}
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const totalResults = Object.values(allResults).flat().filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground">Find projects, issues, documents, and people</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search everything..."
          className="pl-9 h-11"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query && (
        <p className="text-sm text-muted-foreground">{totalResults} results for &ldquo;{query}&rdquo;</p>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-6">
          {(Object.keys(allResults) as Category[]).map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 capitalize flex items-center gap-2">
                {(() => { const Icon = categoryIcons[category]; return <Icon className="h-4 w-4" />; })()}
                {category}
              </h3>
              <ResultList category={category} query={query} />
            </div>
          ))}
        </TabsContent>

        {(Object.keys(allResults) as Category[]).map((category) => (
          <TabsContent key={category} value={category} className="mt-4">
            <ResultList category={category} query={query} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
