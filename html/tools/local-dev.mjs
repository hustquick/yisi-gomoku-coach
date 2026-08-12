import { spawn } from "node:child_process";

const processes = [
  spawn(process.execPath, ["tools/rapfi-server.mjs"], { stdio: "inherit" }),
  spawn("npm", ["run", "dev"], { stdio: "inherit" }),
];

function stop() {
  for (const child of processes) if (!child.killed) child.kill("SIGTERM");
}

for (const child of processes) child.on("exit", code => {
  if (code && code !== 143) process.exitCode = code;
  stop();
});
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

