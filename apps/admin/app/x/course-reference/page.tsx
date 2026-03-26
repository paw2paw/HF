import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CourseRefBuilder } from "./CourseRefBuilder";

/**
 * Course Reference Builder page.
 *
 * Chat-driven interview that builds a COURSE_REFERENCE document.
 * Optional ?courseId= param for editing existing course references.
 */
export default async function CourseReferencePage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;

  return <CourseRefBuilder courseId={params.courseId} />;
}
