"use client";

import { Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";

export type SankeyLink = { source: number; target: number; value: number };
export type SankeyNode = { name: string };
export type SankeyData = { nodes: SankeyNode[]; links: SankeyLink[] };

type NodeProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: { name?: string; value?: number };
  containerWidth: number;
};

function SankeyNode({ x, y, width, height, payload, containerWidth }: NodeProps) {
  if (x == null || y == null) return null;
  const isRight = x > containerWidth / 2;
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--vedha-teal)"
        fillOpacity={0.9}
        radius={2}
      />
      <text
        x={isRight ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={isRight ? "end" : "start"}
        dominantBaseline="middle"
        className="fill-foreground"
        fontSize={12}
      >
        {payload.name}
        {payload.value != null ? ` · ${payload.value}` : ""}
      </text>
    </g>
  );
}

export function CrmFunnel({
  stages,
}: {
  stages: Array<{ label: string; count: number; conversionFromPrevious?: number }>;
}) {
  const max = Math.max(...stages.map((stage) => stage.count), 1);
  return (
    <div className="space-y-3">
      {stages.map((stage, index) => {
        const width = Math.max(8, (stage.count / max) * 100);
        return (
          <div key={stage.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{stage.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {stage.count}
                {index > 0 ? ` · ${stage.conversionFromPrevious ?? 0}% keep` : ""}
              </span>
            </div>
            <div className="h-8 overflow-hidden rounded-md bg-muted">
              <div
                className="h-full rounded-md bg-[var(--vedha-teal)]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CrmSankeyDiagram({
  data,
  emptyLabel = "Not enough movement to draw a flow yet",
}: {
  data?: SankeyData | null;
  emptyLabel?: string;
}) {
  const nodes = data?.nodes ?? [];
  const links = (data?.links ?? []).filter(
    (link) =>
      link.value > 0 &&
      link.source !== link.target &&
      link.source >= 0 &&
      link.target >= 0 &&
      link.source < nodes.length &&
      link.target < nodes.length,
  );

  if (nodes.length < 2 || links.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <Sankey
        data={{ nodes, links }}
        nodeWidth={12}
        nodePadding={28}
        linkCurvature={0.5}
        iterations={32}
        node={(props) => <SankeyNode {...(props as NodeProps)} />}
        link={{ stroke: "var(--vedha-teal)", strokeOpacity: 0.22 }}
        margin={{ left: 12, right: 140, top: 12, bottom: 12 }}
      >
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
      </Sankey>
    </ResponsiveContainer>
  );
}
