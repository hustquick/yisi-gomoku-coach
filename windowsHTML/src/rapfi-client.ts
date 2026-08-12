type Player = 1 | 2;

type Stone = {
  x: number;
  y: number;
  player: Player;
};

type AnalyzeOptions = {
  stones: Stone[];
  rule: "freestyle" | "standard" | "renju";
  maxDepth: number;
  timeMs: number;
  multiPV: number;
};

type EngineLine = {
  rank: number;
  depth: number;
  eval: number | null;
  mate: number | "win" | "loss" | null;
  winRate: number | null;
  pv: [number, number][];
};

type AnalyzeResult = {
  lines: EngineLine[];
  timedOut: boolean;
};

declare global {
  interface Window {
    Rapfi?: (options?: Record<string, unknown>) => Promise<unknown>;
  }
}

let workerUrl: string | null = null;

function createWorkerUrl() {
  if (workerUrl) return workerUrl;
  if (typeof window.Rapfi !== "function")
    throw new Error("找不到随软件提供的 Rapfi 引擎文件 rapfi.js");

  const factorySource = window.Rapfi.toString();
  const source = String.raw`
var _scriptName = self.location.href;
const Rapfi = ${factorySource};
let activeOutput = [];

function parseOutput(text) {
  const completed = new Map();
  let current = null;
  let finalMove = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let match;
    if ((match = line.match(/^INFO PV (\d+)$/))) {
      current = { rank: Number(match[1]) + 1, depth: 0, eval: null, mate: null, winRate: null, pv: [] };
    } else if (current && (match = line.match(/^INFO DEPTH (\d+)$/))) {
      current.depth = Number(match[1]);
    } else if (current && (match = line.match(/^INFO EVAL ([+-]?\d+)$/))) {
      current.eval = Number(match[1]);
    } else if (current && (match = line.match(/^INFO EVAL ([+-])M(\d+|\*)$/))) {
      current.mate = match[2] === "*"
        ? (match[1] === "+" ? "win" : "loss")
        : (match[1] === "+" ? 1 : -1) * Number(match[2]);
    } else if (current && (match = line.match(/^INFO WINRATE ([\d.]+)$/))) {
      current.winRate = Number(match[1]);
    } else if (current && (match = line.match(/^INFO BESTLINE (.+)$/))) {
      current.pv = Array.from(match[1].matchAll(/(\d+),(\d+)/g), item => [Number(item[1]), Number(item[2])]);
    } else if (current && line === "INFO PV DONE") {
      if (current.pv.length && (current.eval != null || current.mate != null || current.winRate != null))
        completed.set(current.rank, current);
      current = null;
    } else if ((match = line.match(/^(\d+),(\d+)$/))) {
      finalMove = [Number(match[1]), Number(match[2])];
    }
  }
  const lines = Array.from(completed.values()).sort((a, b) => a.rank - b.rank);
  if (!lines.length && finalMove)
    lines.push({ rank: 1, depth: 0, eval: null, mate: null, winRate: null, pv: [finalMove] });
  return lines;
}

const enginePromise = Rapfi({
  onReceiveStdout(line) { activeOutput.push(String(line)); },
  onReceiveStderr(line) { activeOutput.push(String(line)); },
  onExit() {},
});

self.onmessage = async event => {
  const { id, options } = event.data;
  try {
    const engine = await enginePromise;
    activeOutput = [];
    const ruleCodes = { freestyle: 0, standard: 1, renju: 2 };
    const commands = [
      "START 15",
      "YXSHOWINFO",
      "INFO RULE " + ruleCodes[options.rule],
      "INFO TIMEOUT_TURN " + options.timeMs,
      "INFO MAX_DEPTH " + options.maxDepth,
      "INFO SHOW_DETAIL 2",
      "INFO THREAD_NUM 1",
      "YXBOARD\n" + options.stones.map(stone => stone.x + "," + stone.y + "," + stone.player).join("\n") + "\nDONE",
      "YXNBEST " + options.multiPV,
    ];
    for (const command of commands) engine.sendCommand(command);
    self.postMessage({ id, ok: true, result: { lines: parseOutput(activeOutput.join("\n")), timedOut: false } });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error && error.message ? error.message : String(error) });
  }
};
`;
  workerUrl = URL.createObjectURL(
    new Blob([source], { type: "text/javascript;charset=utf-8" }),
  );
  return workerUrl;
}

let requestSequence = 0;

export function analyzePosition(
  options: AnalyzeOptions,
  signal?: AbortSignal,
): Promise<AnalyzeResult> {
  if (signal?.aborted) return Promise.reject(new DOMException("已取消", "AbortError"));

  const id = ++requestSequence;
  const worker = new Worker(createWorkerUrl());
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutMs = Math.max(8000, options.timeMs + 12000);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    };
    const abort = () =>
      finish(() => reject(new DOMException("已取消", "AbortError")));
    const timeout = window.setTimeout(
      () =>
        finish(() =>
          reject(new Error("Rapfi 分析超时，未生成猜测性评分。")),
        ),
      timeoutMs,
    );

    signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = (event) =>
      finish(() => reject(new Error(event.message || "Rapfi 工作线程启动失败")));
    worker.onmessage = (event) => {
      const payload = event.data;
      if (payload?.id !== id) return;
      if (payload.ok)
        finish(() => resolve(payload.result as AnalyzeResult));
      else finish(() => reject(new Error(payload.error || "Rapfi 分析失败")));
    };
    worker.postMessage({ id, options });
  });
}

