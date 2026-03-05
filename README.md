# Runtime UI Tutorial Tool (MVP)

一个可运行的前端 MVP：用户输入“怎么导出？”，系统基于运行时 UI snapshot 自动生成并执行交互式教程。

## Run

```bash
python3 -m http.server 4173
# open http://localhost:4173/demo/
```

## Included

- Snapshot 提取：`src/snapshot/extractSnapshot.js`
- DSL 校验：`src/dsl/validateDsl.js`
- 教程生成（mock LLM）：`src/llm/mockLlm.js`
- Runner 状态机：`src/runner/Runner.js`
- Overlay 引导层：`src/overlay/Overlay.js`
- Self-healing：`src/heal/healTarget.js`
