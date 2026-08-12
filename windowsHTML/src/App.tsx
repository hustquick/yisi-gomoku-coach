"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { analyzePosition } from "./rapfi-client";

function Collapsible({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [expanded, setExpanded] = useState(open);
  return <details className="collapsible-module" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}><summary>{title}</summary><div className="collapsible-content">{children}</div></details>;
}

type Player = 1 | 2;
type Stone = { x: number; y: number; player: Player };
type EvaluationPoint = {
  ply: number;
  score: number;
  result?: Player;
  forcedWinner?: Player;
  mateIn?: number | null;
};
type Mode = "local" | "computer" | "setup";
type Rule = "freestyle" | "standard" | "renju";
type EngineLine = {
  rank: number;
  depth: number;
  eval: number | null;
  mate: number | "win" | "loss" | null;
  winRate: number | null;
  pv: [number, number][];
};
type Analysis = {
  state: "idle" | "thinking" | "ready" | "timeout" | "error";
  lines: EngineLine[];
  message?: string;
  refining?: boolean;
};

const labels = "ABCDEFGHIJKLMNO".split("");
const depthOptions = [8, 10, 12, 14, 16];
const depthBudgets: Record<number, number> = {
  8: 1800,
  10: 3000,
  12: 5500,
  14: 9000,
  16: 15000,
  18: 18000,
  20: 20000,
};
const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

function key(x: number, y: number) {
  return `${x}-${y}`;
}
function pointName([x, y]: [number, number]) {
  return `${labels[x]}${15 - y}`;
}

function winner(stones: Stone[]) {
  const map = new Map(
    stones.map((stone) => [key(stone.x, stone.y), stone.player]),
  );
  for (const stone of stones)
    for (const [dx, dy] of directions) {
      let count = 1;
      for (const sign of [-1, 1])
        for (let step = 1; step < 5; step++) {
          if (
            map.get(
              key(stone.x + dx * step * sign, stone.y + dy * step * sign),
            ) !== stone.player
          )
            break;
          count++;
        }
      if (count >= 5) return stone.player;
    }
  return null;
}

// Nine complete rounds are at most eighteen individual moves. Stop the
// demonstration as soon as either side has completed five in a row.
function previewVariation(
  pv: [number, number][],
  stones: Stone[],
  sideToMove: Player,
) {
  const position = [...stones];
  const variation: [number, number][] = [];
  for (const [index, point] of pv.slice(0, 18).entries()) {
    if (position.some((stone) => stone.x === point[0] && stone.y === point[1]))
      break;
    const player: Player = index % 2 === 0 ? sideToMove : sideToMove === 1 ? 2 : 1;
    position.push({ x: point[0], y: point[1], player });
    variation.push(point);
    if (winner(position)) break;
  }
  return variation;
}

function winText(rate: number | null) {
  return rate == null ? "待计算" : `${Math.round(rate * 100)}%`;
}
function positionJudgment(blackWinRate: number | null) {
  if (blackWinRate == null) return "等待可靠评分";
  if (blackWinRate >= 0.9) return "黑方胜势";
  if (blackWinRate >= 0.65) return "黑方优势";
  if (blackWinRate > 0.53) return "黑方稍优";
  if (blackWinRate <= 0.1) return "白方胜势";
  if (blackWinRate <= 0.35) return "白方优势";
  if (blackWinRate < 0.47) return "白方稍优";
  return "局势均衡";
}
function scoreText(score: number) {
  return `${score >= 0 ? "+" : ""}${(score / 100).toFixed(2)}`;
}
function evaluationText(point: EvaluationPoint) {
  if (point.result) return `${point.result === 1 ? "黑" : "白"}胜`;
  if (point.forcedWinner)
    return `${point.forcedWinner === 1 ? "黑" : "白"}胜势${point.mateIn ? `（${point.mateIn}手）` : ""}`;
  return scoreText(point.score);
}
function forcedOutcome(line: EngineLine | undefined, sideToMove: Player) {
  if (!line?.mate) return null;
  const positive =
    line.mate === "win" || (typeof line.mate === "number" && line.mate > 0);
  const winner = positive ? sideToMove : sideToMove === 1 ? 2 : 1;
  return {
    winner: winner as Player,
    mateIn: typeof line.mate === "number" ? Math.abs(line.mate) : null,
  };
}
function blackPerspectiveLineScoreText(line: EngineLine, sideToMove: Player) {
  const forced = forcedOutcome(line, sideToMove);
  if (forced)
    return `${forced.winner === 1 ? "黑" : "白"}胜势${forced.mateIn ? ` M${forced.mateIn}` : ""}`;
  if (line.eval == null) return "待计算";
  return scoreText(sideToMove === 1 ? line.eval : -line.eval);
}

function candidateScoreText(line: EngineLine) {
  if (line.mate === "win" || (typeof line.mate === "number" && line.mate > 0))
    return `本方胜势${typeof line.mate === "number" ? ` M${line.mate}` : ""}`;
  if (line.mate === "loss" || (typeof line.mate === "number" && line.mate < 0))
    return `本方败势${typeof line.mate === "number" ? ` M${Math.abs(line.mate)}` : ""}`;
  return line.eval == null ? "待计算" : scoreText(line.eval);
}

function candidateStrength(line: EngineLine) {
  if (line.mate === "win") return 1_000_000;
  if (typeof line.mate === "number" && line.mate > 0)
    return 1_000_000 - line.mate;
  if (line.mate === "loss") return -1_000_000;
  if (typeof line.mate === "number" && line.mate < 0)
    return -1_000_000 + Math.abs(line.mate);
  if (line.eval != null) return line.eval;
  if (line.winRate != null) return (line.winRate - 0.5) * 1000;
  return Number.NEGATIVE_INFINITY;
}

function sortCandidates(lines: EngineLine[]) {
  return [...lines].sort(
    (left, right) =>
      candidateStrength(right) - candidateStrength(left) ||
      right.depth - left.depth ||
      left.rank - right.rank,
  );
}

function ScoreChart({
  scores,
  historyLength,
  activePly,
  onSelect,
}: {
  scores: EvaluationPoint[];
  historyLength: number;
  activePly: number;
  onSelect: (ply: number) => void;
}) {
  const width = 1000,
    height = 250,
    left = 76,
    right = 970,
    top = 25,
    bottom = 205;
  const maxPly = Math.max(1, historyLength);
  const largest = scores
    .filter((point) => !point.result && !point.forcedWinner)
    .reduce((maximum, point) => Math.max(maximum, Math.abs(point.score)), 0);
  const range = Math.max(300, Math.ceil(largest / 100) * 100);
  const position = (point: EvaluationPoint) => ({
    x: left + (point.ply / maxPly) * (right - left),
    y:
      (top + bottom) / 2 -
      ((point.result === 1 || point.forcedWinner === 1
        ? 1
        : point.result === 2 || point.forcedWinner === 2
          ? -1
          : Math.max(-range, Math.min(range, point.score)) / range) *
        (bottom - top)) /
        2,
  });
  const sorted = [...scores]
    .filter((point) => point.ply <= historyLength)
    .sort((a, b) => a.ply - b.ply);
  const path = sorted
    .map((point, index) => {
      const spot = position(point);
      return `${index ? "L" : "M"}${spot.x},${spot.y}`;
    })
    .join(" ");
  const current = sorted.find((point) => point.ply === activePly);
  return (
    <section className="trend panel">
      <div className="situation-heading">
        <div className="panel-title">
          <span>02</span>
          <div>
            <strong>局势图</strong>
            <small>POSITION TREND</small>
          </div>
        </div>
        <em>
          第 {activePly} 手后 · 黑方视角{" "}
          {current ? evaluationText(current) : "计算中"}
        </em>
      </div>
      <p>
        曲线高于零线表示黑优，低于零线表示白优；点击评分点或拖动下方滑块可回到任意一步。
      </p>
      <svg
        className="score-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Rapfi 局势评分曲线"
      >
        {[-1, -0.5, 0, 0.5, 1].map((fraction) => {
          const y = (top + bottom) / 2 - (fraction * (bottom - top)) / 2,
            value = range * fraction;
          return (
            <g key={fraction}>
              <line
                x1={left}
                y1={y}
                x2={right}
                y2={y}
                className={fraction === 0 ? "zero-line" : "grid-line"}
              />
              <text x={left - 12} y={y + 5} textAnchor="end">
                {scoreText(value)}
              </text>
            </g>
          );
        })}
        <text x={left} y={16} className="black-advantage">
          黑优
        </text>
        <text x={left} y={height - 8} className="white-advantage">
          白优
        </text>
        {path && <path d={path} className="score-path" />}
        {sorted.map((point) => {
          const spot = position(point),
            active = point.ply === activePly;
          return (
            <g
              key={point.ply}
              className={`score-point ${active ? "active" : ""}`}
              onClick={() => onSelect(point.ply)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  onSelect(point.ply);
              }}
            >
              <circle cx={spot.x} cy={spot.y} r={active ? 9 : 5} />
              <text x={spot.x} y={spot.y - 12} textAnchor="middle">
                {evaluationText(point)}
              </text>
            </g>
          );
        })}
        {!sorted.length && (
          <text
            x={(left + right) / 2}
            y={(top + bottom) / 2}
            textAnchor="middle"
            className="chart-empty"
          >
            正在计算首个局面分数…
          </text>
        )}
      </svg>
      <div className="timeline-control">
        <span>开局</span>
        <input
          aria-label="历史局面滑块"
          type="range"
          min="0"
          max={historyLength}
          value={Math.min(activePly, historyLength)}
          onChange={(event) => onSelect(Number(event.target.value))}
        />
        <span>第 {historyLength} 手</span>
      </div>
    </section>
  );
}

export default function Home() {
  const [stones, setStones] = useState<Stone[]>([]);
  const [mode, setMode] = useState<Mode>("local");
  const [rule, setRule] = useState<Rule>("freestyle");
  const [turn, setTurn] = useState<Player>(1);
  const [human, setHuman] = useState<Player>(1);
  const [setupBrush, setSetupBrush] = useState<"erase" | Player>(1);
  const [analysisDepth, setAnalysisDepth] = useState(10);
  const [analysis, setAnalysis] = useState<Analysis>({
    state: "idle",
    lines: [],
  });
  const [previewLine, setPreviewLine] = useState<EngineLine | null>(null);
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [scores, setScores] = useState<EvaluationPoint[]>([]);
  const [backfillVersion, setBackfillVersion] = useState(0);
  const [history, setHistory] = useState<Stone[]>([]);
  const [showBest, setShowBest] = useState(false);
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const requestRef = useRef(0);
  const gameWinner = winner(stones);
  const gameDraw = !gameWinner && stones.length >= 225;
  const occupied = useMemo(
    () => new Map(stones.map((stone) => [key(stone.x, stone.y), stone])),
    [stones],
  );
  const previewPv = useMemo(
    () => previewVariation(previewLine?.pv ?? [], stones, turn),
    [previewLine, stones, turn],
  );

  useEffect(() => {
    if (mode === "setup" || gameWinner || gameDraw) {
      const idleTimer = window.setTimeout(
        () => setAnalysis({ state: "idle", lines: [] }),
        0,
      );
      return () => window.clearTimeout(idleTimer);
    }
    const id = ++requestRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAnalysis({ state: "thinking", lines: [] });
      let retainedLines: EngineLine[] = [];
      try {
        const refinementDepths = [
          analysisDepth,
          Math.min(20, analysisDepth + 2),
          Math.min(20, analysisDepth + 4),
        ].filter((depth, index, values) => values.indexOf(depth) === index);
        for (const [pass, targetDepth] of refinementDepths.entries()) {
          const result = await analyzePosition({
            stones,
            rule,
            maxDepth: targetDepth,
            timeMs: depthBudgets[targetDepth],
            multiPV: 5,
          }, controller.signal);
          if (id !== requestRef.current) return;
          const lines: EngineLine[] = sortCandidates(result.lines ?? []);
          if (lines.length) retainedLines = lines;
          const hasMore =
            !result.timedOut && pass < refinementDepths.length - 1;
          setAnalysis({
            state: result.timedOut ? "timeout" : "ready",
            lines: retainedLines,
            refining: hasMore,
            message: result.timedOut
              ? "Rapfi 超时，保留最后一个完整深度的结果，不写入猜测分数。"
              : hasMore
                ? `已完成深度 ${retainedLines[0]?.depth ?? targetDepth}，等待落子期间继续加深。`
                : undefined,
          });
          const first = retainedLines[0];
          const forced = forcedOutcome(first, turn);
          if (first && (first.eval != null || forced)) {
            const blackScore =
              first.eval == null ? 0 : turn === 1 ? first.eval : -first.eval;
            setScores((current) =>
              [
                ...current.filter(
                  (point) =>
                    point.ply !== stones.length && point.ply <= history.length,
                ),
                {
                  ply: stones.length,
                  score: blackScore,
                  forcedWinner: forced?.winner,
                  mateIn: forced?.mateIn,
                },
              ].sort((a, b) => a.ply - b.ply),
            );
          }
          if (result.timedOut) break;
          if (hasMore)
            await new Promise((resolve) => window.setTimeout(resolve, 250));
        }
      } catch (error) {
        if (controller.signal.aborted || id !== requestRef.current) return;
        setAnalysis(
          retainedLines.length
            ? {
                state: "ready",
                lines: retainedLines,
                message: "继续加深被中断，当前显示最后一个完整深度的可靠结果。",
              }
            : {
                state: "error",
                lines: [],
                message:
                  error instanceof Error ? error.message : "Rapfi 引擎不可用",
              },
        );
      }
    }, 140);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [stones, rule, analysisDepth, mode, gameWinner, gameDraw, turn, history.length]);

  useEffect(() => {
    if (
      mode === "setup" ||
      (analysis.state !== "ready" && !gameWinner) ||
      !history.length
    )
      return;
    const scoredPlies = new Set(scores.map((point) => point.ply));
    const missingPly = Array.from(
      { length: history.length + 1 },
      (_, ply) => ply,
    ).find((ply) => ply !== stones.length && !scoredPlies.has(ply));
    if (missingPly == null) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await analyzePosition({
          stones: history.slice(0, missingPly),
          rule,
          maxDepth: Math.min(10, analysisDepth),
          timeMs: depthBudgets[Math.min(10, analysisDepth)],
          multiPV: 1,
        }, controller.signal);
        const first = (result.lines?.[0] ?? null) as EngineLine | null;
        const sideAtPly: Player = missingPly % 2 === 0 ? 1 : 2;
        const forced = forcedOutcome(first ?? undefined, sideAtPly);
        if (first && (first.eval != null || forced)) {
          setScores((current) =>
            [
              ...current.filter((point) => point.ply !== missingPly),
              {
                ply: missingPly,
                score:
                  first.eval == null
                    ? 0
                    : sideAtPly === 1
                      ? first.eval
                      : -first.eval,
                forcedWinner: forced?.winner,
                mateIn: forced?.mateIn,
              },
            ].sort((a, b) => a.ply - b.ply),
          );
        } else {
          window.setTimeout(
            () => setBackfillVersion((version) => version + 1),
            1200,
          );
        }
      } catch {
        if (!controller.signal.aborted)
          window.setTimeout(
            () => setBackfillVersion((version) => version + 1),
            1600,
          );
      }
    }, 700);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    analysis.state,
    analysisDepth,
    backfillVersion,
    gameWinner,
    history,
    mode,
    rule,
    scores,
    stones.length,
  ]);

  useEffect(() => {
    if (
      mode !== "computer" ||
      turn === human ||
      analysis.state !== "ready" ||
      !analysis.lines[0]?.pv[0] ||
      gameWinner
    )
      return;
    const [x, y] = analysis.lines[0].pv[0];
    const timer = window.setTimeout(() => place(x, y, true), 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, turn, human, analysis, gameWinner]);

  useEffect(() => {
    if (!previewLine) return;
    const timer = window.setInterval(
      () =>
        setPreviewIndex((index) => {
          if (index >= previewPv.length - 1) {
            window.clearInterval(timer);
            return index;
          }
          return index + 1;
        }),
      700,
    );
    return () => window.clearInterval(timer);
  }, [previewLine, previewPv.length]);

  function place(x: number, y: number, fromEngine = false) {
    if (occupied.has(key(x, y)) || gameWinner || gameDraw) return;
    if (mode === "computer" && turn !== human && !fromEngine) return;
    const player = turn;
    const move = { x, y, player };
    const nextStones = [...stones, move];
    const result = winner(nextStones);
    if (result || nextStones.length >= 225) setOutcomeOpen(true);
    setStones(nextStones);
    setHistory((current) => [...current.slice(0, stones.length), move]);
    setScores((current) => {
      const retained = current.filter((point) => point.ply <= stones.length);
      return result
        ? [...retained, { ply: nextStones.length, score: 0, result }]
        : retained;
    });
    setTurn(player === 1 ? 2 : 1);
    setPreviewLine(null);
    setPreviewIndex(-1);
  }

  function clickPoint(x: number, y: number) {
    if (mode !== "setup") {
      place(x, y);
      return;
    }
    if (setupBrush === "erase")
      setStones((current) =>
        current.filter((stone) => stone.x !== x || stone.y !== y),
      );
    else
      setStones((current) => [
        ...current.filter((stone) => stone.x !== x || stone.y !== y),
        { x, y, player: setupBrush },
      ]);
  }

  function goToPly(ply: number) {
    const target = Math.max(0, Math.min(history.length, ply));
    const position = history.slice(0, target);
    setStones(position);
    setTurn(position.at(-1)?.player === 1 ? 2 : 1);
    setPreviewLine(null);
    setPreviewIndex(-1);
  }
  function reset() {
    requestRef.current++;
    setOutcomeOpen(false);
    setStones([]);
    setHistory([]);
    setTurn(1);
    setScores([]);
    setPreviewLine(null);
    setPreviewIndex(-1);
  }
  function undo() {
    if (!stones.length) return;
    requestRef.current++;
    goToPly(stones.length - 1);
  }

  function finishSetup() {
    setHistory(stones);
    setScores([]);
    setMode("local");
  }

  const sideWinRate = analysis.lines[0]?.winRate;
  const forcedPosition = forcedOutcome(analysis.lines[0], turn);
  const blackWinRate =
    sideWinRate != null ? (turn === 1 ? sideWinRate : 1 - sideWinRate) : null;
  const previewPoints = new Map(
    previewPv
      .slice(0, previewIndex + 1)
      .map((point, index) => [key(...point), index]),
  );

  return (
    <main>
      <header>
        <div className="brand">
          <span>五</span>
          <div>
            <strong>弈思五子棋教练</strong>
            <small>Rapfi 离线分析 · Windows HTML</small>
          </div>
        </div>
        <div className={`engine-state ${analysis.state}`}>
          <i />
          {analysis.state === "thinking"
            ? "Rapfi 正在分析"
            : analysis.state === "ready"
              ? analysis.refining
                ? "Rapfi 继续加深中"
                : "Rapfi 已就绪"
              : analysis.state === "timeout"
                ? "Rapfi 已返回最后结果"
                : analysis.state === "error"
                  ? "Rapfi 引擎加载失败"
                  : "等待局面"}
        </div>
      </header>

      <section className="workspace">
        <div className="board-column">
          <div className="board-toolbar">
            <strong>
              {gameWinner
                ? `${gameWinner === 1 ? "黑" : "白"}方胜`
                : `${turn === 1 ? "黑" : "白"}方走棋`}
            </strong>
            <button
              className={`best-toggle ${showBest ? "active" : ""}`}
              onClick={() => setShowBest((value) => !value)}
              disabled={!analysis.lines.length}
              aria-pressed={showBest}
              aria-label={showBest ? "隐藏全局最优落点" : "显示全局最优落点"}
            >
              优
            </button>
            <div>
              <button onClick={() => setBoardFlipped((value) => !value)}>
                ⇅ 视角
              </button>
              <button
                onClick={() => goToPly(stones.length - 1)}
                disabled={!stones.length}
              >
                ‹ 上一步
              </button>
              <button
                onClick={() => goToPly(stones.length + 1)}
                disabled={stones.length >= history.length}
              >
                下一步 ›
              </button>
              <button onClick={undo} disabled={!stones.length}>
                ↶ 悔棋
              </button>
              <button onClick={reset}>↻ 重开</button>
            </div>
          </div>
          <div className="board-stage">
            <div className="coordinates rows" aria-label="横行编号">
              {Array.from({ length: 15 }, (_, index) =>
                boardFlipped ? index + 1 : 15 - index,
              ).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="board" aria-label="15乘15五子棋棋盘">
              <div className="stars">
                {[
                  [3, 3],
                  [11, 3],
                  [7, 7],
                  [3, 11],
                  [11, 11],
                ].map(([x, y]) => (
                  <i
                    key={key(x, y)}
                    style={{
                      left: `${((x + 0.5) / 15) * 100}%`,
                      top: `${((y + 0.5) / 15) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <div className="board-grid">
                {Array.from({ length: 225 }, (_, index) => {
                  const visualX = index % 15,
                    visualY = Math.floor(index / 15),
                    x = boardFlipped ? 14 - visualX : visualX,
                    y = boardFlipped ? 14 - visualY : visualY,
                    stone = occupied.get(key(x, y)),
                    pvIndex = previewPoints.get(key(x, y));
                  const previewPlayer =
                    pvIndex == null
                      ? null
                      : pvIndex % 2 === 0
                        ? turn
                        : turn === 1
                          ? 2
                          : 1;
                  const candidate = analysis.lines.findIndex(
                    (line) => line.pv[0]?.[0] === x && line.pv[0]?.[1] === y,
                  );
                  return (
                    <button
                      key={index}
                      onClick={() => clickPoint(x, y)}
                      aria-label={`${labels[x]}${15 - y}${stone ? (stone.player === 1 ? "黑子" : "白子") : "空位"}`}
                      className={`point ${showBest && candidate === 0 ? "best" : showBest && candidate > 0 ? "candidate" : ""}`}
                    >
                      {stone && (
                        <b className={stone.player === 1 ? "black" : "white"}>
                          {stones.findIndex((item) => item === stone) ===
                            stones.length - 1 && <em />}
                        </b>
                      )}
                      {!stone && pvIndex != null && previewPlayer != null && (
                        <b
                          className={`${previewPlayer === 1 ? "black" : "white"} preview-stone ${pvIndex === 0 ? "candidate-move" : "continuation-move"} ${pvIndex === previewIndex ? "current-preview-stone" : ""}`}
                          aria-hidden="true"
                        >
                          <span className="preview-number">
                            {Math.floor(pvIndex / 2) + 1}
                          </span>
                        </b>
                      )}
                      {!stone && showBest && candidate >= 0 && (
                        <span className="candidate-number">
                          {candidate + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="coordinates rows right" aria-hidden="true">
              {Array.from({ length: 15 }, (_, index) =>
                boardFlipped ? index + 1 : 15 - index,
              ).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
          <div className="coordinates files" aria-label="纵行字母">
            {(boardFlipped ? [...labels].reverse() : labels).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {mode === "setup" ? (
            <div className="setup-tools">
              <strong>摆盘工具</strong>
              <button
                className={setupBrush === 1 ? "active black-tool" : ""}
                onClick={() => setSetupBrush(1)}
              >
                ● 黑子
              </button>
              <button
                className={setupBrush === 2 ? "active" : ""}
                onClick={() => setSetupBrush(2)}
              >
                ○ 白子
              </button>
              <button
                className={setupBrush === "erase" ? "active" : ""}
                onClick={() => setSetupBrush("erase")}
              >
                删除
              </button>
              <button onClick={() => setTurn((value) => (value === 1 ? 2 : 1))}>
                {turn === 1 ? "黑方先行" : "白方先行"}
              </button>
              <button onClick={finishSetup}>完成摆盘</button>
            </div>
          ) : (
            <p className="board-hint">
              {analysis.state === "thinking" || analysis.refining
                ? `深度 ${analysis.lines[0]?.depth ?? analysisDepth} ${analysis.refining ? "已有结果，继续加深中" : "思考中"}；仍可落子，新局面会自动取消旧分析。`
                : previewLine
                  ? "候选变化最多推演 9 回合；数字 1、1、2、2…表示每回合双方的落子，任一方获胜时自动停止。"
                  : showBest
                    ? "绿色为 Rapfi 首选，数字表示全局候选顺序。"
                    : "点击棋盘上方的“优”，显示全局候选落点。"}
            </p>
          )}
        </div>

        <div className="panel-column">
          <div className="settings-module"><Collapsible title="对弈与分析设置"><section className="play-settings panel" aria-label="对弈方式与规则">
            <div className="setting-group">
              <div className="setting-heading">
                <span>局</span>
                <div>
                  <strong>对弈方式</strong>
                  <small>选择练习方式</small>
                </div>
              </div>
              <div className="segmented-control">
                {(["local", "computer", "setup"] as Mode[]).map((value) => (
                  <button
                    key={value}
                    className={mode === value ? "active" : ""}
                    onClick={() => {
                      setMode(value);
                      setPreviewLine(null);
                      setPreviewIndex(-1);
                    }}
                  >
                    {value === "local"
                      ? "双人对弈"
                      : value === "computer"
                        ? "人机对战"
                        : "摆盘"}
                  </button>
                ))}
              </div>
              {mode === "computer" && (
                <button
                  className="side-chip"
                  onClick={() => setHuman((value) => (value === 1 ? 2 : 1))}
                >
                  我执{human === 1 ? "黑" : "白"}
                </button>
              )}
            </div>
            <div className="setting-divider" />
            <div className="setting-group rule-setting">
              <div className="setting-heading">
                <span>规</span>
                <div>
                  <strong>行棋规则</strong>
                  <small>切换后重新分析</small>
                </div>
              </div>
              <div className="segmented-control">
                {(["freestyle", "standard", "renju"] as Rule[]).map((value) => (
                  <button
                    key={value}
                    className={rule === value ? "active" : ""}
                    onClick={() => setRule(value)}
                  >
                    {value === "freestyle"
                      ? "自由五子棋"
                      : value === "standard"
                        ? "标准五子棋"
                        : "连珠"}
                  </button>
                ))}
              </div>
            </div>
          </section></Collapsible></div>

        <Collapsible title="教练分析" open><aside className="analysis panel">
          <div className="panel-title">
            <span>01</span>
            <div>
              <strong>教练分析</strong>
              <small>COACH REVIEW</small>
            </div>
          </div>
          <div className="position-card">
            <span>
              {gameWinner
                ? "终局"
                : analysis.state === "ready"
                  ? "已评分"
                  : "分析"}
            </span>
            <div>
              <strong>
                {gameWinner
                  ? "对局结束"
                  : forcedPosition
                    ? `${forcedPosition.winner === 1 ? "黑" : "白"}方胜势`
                    : positionJudgment(blackWinRate)}
              </strong>
              <small>
                {gameWinner
                  ? `${gameWinner === 1 ? "黑" : "白"}方已形成五连，终局结果优先于引擎普通分数。`
                  : forcedPosition
                    ? `Rapfi 已算出强制胜法${forcedPosition.mateIn ? `，预计 ${forcedPosition.mateIn} 手` : ""}；不再按普通胜率描述为“稍优”。`
                    : blackWinRate == null
                      ? "Rapfi 返回后显示局面倾向"
                      : `黑方胜率 ${winText(blackWinRate)} · 白方胜率 ${winText(1 - blackWinRate)}`}
              </small>
            </div>
            <b>
              {gameWinner
                ? `${gameWinner === 1 ? "黑" : "白"}胜`
                : forcedPosition
                  ? "胜"
                  : blackWinRate == null
                    ? "—"
                    : `${Math.round(blackWinRate * 100)}`}
            </b>
          </div>
          {analysis.message && <p className="warning">{analysis.message}</p>}
          <div className="best-summary">
            <span>全局最优着法</span>
            {analysis.lines[0] ? (
              <>
                <strong className={`candidate-notation ${turn === 1 ? "black-move" : "white-move"}`}>
                  {pointName(analysis.lines[0].pv[0])}
                </strong>
                <small>
                  黑方视角{" "}
                  {blackPerspectiveLineScoreText(analysis.lines[0], turn)} ·
                  深度 {analysis.lines[0].depth}
                </small>
              </>
            ) : (
              <strong>—</strong>
            )}
          </div>
          <label>Rapfi 候选 · 按行棋方评分从高到低</label>
          <div className="candidate-list">
            {analysis.lines.map((line, index) => (
              <button
                key={index}
                className={previewLine === line ? "active" : ""}
                onClick={() => {
                  setPreviewLine(line);
                  setPreviewIndex(0);
                }}
                onDoubleClick={() => {
                  const point = line.pv[0];
                  if (point) place(point[0], point[1]);
                }}
                title={`单击演示变化，双击走 ${pointName(line.pv[0])}`}
              >
                <i>{index + 1}</i>
                <strong className={`candidate-notation ${turn === 1 ? "black-move" : "white-move"}`}>
                  {pointName(line.pv[0])}
                </strong>
                <span>{index === 0 ? "最佳" : "候选"}</span>
                <b>{candidateScoreText(line)}</b>
                <small>
                  胜率 {winText(line.winRate)} ·{" "}
                  {line.pv.slice(0, 5).map(pointName).join(" → ")}
                </small>
              </button>
            ))}
          </div>
          {!analysis.lines.length && (
            <div className="empty-analysis">
              {analysis.state === "thinking"
                ? "正在计算候选着法…"
                : analysis.state === "error"
                  ? "引擎不可用，因此不生成猜测性评分。"
                  : "落子后将在这里显示候选着法。"}
            </div>
          )}
        </aside></Collapsible>

        <Collapsible title="局势图"><ScoreChart
          scores={scores}
          historyLength={history.length}
          activePly={stones.length}
          onSelect={goToPly}
        /></Collapsible>
        <div className="settings-anchor" />

        <Collapsible title="分析深度"><section className="strength panel">
        <div>
          <strong>分析深度</strong>
          <small>选择后立即从当前局面重新计算；深度越高越准确，也越耗时</small>
        </div>
        <div>
          {depthOptions.map((value) => (
            <button
              key={value}
              className={analysisDepth === value ? "active" : ""}
              onClick={() => setAnalysisDepth(value)}
              aria-pressed={analysisDepth === value}
            >
              {value}
            </button>
          ))}
        </div>
        </section></Collapsible>
        </div>
      </section>

      <footer>
        <div>
          <b>{stones.length}</b>
          <span>已走手数</span>
        </div>
        <div>
          <b>
            {mode === "computer" ? "人机" : mode === "setup" ? "摆盘" : "双人"}
          </b>
          <span>当前模式</span>
        </div>
        <p>Rapfi 本地计算 · 断网可用 · GPL-3.0</p>
      </footer>
      {(gameWinner || gameDraw) && outcomeOpen && <div className="result-backdrop"><section className="result-modal" role="alertdialog" aria-modal="true" aria-labelledby="result-title"><div className="result-mark">胜</div><h2 id="result-title">{gameWinner ? `${gameWinner === 1 ? "黑" : "白"}方获胜` : "和棋"}</h2><p>{gameWinner ? `${gameWinner === 1 ? "黑" : "白"}方率先连成五子。` : "棋盘已满，双方均未形成五连。"}</p><div><button className="primary" onClick={reset}>再来一局</button><button onClick={() => setOutcomeOpen(false)}>查看棋局</button></div></section></div>}
    </main>
  );
}
