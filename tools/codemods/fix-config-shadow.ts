import type { Project } from "ts-morph";

export default function fixConfigShadow({ project, filePaths }: { project: Project; filePaths: string[] }) {
  let changed = 0;

  for (const filePath of filePaths) {
    const sf = project.getSourceFile(filePath);
    if (!sf) continue;

    const importsConfig = sf.getImportDeclarations().some((d) =>
      d.getNamedImports().some((ni) => ni.getName() === "config")
    );
    if (!importsConfig) continue;

    const vars = sf.getVariableDeclarations().filter((vd) => vd.getName() === "config");
    if (vars.length === 0) continue;

    for (const vd of vars) {
      vd.rename("specConfig");
    }

    changed += 1;
  }

  return changed;
}
