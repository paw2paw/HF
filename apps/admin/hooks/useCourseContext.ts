"use client";

import { useState, useEffect } from "react";
import {
  groupSpecs,
  archetypeLabel,
  type PlaybookItem,
  type SystemSpec,
  type SpecGroups,
  type SpecDetail,
} from "@/lib/course/group-specs";
import {
  TEACHING_MODE_LABELS,
  type TeachingMode,
} from "@/lib/content-trust/resolve-config";

export type CourseContextData = {
  loading: boolean;
  error: string | null;
  courseId: string | undefined;
  courseName: string | null;
  domainId: string | null;
  domainName: string | null;
  teachingMode: TeachingMode | null;
  teachingModeLabel: string | null;
  teachingModeIcon: string | null;
  personaName: string | null;
  personaArchetype: string | null;
  personaRoleStatement: string | null;
  specGroups: SpecGroups;
  activeSpecCount: number;
};

const EMPTY_GROUPS: SpecGroups = {
  persona: [],
  measure: [],
  adapt: [],
  guard: [],
  voice: [],
  compose: [],
};

/**
 * Fetches playbook data and derives holographic summary for a course.
 * Used by CourseContextBanner on Subject + Source pages.
 */
export function useCourseContext(
  courseId: string | undefined,
): CourseContextData {
  const [data, setData] = useState<CourseContextData>({
    loading: true,
    error: null,
    courseId,
    courseName: null,
    domainId: null,
    domainName: null,
    teachingMode: null,
    teachingModeLabel: null,
    teachingModeIcon: null,
    personaName: null,
    personaArchetype: null,
    personaRoleStatement: null,
    specGroups: EMPTY_GROUPS,
    activeSpecCount: 0,
  });

  useEffect(() => {
    if (!courseId) {
      setData((prev) => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;

    fetch(`/api/playbooks/${courseId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((res) => {
        if (cancelled) return;

        if (!res.ok || !res.playbook) {
          setData((prev) => ({
            ...prev,
            loading: false,
            error: res.error || "Course not found",
          }));
          return;
        }

        const pb = res.playbook;
        const pbConfig = (pb.config as Record<string, any>) || {};
        const mode =
          (pbConfig.teachingMode as TeachingMode) || null;
        const modeInfo = mode ? TEACHING_MODE_LABELS[mode] : null;

        const groups = groupSpecs(
          (pb.items || []) as PlaybookItem[],
          (pb.systemSpecs || []) as SystemSpec[],
        );

        // Extract persona info from first IDENTITY spec
        const personaSpec = groups.persona[0] as SpecDetail | undefined;
        const personaConfig = personaSpec?.config as Record<string, any> | undefined;
        const roleParam = personaConfig?.parameters?.find(
          (p: any) => p.id === "agent_role",
        );

        const activeSpecCount =
          groups.measure.length +
          groups.adapt.length +
          groups.guard.length +
          groups.voice.length +
          groups.compose.length +
          groups.persona.length;

        setData({
          loading: false,
          error: null,
          courseId,
          courseName: pb.name || null,
          domainId: pb.domain?.id || null,
          domainName: pb.domain?.name || null,
          teachingMode: mode,
          teachingModeLabel: modeInfo?.label || null,
          teachingModeIcon: modeInfo?.icon || null,
          personaName: personaSpec?.name || null,
          personaArchetype: personaSpec?.extendsAgent
            ? archetypeLabel(personaSpec.extendsAgent)
            : null,
          personaRoleStatement:
            roleParam?.config?.roleStatement || null,
          specGroups: groups,
          activeSpecCount,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load course",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return data;
}
