"use client";

import { use } from "react";
import { PlaybookBuilder } from "@/components/playbook/PlaybookBuilder";

export default function PlaybookBuilderPage({
  params,
}: {
  params: Promise<{ playbookId: string }>;
}) {
  const { playbookId } = use(params);

  return <PlaybookBuilder playbookId={playbookId} routePrefix="/x" />;
}
