"use client";

import { useParams } from "next/navigation";
import { SpaceShell } from "@/components/spaces/SpaceShell";

export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const spaceId = params.id as string;
  return <SpaceShell spaceId={spaceId}>{children}</SpaceShell>;
}
