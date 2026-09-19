import { redirect } from "next/navigation";

export default async function ProjectBoardRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/spaces/${id}/board`);
}
