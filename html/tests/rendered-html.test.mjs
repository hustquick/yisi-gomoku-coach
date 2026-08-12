import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("服务端稳定渲染五子棋教练首屏", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>弈思五子棋教练<\/title>/);
  assert.match(html, /15乘15五子棋棋盘/);
  assert.match(html, /人机对战/);
  assert.match(html, /摆盘/);
  assert.match(html, /自由五子棋/);
  assert.match(html, /连珠/);
  assert.match(html, /局势图/);
  assert.match(html, /显示全局最优落点/);
  assert.match(html, /分析深度/);
  assert.match(html, /历史局面滑块/);
  assert.match(html, /aria-label="横行编号"/);
  assert.match(html, /aria-label="纵行字母"/);
  assert.doesNotMatch(html, /Math\.random|Date\.now/);
});

test("首屏包含完整的 225 个可交互落点", async () => {
  const html = await (await render()).text();
  assert.equal((html.match(/class="point /g) ?? []).length, 225);
  assert.match(html, /aria-label="A15空位"/);
  assert.match(html, /aria-label="O1空位"/);
});

test("候选按当前行棋方评分从高到低排列", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function sortCandidates/);
  assert.match(page, /candidateStrength\(right\) - candidateStrength\(left\)/);
  assert.match(page, /sortCandidates\(result\.lines \?\? \[\]\)/);
  assert.match(page, /按行棋方评分从高到低/);
  assert.match(page, /boardFlipped \? index \+ 1 : 15 - index/);
  assert.match(page, /boardFlipped \? \[\.\.\.labels\]\.reverse\(\) : labels/);
  assert.match(page, /left: `\$\{\(\(x \+ 0\.5\) \/ 15\) \* 100\}%`/);
  assert.match(page, /top: `\$\{\(\(y \+ 0\.5\) \/ 15\) \* 100\}%`/);
  assert.match(css, /\.stars\s*\{[\s\S]*?inset:\s*0/);
  assert.ok(
    page.indexOf('className="board-hint"') <
      page.indexOf('className="play-settings panel"'),
    "play settings should follow the board",
  );
});

test("强制胜法优先于普通优势文案", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /const forcedPosition = forcedOutcome/);
  assert.match(page, /方胜势/);
  assert.match(page, /Rapfi 已算出强制胜法/);
  assert.match(page, /blackWinRate >= 0\.9\) return "黑方胜势"/);
  assert.match(page, /blackWinRate <= 0\.1\) return "白方胜势"/);
  assert.match(page, /return "局势均衡"/);
});

test("棋盘和行棋工具先于低频设置出现", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.ok(page.indexOf('className="board-toolbar"') < page.indexOf('title="对弈与分析设置"'));
  assert.ok(page.indexOf('className="board-stage"') < page.indexOf('title="对弈与分析设置"'));
  assert.match(page, /className="panel-column"/);
  assert.ok(page.indexOf('className="panel-column"') < page.indexOf('title="教练分析"'));
  assert.match(css, /\.settings-module>\.collapsible-module\{order:3\}/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 760px\) minmax\(320px, 1fr\)/);
  assert.match(css, /\.panel-column \.play-settings\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /\.panel-column \.play-settings \.setting-group\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /@media \(max-width: 850px\)[\s\S]*?\.workspace\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});
