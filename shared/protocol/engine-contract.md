# Rapfi 统一引擎契约

上层应用不直接解析平台进程或 JNI 细节，只收发以下逻辑消息。

## 请求

```json
{
  "type": "analyze",
  "requestId": 1,
  "rules": "freestyle",
  "boardSize": 15,
  "moves": [[7, 7], [7, 8]],
  "limit": { "kind": "time", "value": 1500 },
  "multiPV": 5,
  "searchMoves": []
}
```

另有 `stop`、`legalMoves`、`play` 和 `reset` 请求。每个分析结果必须携带原始 `requestId`；UI 只接受当前任务的结果。

## 结果

```json
{
  "type": "analysis",
  "requestId": 1,
  "state": "complete",
  "depth": 18,
  "nodes": 1200000,
  "lines": [
    {
      "rank": 1,
      "move": [8, 7],
      "score": 0.42,
      "scoreKind": "normalized",
      "pv": [[8, 7], [6, 7], [8, 8]]
    }
  ]
}
```

`state` 可为 `thinking`、`complete`、`timeout`、`cancelled` 或 `error`。超时和错误不得附带伪造评分。

## Piskvork 映射

- 初始化：`START 15`
- 提交局面：`BOARD`，逐行发送 `x,y,player`，以 `DONE` 结束
- 单步应着：`TURN x,y`
- 终止搜索：`YXSTOP`（若当前构建支持扩展）或销毁并重建会话
- 引擎配置：通过 `INFO` 和 Rapfi/Yixin 扩展设置规则、线程、内存与思考限制

最终实现前须用所固定 Rapfi 版本的协议文档逐项验证扩展命令。

