import { execFileSync } from "node:child_process";
import { appendFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const requiresHeavyProof = (files) =>
  files.length === 0 || files.some((file) => !/^(?:docs\/|[^/]+\.md$)/.test(file));

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let heavy = true;
  const base = process.env.REVIEW_BASE;
  if (/^[a-f0-9]{40}$/.test(base ?? "") && !/^0+$/.test(base)) {
    try {
      const files = execFileSync("git", ["diff", "--name-only", "-z", base, "HEAD"], {
        encoding: "utf8",
      })
        .split("\0")
        .filter(Boolean);
      heavy = requiresHeavyProof(files);
    } catch {
      /* Missing history is unknown: conservatively run all proofs. */
    }
  }
  const roles = ["backend", "hub", "storefront"];
  const own = process.env.CURRENT_COMPONENT;
  const components = !heavy && roles.includes(own) ? [own] : roles;
  const output = `heavy=${heavy}\ncomponents=${JSON.stringify(components)}\n`;
  console.log(output.trim());
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
}
