import { Project } from "ts-morph";
import path from "path";

const modName = process.argv[2];
if (!modName) {
  console.error("Usage: npx tsx tools/codemods/run.ts <mod-name>");
  process.exit(1);
}

async function main() {
  const project = new Project({
    tsConfigFilePath: path.resolve("apps/admin/tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  const modPath = path.resolve(`tools/codemods/mods/${modName}.ts`);
  const mod = await import(modPath);

  if (typeof mod.default !== "function") {
    console.error(`Codemod ${modName} must export default function`);
    process.exit(1);
  }

  await mod.default(project);

  await project.save();
  console.log("Codemod complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
