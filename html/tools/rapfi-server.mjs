import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { availableParallelism } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const runtimeDir = resolve(here, "../../engine/runtime/macos-arm64");
const binary = resolve(runtimeDir, "pbrain-rapfi");
const port = Number(process.env.RAPFI_PORT || 3211);
const logicalCores = availableParallelism();
const requestedThreads = Number(process.env.RAPFI_THREADS);
const threadCount = Number.isFinite(requestedThreads)
  ? Math.max(1, Math.min(logicalCores, Math.trunc(requestedThreads)))
  : Math.max(1, Math.min(4, logicalCores > 2 ? logicalCores - 1 : logicalCores));
const ruleCodes = { freestyle: 0, standard: 1, renju: 2 };

function send(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 128 * 1024) {
        reject(new Error("请求数据过大"));
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("请求不是有效 JSON"));
      }
    });
    request.on("error", reject);
  });
}

function validate(body) {
  const stones = Array.isArray(body.stones) ? body.stones : [];
  if (stones.length > 225) throw new Error("棋子数量无效");
  const seen = new Set();
  const cleanStones = stones.map((stone) => {
    const x = Number(stone.x),
      y = Number(stone.y),
      player = Number(stone.player);
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x > 14 ||
      y < 0 ||
      y > 14 ||
      ![1, 2].includes(player)
    )
      throw new Error("棋子坐标无效");
    const key = `${x},${y}`;
    if (seen.has(key)) throw new Error("棋盘存在重叠棋子");
    seen.add(key);
    return { x, y, player };
  });
  const rule = Object.hasOwn(ruleCodes, body.rule) ? body.rule : "freestyle";
  return {
    stones: cleanStones,
    rule: ruleCodes[rule],
    timeMs: Math.max(100, Math.min(20000, Number(body.timeMs) || 800)),
    maxDepth: Math.max(
      1,
      Math.min(30, Math.trunc(Number(body.maxDepth) || 10)),
    ),
    multiPV: Math.max(1, Math.min(10, Math.trunc(Number(body.multiPV) || 5))),
  };
}

function parseOutput(text) {
  const completed = new Map();
  let current = null;
  let finalMove = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let match;
    if ((match = line.match(/^INFO PV (\d+)$/))) {
      current = {
        rank: Number(match[1]) + 1,
        depth: 0,
        eval: null,
        mate: null,
        winRate: null,
        pv: [],
      };
    } else if (current && (match = line.match(/^INFO DEPTH (\d+)$/)))
      current.depth = Number(match[1]);
    else if (current && (match = line.match(/^INFO EVAL ([+-]?\d+)$/)))
      current.eval = Number(match[1]);
    else if (current && (match = line.match(/^INFO EVAL ([+-])M(\d+|\*)$/)))
      current.mate =
        match[2] === "*"
          ? match[1] === "+"
            ? "win"
            : "loss"
          : (match[1] === "+" ? 1 : -1) * Number(match[2]);
    else if (current && (match = line.match(/^INFO WINRATE ([\d.]+)$/)))
      current.winRate = Number(match[1]);
    else if (current && (match = line.match(/^INFO BESTLINE (.+)$/))) {
      current.pv = [...match[1].matchAll(/(\d+),(\d+)/g)].map((item) => [
        Number(item[1]),
        Number(item[2]),
      ]);
    } else if (current && line === "INFO PV DONE") {
      if (
        current.pv.length &&
        (current.eval != null ||
          current.mate != null ||
          current.winRate != null)
      )
        completed.set(current.rank, current);
      current = null;
    } else if ((match = line.match(/^(\d+),(\d+)$/)))
      finalMove = [Number(match[1]), Number(match[2])];
  }
  const lines = [...completed.values()].sort((a, b) => a.rank - b.rank);
  if (!lines.length && finalMove)
    lines.push({
      rank: 1,
      depth: 0,
      eval: null,
      mate: null,
      winRate: null,
      pv: [finalMove],
    });
  return lines;
}

function analyze(options, request) {
  if (!options.stones.length)
    return Promise.resolve({
      lines: [
        {
          rank: 1,
          depth: 0,
          eval: null,
          mate: null,
          winRate: null,
          pv: [[7, 7]],
        },
      ],
      timedOut: false,
    });

  return new Promise((resolveAnalysis, reject) => {
    const child = spawn(binary, [], {
      cwd: runtimeDir,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let errorOutput = "";
    let timedOut = false;
    let settled = false;
    const commands = [
      "START 15",
      "YXSHOWINFO",
      `INFO RULE ${options.rule}`,
      `INFO TIMEOUT_TURN ${options.timeMs}`,
      `INFO MAX_DEPTH ${options.maxDepth}`,
      "INFO SHOW_DETAIL 2",
      `INFO THREAD_NUM ${threadCount}`,
      "YXBOARD",
      ...options.stones.map((stone) => `${stone.x},${stone.y},${stone.player}`),
      "DONE",
      `YXNBEST ${options.multiPV}`,
      "",
    ].join("\n");

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      request.off("aborted", cancel);
      if (error) reject(error);
      else resolveAnalysis({ lines: parseOutput(output), timedOut });
    };
    const cancel = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        child.kill("SIGTERM");
      }
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeMs + 4500);

    // IncomingMessage's normal `close` event also fires after a successfully
    // received request body. Treating it as cancellation killed Rapfi while
    // leaving the HTTP promise unsettled, so the browser stayed in "thinking"
    // forever. Only an actually aborted request cancels the child process.
    request.on("aborted", cancel);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });
    child.on("error", (error) =>
      finish(new Error(`无法启动 Rapfi：${error.message}`)),
    );
    child.on("close", (code) => {
      const lines = parseOutput(output);
      if (!timedOut && code && !lines.length)
        finish(new Error(errorOutput.trim() || `Rapfi 异常退出（${code}）`));
      else finish();
    });
    child.stdin.end(commands);
  });
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") return send(response, 204, {});
  if (request.method === "GET" && request.url === "/health")
    return send(response, 200, {
      ok: true,
      engine: "Rapfi",
      port,
      threads: threadCount,
    });
  if (request.method !== "POST" || request.url !== "/analyze")
    return send(response, 404, { error: "未找到接口" });
  try {
    const options = validate(await readBody(request));
    const result = await analyze(options, request);
    if (!response.writableEnded) send(response, 200, result);
  } catch (error) {
    if (!response.writableEnded)
      send(response, 400, {
        error: error instanceof Error ? error.message : "分析失败",
      });
  }
});

server.listen(port, "127.0.0.1", () =>
  console.log(`Rapfi 本地服务：http://127.0.0.1:${port}（${threadCount} 线程）`),
);
