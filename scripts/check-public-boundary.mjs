import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirectories = new Set([".git", "node_modules", "dist", ".reports"]);
const ignoredFiles = new Set([
  path.join("scripts", "check-public-boundary.mjs"),
  path.join("assets", "readme-hero.png"),
]);
const forbidden = [
  ["private development hostname", ["xclaw", "-dev."].join("")],
  ["internal company hostname", ["bie", "ases.com"].join("")],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];

function filesUnder(directory, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(absolute, relative));
    else if (!ignoredFiles.has(relative)) files.push({ relative, absolute });
  }
  return files;
}

const findings = [];
for (const file of filesUnder(root)) {
  const buffer = fs.readFileSync(file.absolute);
  if (buffer.includes(0)) continue;
  const content = buffer.toString("utf8");
  for (const [label, pattern] of forbidden) {
    const found = typeof pattern === "string" ? content.includes(pattern) : pattern.test(content);
    if (found) findings.push(`${file.relative}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error("Public/private boundary check failed:\n" + findings.map((finding) => `- ${finding}`).join("\n"));
  process.exit(1);
}

console.log("Public/private boundary check passed.");
