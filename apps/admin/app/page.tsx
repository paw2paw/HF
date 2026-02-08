import { redirect } from "next/navigation";

export default function Home() {
  // Default to simplified Playbook Studio UI
  redirect("/x/studio");
}
