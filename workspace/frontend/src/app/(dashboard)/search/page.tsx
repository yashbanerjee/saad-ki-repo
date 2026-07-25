"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderKanban, Bug, FileText, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";

type Category = "projects" | "issues" | "documents" | "people";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
}

const categoryIcons = { projects: FolderKanban, issues: Bug, documents: FileText, people: Users };
const categoryRoutes: Record<Category, (id: string) => string> = {
  projects: (id) => `/projects/${id}`,
  issues: (id) => `/issues/${id}`,
  documents: () => `/documents`,
  people: () => `/team`,
};

function ResultList({ category, results }: { category: Category; results: SearchResult[] }) {
  const router = useRouter();
  const Icon = categoryIcons[category];

  if (results.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No {category} found</p>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {results.map((item) => (
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

  const emptyResults: Record<Category, SearchResult[]> = {
    projects: [],
    issues: [],
    documents: [],
    people: [],
  };

  const totalResults = 0;

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

      {!query ? (
        <EmptyState
          icon={Search}
          title="Search your workspace"
          description="Enter a query above to find projects, issues, documents, and team members."
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{totalResults} results for &ldquo;{query}&rdquo;</p>

          {totalResults === 0 && (
            <EmptyState
              icon={Search}
              title="No results found"
              description={`Nothing matched "${query}". Try a different search term.`}
            />
          )}

          {totalResults > 0 && (
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="people">People</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4 space-y-6">
                {(Object.keys(emptyResults) as Category[]).map((category) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 capitalize flex items-center gap-2">
                      {(() => { const Icon = categoryIcons[category]; return <Icon className="h-4 w-4" />; })()}
                      {category}
                    </h3>
                    <ResultList category={category} results={emptyResults[category]} />
                  </div>
                ))}
              </TabsContent>

              {(Object.keys(emptyResults) as Category[]).map((category) => (
                <TabsContent key={category} value={category} className="mt-4">
                  <ResultList category={category} results={emptyResults[category]} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
