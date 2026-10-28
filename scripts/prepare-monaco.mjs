import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const source = fileURLToPath(
  new URL("../node_modules/monaco-editor/min/vs", import.meta.url),
);
const target = fileURLToPath(new URL("../public/monaco/vs", import.meta.url));
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log("Prepared local Monaco assets.");
