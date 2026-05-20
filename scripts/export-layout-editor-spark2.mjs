import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildExportBundle, writeExportBundle } from "../tools/layout-editor/scripts/export-project-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const layoutEditorRoot = path.join(repoRoot, "tools", "layout-editor");
const statePath = path.join(layoutEditorRoot, ".ai-bridge", "latest-state.json");
const resourcesPath = path.join(layoutEditorRoot, ".ai-bridge", "latest-resources.json");
const outputDir = path.join(layoutEditorRoot, "mcp-runtime-export-spark2");

process.chdir(layoutEditorRoot);

const state = JSON.parse(await readFile(statePath, "utf8"));
const resourcesSnapshot = JSON.parse(await readFile(resourcesPath, "utf8"));
const project = state?.snapshot?.activeProject;

if (!project) {
  throw new Error(`No activeProject found in ${statePath}`);
}

const resources = Array.isArray(resourcesSnapshot?.resources) ? resourcesSnapshot.resources : [];
const bundle = buildExportBundle(project, resources, {
  includeLua: false,
  includeSceLua: false,
  includeCSharp: true,
  includeAndroidXml: false,
});
const result = await writeExportBundle(outputDir, bundle);

console.log(
  JSON.stringify(
    {
      projectId: project.id,
      projectName: project.name,
      outputRoot: result.rootDir,
      documents: (project.documents ?? []).map((document) => ({
        id: document.page?.id ?? "",
        name: document.page?.name ?? "",
        devicePreset: document.page?.devicePreset ?? "",
      })),
      resources: resources.length,
    },
    null,
    2,
  ),
);
