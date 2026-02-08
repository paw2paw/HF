"use client";

import dynamic from "next/dynamic";

const TranscriptsApp = dynamic(() => import("./TranscriptsApp"), { ssr: false });

export default function Page() {
  return <TranscriptsApp />;
}
