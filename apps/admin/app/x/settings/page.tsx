import { requirePageAuth } from "@/lib/permissions";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  await requirePageAuth("ADMIN");
  return <SettingsClient />;
}
