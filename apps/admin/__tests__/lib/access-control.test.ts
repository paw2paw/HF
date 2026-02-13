/**
 * Tests for lib/access-control.ts — Entity Access Control
 *
 * Tests the contract-driven access matrix enforcement.
 * Verifies that each role gets correct access (scope + operations) per entity.
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

// Load the contract directly for unit testing (no DB needed)
const contractPath = path.join(
  __dirname,
  "../../docs-archive/bdd-specs/contracts/ENTITY_ACCESS_V1.contract.json"
);
const contract = JSON.parse(fs.readFileSync(contractPath, "utf-8"));
const matrix = contract.matrix as Record<string, Record<string, string>>;

// Helper to parse "ALL:CRUD" → { scope, operations }
function parseRule(rule: string) {
  const [scope, ops] = rule.split(":");
  return { scope, operations: new Set(ops?.split("") || []) };
}

describe("ENTITY_ACCESS_V1 Contract", () => {
  it("has all expected roles", () => {
    expect(contract.roles).toEqual([
      "SUPERADMIN", "ADMIN", "OPERATOR", "SUPER_TESTER", "TESTER", "DEMO",
    ]);
  });

  it("has all expected entities", () => {
    const entities = Object.keys(matrix);
    expect(entities).toContain("callers");
    expect(entities).toContain("calls");
    expect(entities).toContain("domains");
    expect(entities).toContain("playbooks");
    expect(entities).toContain("specs");
    expect(entities).toContain("parameters");
    expect(entities).toContain("goals");
    expect(entities).toContain("users");
    expect(entities).toContain("pipeline");
    expect(entities).toContain("ai_config");
    expect(entities).toContain("settings");
    expect(entities).toContain("analytics");
    expect(entities).toContain("metering");
    expect(entities).toContain("messages");
    expect(entities).toContain("content");
    expect(entities).toContain("sim");
    expect(entities).toContain("invites");
  });

  it("every entity has rules for all 6 roles", () => {
    const roles = contract.roles as string[];
    for (const [entity, roleMap] of Object.entries(matrix)) {
      for (const role of roles) {
        expect(
          (roleMap as Record<string, string>)[role],
          `Missing rule for ${entity}:${role}`
        ).toBeDefined();
      }
    }
  });

  it("every rule has valid format SCOPE:OPERATIONS", () => {
    const validScopes = new Set(["ALL", "DOMAIN", "OWN", "NONE"]);
    const validOps = new Set(["C", "R", "U", "D"]);

    for (const [entity, roleMap] of Object.entries(matrix)) {
      for (const [role, ruleStr] of Object.entries(roleMap as Record<string, string>)) {
        const { scope, operations } = parseRule(ruleStr);
        expect(validScopes.has(scope), `Invalid scope "${scope}" for ${entity}:${role}`).toBe(true);
        for (const op of operations) {
          expect(validOps.has(op), `Invalid op "${op}" for ${entity}:${role}`).toBe(true);
        }
        // NONE scope should have no operations
        if (scope === "NONE") {
          expect(operations.size, `NONE scope should have no ops for ${entity}:${role}`).toBe(0);
        }
      }
    }
  });

  describe("SUPERADMIN access", () => {
    it("has ALL:CRUD or ALL:R on every entity", () => {
      for (const [entity, roleMap] of Object.entries(matrix)) {
        const rule = (roleMap as Record<string, string>)["SUPERADMIN"];
        const { scope } = parseRule(rule);
        expect(scope, `SUPERADMIN should have ALL scope on ${entity}`).toBe("ALL");
      }
    });
  });

  describe("DEMO access", () => {
    it("has no write access to system entities", () => {
      const systemEntities = ["domains", "playbooks", "specs", "parameters", "users", "pipeline", "ai_config", "settings", "metering", "content", "invites"];
      for (const entity of systemEntities) {
        const rule = (matrix[entity] as Record<string, string>)["DEMO"];
        const { scope, operations } = parseRule(rule);
        if (scope !== "NONE") {
          expect(operations.has("C"), `DEMO should not create ${entity}`).toBe(false);
          expect(operations.has("U"), `DEMO should not update ${entity}`).toBe(false);
          expect(operations.has("D"), `DEMO should not delete ${entity}`).toBe(false);
        }
      }
    });
  });

  describe("TESTER access", () => {
    it("has OWN scope on callers, calls, sim", () => {
      for (const entity of ["callers", "calls", "sim"]) {
        const rule = (matrix[entity] as Record<string, string>)["TESTER"];
        const { scope } = parseRule(rule);
        expect(scope, `TESTER should have OWN scope on ${entity}`).toBe("OWN");
      }
    });

    it("has no access to system config", () => {
      for (const entity of ["ai_config", "settings", "pipeline", "users", "invites"]) {
        const rule = (matrix[entity] as Record<string, string>)["TESTER"];
        const { scope } = parseRule(rule);
        expect(scope, `TESTER should have NONE on ${entity}`).toBe("NONE");
      }
    });
  });

  describe("ai_config is SUPERADMIN-only", () => {
    it("only SUPERADMIN has access to ai_config", () => {
      const roles = ["ADMIN", "OPERATOR", "SUPER_TESTER", "TESTER", "DEMO"];
      for (const role of roles) {
        const rule = (matrix["ai_config"] as Record<string, string>)[role];
        const { scope } = parseRule(rule);
        expect(scope, `${role} should have NONE on ai_config`).toBe("NONE");
      }
    });
  });

  describe("settings is SUPERADMIN-only", () => {
    it("only SUPERADMIN has access to settings", () => {
      const roles = ["ADMIN", "OPERATOR", "SUPER_TESTER", "TESTER", "DEMO"];
      for (const role of roles) {
        const rule = (matrix["settings"] as Record<string, string>)[role];
        const { scope } = parseRule(rule);
        expect(scope, `${role} should have NONE on settings`).toBe("NONE");
      }
    });
  });

  describe("SUPER_TESTER has DOMAIN scope", () => {
    it("has DOMAIN scope on caller-related entities", () => {
      for (const entity of ["callers", "calls", "sim"]) {
        const rule = (matrix[entity] as Record<string, string>)["SUPER_TESTER"];
        const { scope } = parseRule(rule);
        expect(scope, `SUPER_TESTER should have DOMAIN scope on ${entity}`).toBe("DOMAIN");
      }
    });
  });
});
