import { Project } from "ts-morph";

export default async function example(project: Project) {
  const files = project.getSourceFiles("**/*.ts");

  let changed = 0;

  for (const file of files) {
    if (file.getText().includes("TODO_RENAME_ME")) {
      file.replaceWithText(
        file.getText().replace(/TODO_RENAME_ME/g, "renamedValue")
      );
      changed++;
    }
  }

  console.log(`Updated ${changed} files.`);
}
