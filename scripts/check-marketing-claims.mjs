import fs from "node:fs";

const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
const promotion = fs.readFileSync(new URL("../PROMOTION.md", import.meta.url), "utf8");
const combined = `${readme}\n${promotion}`;

const required = [
  "Published model rates remain unchanged",
  "current promotion",
  "PROMOTION.md",
];
const forbidden = [
  /50%\s*off/i,
  /permanent(?:ly)?\s+(?:discount|price)/i,
  /forever\s+(?:discount|price)/i,
];

const failures = [];
for (const phrase of required) {
  if (!combined.includes(phrase)) failures.push(`missing required qualification: ${phrase}`);
}
for (const pattern of forbidden) {
  if (pattern.test(combined)) failures.push(`unsupported marketing claim: ${pattern}`);
}

if (failures.length > 0) {
  console.error("Marketing claim check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Marketing claim check passed.");
