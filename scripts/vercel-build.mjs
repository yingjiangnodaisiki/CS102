import { spawn } from "node:child_process";

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...opts
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const steps = [
  { name: "prisma generate", cmd: "npx", args: ["prisma", "generate"], allowFail: false },
  { name: "prisma migrate deploy", cmd: "npx", args: ["prisma", "migrate", "deploy"], allowFail: true },
  { name: "next build", cmd: "npx", args: ["next", "build"], allowFail: false }
];

for (const step of steps) {
  // eslint-disable-next-line no-console
  console.log(`\n[vercel-build] running: ${step.name}`);
  const code = await run(step.cmd, step.args);
  if (code !== 0) {
    if (step.allowFail) {
      // eslint-disable-next-line no-console
      console.warn(`[vercel-build] step failed but continuing: ${step.name} (exit ${code})`);
      continue;
    }
    process.exit(code);
  }
}

