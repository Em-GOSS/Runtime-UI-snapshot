# AI 生成交互式新手教程（MVP-1, Web DOM）Core + Adapter 蓝图

## A. 平台分类与覆盖策略（Web/Electron 为 MVP）

### A1. 目标与范围（MVP-1）
- **30 秒可演示目标**：用户在页面中输入一句“怎么导出？”，系统在当前页基于运行时 UI snapshot 即时生成教程并开始执行（遮罩 + 高亮 + 步骤提示 + 点击推进），可完成“导出”流程。
- **方法约束**：
  1. 仅基于运行时 UI snapshot 生成教程，不依赖仓库源码解析。
  2. Anchor 优先（`data-tour` > `data-testid`/`aria-label`/`id` > `text+role`）。
  3. LLM 输出为可校验 DSL（JSON Schema 强约束）。
  4. Self-healing 为一等公民（UI 改动时自动修复，必要时用户确认）。

### A2. 明确不做（MVP-1）
- 不做源码语义解析（AST/仓库扫描）。
- 不做多框架一次性适配（React/Vue/Svelte 统一行为由 DOM adapter 覆盖）。
- 不做录屏与回放系统。
- 不做复杂权限/RBAC 系统。
- 不做跨端渲染引擎（Unity/Qt 只定义协议与能力边界）。

### A3. “适配所有”的边界定义（可观察 UI）
- “适配所有”指：**任何平台只要能提供可观察 UI 树 + 可定位目标 + 可绘制引导层 + 事件订阅**，就可接入 Core。
- 不要求平台暴露源码结构；只要求运行态能力协议（见 B）。
- 无法提供稳定标识时，允许降级到相似度匹配与用户确认。

### A4. 平台分层策略
- **MVP**：Web DOM / Electron（Chromium DOM，可复用同一 adapter）。
- **Next**：移动端 WebView（仍走 DOM adapter）。
- **Future**：Unity/Qt/Native，通过实现协议的 platform adapter 接入 Core。

---

## B. 跨平台协议定义（Snapshotter / Locator / Overlay+Event 三接口）

> Core 只依赖协议，不直接依赖具体平台 API。

### B1. TypeScript 接口签名（最小能力协议）

```ts
export type NodeRef = string; // 平台内唯一稳定引用（运行时）

export interface UISnapshot {
  meta: {
    platform: 'web' | 'electron' | 'unity' | 'qt' | 'other';
    appId: string;
    route?: string;
    url?: string;
    title?: string;
    timestamp: string; // ISO
    viewport: { width: number; height: number; dpr?: number };
  };
  elements: UIElement[]; // 已压缩，仅候选交互节点 + 少量上下文
}

export interface UIElement {
  nodeRef: NodeRef;
  role?: string;
  text?: string;
  value?: string;
  anchor?: {
    dataTour?: string;
    dataTestid?: string;
    ariaLabel?: string;
    id?: string;
    accessibilityId?: string; // 跨平台等价
  };
  locatorHints: {
    cssPath?: string;
    xpath?: string;
    hierarchyPath?: string; // 跨平台层级路径
  };
  bounds: { x: number; y: number; width: number; height: number };
  state: {
    visible: boolean;
    enabled?: boolean;
    clickable?: boolean;
    focusable?: boolean;
  };
  context?: {
    containerTitle?: string;
    prevText?: string;
    nextText?: string;
    siblings?: string[];
  };
}

export interface Snapshotter {
  extractSnapshot(options?: {
    maxElements?: number;
    includeNonInteractive?: boolean;
  }): Promise<UISnapshot>;
}

export type LocatorStrategy =
  | { kind: 'anchor'; key: 'data-tour' | 'data-testid' | 'aria-label' | 'id' | 'accessibility-id'; value: string }
  | { kind: 'css'; value: string }
  | { kind: 'xpath'; value: string }
  | { kind: 'textRole'; text: string; role?: string }
  | { kind: 'hierarchy'; value: string };

export interface LocateResult {
  matched: boolean;
  confidence: number; // 0..1
  nodeRef?: NodeRef;
  bounds?: { x: number; y: number; width: number; height: number };
  candidates?: Array<{ nodeRef: NodeRef; confidence: number; reason: string }>;
  reason?: string;
}

export interface Locator {
  locate(target: {
    primary: LocatorStrategy;
    alternates?: LocatorStrategy[];
  }): Promise<LocateResult>;
}

export interface OverlayRenderer {
  showStep(payload: {
    title: string;
    instruction: string;
    targetBounds?: { x: number; y: number; width: number; height: number };
    arrow?: { from: 'top' | 'bottom' | 'left' | 'right'; offset?: number };
    controls: { next: boolean; back: boolean; exit: boolean };
    progress: { index: number; total: number };
  }): Promise<void>;
  showCandidatePicker(payload: {
    candidates: Array<{ nodeRef: NodeRef; bounds: { x: number; y: number; width: number; height: number }; label: string }>;
    message: string;
  }): Promise<NodeRef | null>;
  clear(): Promise<void>;
}

export interface EventBus {
  onUserClick(cb: (evt: { x: number; y: number; nodeRef?: NodeRef }) => void): () => void;
  onUserInput(cb: (evt: { nodeRef?: NodeRef; value: string }) => void): () => void;
  onDomChanged(cb: (evt: { changedNodeRefs: NodeRef[] }) => void): () => void;
  onRouteChanged(cb: (evt: { route?: string; url?: string }) => void): () => void;
}
```

### B2. Core 模块（平台无关）
- `snapshotter-client`：调 adapter 抽取快照。
- `llm-client`：生成 DSL / 修复 DSL / 修复 target。
- `schema-validator`：AJV 校验 + 错误回传。
- `runner-state-machine`：步骤执行与状态流转。
- `healer`：分层修复策略与用户确认编排。

---

## C. 通用 UISnapshot 格式与压缩规则

### C1. extractSnapshot() 返回 JSON（精简）
- 返回 `meta + elements[]`，不返回完整 DOM 串。
- `elements[]` 限制：默认最多 120 个（MVP demo 可设 40）。
- 每个元素仅保留：
  - `nodeRef`
  - `role/text/value`
  - `anchor`
  - `locatorHints`
  - `bounds`
  - `state`
  - `context`（邻居文本、容器标题）

### C2. 可交互元素筛选规则
1. 语义角色命中：`button | link | textbox | searchbox | combobox | menuitem | checkbox | radio | tab | switch | option`。
2. 标签命中：`button, a[href], input, select, textarea, [contenteditable=true]`。
3. 事件命中：有点击/提交行为（平台可观测）。
4. 可见性：`display!=none`、`visibility!=hidden`、尺寸 > 0、未被完全裁剪。
5. 可操作性：未禁用、未 `aria-disabled=true`、可指针交互。

### C3. Anchor 强制优先级
1. `data-tour`
2. `data-testid`
3. `aria-label`
4. `id`
5. `text + role` 组合（低优先，需附带容器上下文）

### C4. Snapshot 示例（<=15 元素）

```json
{
  "meta": {
    "platform": "web",
    "appId": "runtime-ui-demo",
    "route": "/projects",
    "url": "https://demo.local/projects",
    "title": "Projects",
    "timestamp": "2026-03-05T10:00:00.000Z",
    "viewport": { "width": 1440, "height": 900, "dpr": 2 }
  },
  "elements": [
    {
      "nodeRef": "n1",
      "role": "button",
      "text": "新建项目",
      "anchor": { "dataTour": "project-create-btn", "dataTestid": "btn-create-project" },
      "locatorHints": { "cssPath": "button[data-tour='project-create-btn']", "hierarchyPath": "root/header/actions[0]" },
      "bounds": { "x": 1180, "y": 80, "width": 120, "height": 36 },
      "state": { "visible": true, "enabled": true, "clickable": true },
      "context": { "containerTitle": "项目列表" }
    },
    {
      "nodeRef": "n2",
      "role": "textbox",
      "text": "",
      "anchor": { "dataTour": "project-name-input", "ariaLabel": "项目名称" },
      "locatorHints": { "cssPath": "input[data-tour='project-name-input']", "hierarchyPath": "root/modal/form[0]/field[0]" },
      "bounds": { "x": 520, "y": 260, "width": 400, "height": 40 },
      "state": { "visible": true, "enabled": true, "clickable": true, "focusable": true },
      "context": { "containerTitle": "新建项目" }
    },
    {
      "nodeRef": "n3",
      "role": "button",
      "text": "保存",
      "anchor": { "dataTour": "project-save-btn", "dataTestid": "btn-save-project" },
      "locatorHints": { "cssPath": "button[data-tour='project-save-btn']", "hierarchyPath": "root/modal/footer/actions[1]" },
      "bounds": { "x": 840, "y": 620, "width": 80, "height": 36 },
      "state": { "visible": true, "enabled": true, "clickable": true },
      "context": { "containerTitle": "新建项目", "prevText": "取消" }
    }
  ]
}
```

---

## D. Tutorial DSL 格式 + JSON Schema

### D1. DSL 结构
- 顶层：`version/title/user_goal/prerequisites/steps`。
- `steps[]`：每一步都必须有：
  - `target`（主策略 + 候选策略）
  - `action`（`click/input/hover/wait`）
  - `instruction`（短句）
  - `success_criteria`（必须，可观测）
  - `fallback`（找不到目标时）

### D2. 完整 JSON Schema（draft-07）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://runtime-ui.dev/schema/tutorial-dsl.v1.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "title", "user_goal", "steps"],
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "title": { "type": "string", "minLength": 1, "maxLength": 120 },
    "user_goal": { "type": "string", "minLength": 1, "maxLength": 200 },
    "prerequisites": {
      "type": "array",
      "items": { "type": "string", "maxLength": 120 },
      "maxItems": 10
    },
    "steps": {
      "type": "array",
      "minItems": 1,
      "maxItems": 20,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "target", "action", "instruction", "success_criteria", "fallback"],
        "properties": {
          "id": { "type": "string", "pattern": "^[a-zA-Z0-9_-]{1,40}$" },
          "target": {
            "type": "object",
            "additionalProperties": false,
            "required": ["primary"],
            "properties": {
              "primary": { "$ref": "#/definitions/locatorStrategy" },
              "alternates": {
                "type": "array",
                "items": { "$ref": "#/definitions/locatorStrategy" },
                "maxItems": 5
              }
            }
          },
          "action": {
            "type": "object",
            "additionalProperties": false,
            "required": ["type"],
            "properties": {
              "type": { "type": "string", "enum": ["click", "input", "hover", "wait"] },
              "value": { "type": "string", "maxLength": 200 },
              "timeout_ms": { "type": "integer", "minimum": 0, "maximum": 30000 }
            }
          },
          "instruction": { "type": "string", "minLength": 1, "maxLength": 160 },
          "success_criteria": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": { "$ref": "#/definitions/successCriteria" }
          },
          "fallback": {
            "type": "object",
            "additionalProperties": false,
            "required": ["on_not_found"],
            "properties": {
              "on_not_found": {
                "type": "string",
                "enum": ["try_alternates", "heal_target", "ask_user_pick", "abort"]
              },
              "hint": { "type": "string", "maxLength": 200 }
            }
          }
        }
      }
    }
  },
  "definitions": {
    "locatorStrategy": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind"],
      "properties": {
        "kind": {
          "type": "string",
          "enum": ["anchor", "css", "xpath", "textRole", "hierarchy"]
        },
        "key": {
          "type": "string",
          "enum": ["data-tour", "data-testid", "aria-label", "id", "accessibility-id"]
        },
        "value": { "type": "string", "minLength": 1, "maxLength": 300 },
        "text": { "type": "string", "minLength": 1, "maxLength": 120 },
        "role": { "type": "string", "minLength": 1, "maxLength": 60 }
      },
      "allOf": [
        {
          "if": { "properties": { "kind": { "const": "anchor" } } },
          "then": { "required": ["key", "value"] }
        },
        {
          "if": { "properties": { "kind": { "enum": ["css", "xpath", "hierarchy"] } } },
          "then": { "required": ["value"] }
        },
        {
          "if": { "properties": { "kind": { "const": "textRole" } } },
          "then": { "required": ["text"] }
        }
      ]
    },
    "successCriteria": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["element_visible", "element_value", "route_is", "text_present", "network_done"]
        },
        "target": { "$ref": "#/definitions/locatorStrategy" },
        "value": { "type": "string", "maxLength": 200 },
        "url": { "type": "string", "maxLength": 300 },
        "request_key": { "type": "string", "maxLength": 120 },
        "timeout_ms": { "type": "integer", "minimum": 0, "maximum": 30000 }
      },
      "allOf": [
        {
          "if": { "properties": { "type": { "const": "element_visible" } } },
          "then": { "required": ["target"] }
        },
        {
          "if": { "properties": { "type": { "const": "element_value" } } },
          "then": { "required": ["target", "value"] }
        },
        {
          "if": { "properties": { "type": { "const": "route_is" } } },
          "then": { "required": ["url"] }
        },
        {
          "if": { "properties": { "type": { "const": "text_present" } } },
          "then": { "required": ["value"] }
        },
        {
          "if": { "properties": { "type": { "const": "network_done" } } },
          "then": { "required": ["request_key"] }
        }
      ]
    }
  }
}
```

### D3. DSL 示例（创建项目并保存）

```json
{
  "version": "1.0",
  "title": "创建项目并保存",
  "user_goal": "创建一个新项目并完成保存",
  "prerequisites": ["已进入项目列表页"],
  "steps": [
    {
      "id": "open_create_modal",
      "target": {
        "primary": { "kind": "anchor", "key": "data-tour", "value": "project-create-btn" },
        "alternates": [
          { "kind": "anchor", "key": "data-testid", "value": "btn-create-project" },
          { "kind": "textRole", "text": "新建项目", "role": "button" }
        ]
      },
      "action": { "type": "click" },
      "instruction": "点击“新建项目”按钮。",
      "success_criteria": [
        {
          "type": "element_visible",
          "target": { "kind": "anchor", "key": "data-tour", "value": "project-name-input" },
          "timeout_ms": 5000
        }
      ],
      "fallback": { "on_not_found": "heal_target", "hint": "检查顶部操作区中的新建按钮" }
    },
    {
      "id": "fill_name",
      "target": {
        "primary": { "kind": "anchor", "key": "data-tour", "value": "project-name-input" },
        "alternates": [
          { "kind": "anchor", "key": "aria-label", "value": "项目名称" }
        ]
      },
      "action": { "type": "input", "value": "MVP Demo 项目" },
      "instruction": "输入项目名称。",
      "success_criteria": [
        {
          "type": "element_value",
          "target": { "kind": "anchor", "key": "data-tour", "value": "project-name-input" },
          "value": "MVP Demo 项目"
        }
      ],
      "fallback": { "on_not_found": "try_alternates" }
    },
    {
      "id": "save_project",
      "target": {
        "primary": { "kind": "anchor", "key": "data-tour", "value": "project-save-btn" },
        "alternates": [
          { "kind": "anchor", "key": "data-testid", "value": "btn-save-project" },
          { "kind": "textRole", "text": "保存", "role": "button" }
        ]
      },
      "action": { "type": "click" },
      "instruction": "点击“保存”。",
      "success_criteria": [
        { "type": "text_present", "value": "创建成功", "timeout_ms": 8000 },
        { "type": "route_is", "url": "/projects" }
      ],
      "fallback": { "on_not_found": "ask_user_pick", "hint": "请选择弹窗底部的保存按钮" }
    }
  ]
}
```

---

## E. Self-healing 机制：多层策略 + 用户确认流程 + 返回结构

### E1. 自愈输入/输出 JSON

**输入（heal request）**
```json
{
  "failed_step": {
    "id": "save_project",
    "old_target": {
      "primary": { "kind": "anchor", "key": "data-tour", "value": "project-save-btn" },
      "alternates": [{ "kind": "textRole", "text": "保存", "role": "button" }]
    },
    "old_context": {
      "text": "保存",
      "role": "button",
      "bounds": { "x": 840, "y": 620, "width": 80, "height": 36 },
      "containerTitle": "新建项目"
    }
  },
  "current_snapshot": { "meta": {}, "elements": [] }
}
```

**输出（heal response）**
```json
{
  "resolved": true,
  "new_target": {
    "primary": { "kind": "anchor", "key": "data-testid", "value": "btn-save" },
    "alternates": [{ "kind": "textRole", "text": "保存项目", "role": "button" }]
  },
  "confidence": 0.89,
  "strategy": "L2",
  "candidates": [
    {
      "target": { "kind": "anchor", "key": "data-testid", "value": "btn-save" },
      "confidence": 0.89,
      "reason": "文本相似 + 角色一致 + 容器匹配"
    }
  ],
  "requires_user_confirmation": false
}
```

### E2. 分层策略
- **L1 Anchor 重定位**：同 key/value 精确匹配；若 key 不变 value 变化，尝试前缀/后缀归一。
- **L2 语义相似匹配**：`role + text` 相似度（编辑距离、token overlap）+ 层级路径相似。
- **L3 上下文匹配**：邻居元素、容器标题、相对位置（例如“弹窗底部右侧按钮”）。
- **L4 用户确认**：候选 >=2 且 top1 置信度不足时，展示候选高亮让用户点选。

### E3. 用户确认流程
1. Runner 进入 `repairing`。
2. Healer 返回 `candidates[]`。
3. Overlay 高亮候选 + 编号。
4. 用户点击确认；更新 step.target.primary，并记录修复映射（session cache）。
5. 回到 `running` 继续当前 step。

### E4. 两个自愈示例
- **示例 1（找不到 -> 自动修复成功）**：`data-tour=project-save-btn` 改成 `data-testid=btn-save`，L2 命中“保存项目”按钮，confidence=0.89，自动替换成功。
- **示例 2（多个候选 -> 用户确认）**：页面同时有“保存草稿/保存并发布”，L2 返回两个候选（0.62/0.58），触发 L4，用户点“保存并发布”，写回新 target。

---

## F. Web DOM Adapter 详细设计（注入 / snapshot / 定位 / 监听）

### F1. 注入方式
- 以 JS SDK 注入到业务页面（`window.TutorialRuntime`）。
- 在 `document` 上挂载 overlay root（`position: fixed; inset: 0; pointer-events: none`）。
- 控件层（next/back/exit）子层开启 `pointer-events: auto`。

### F2. Snapshot 提取（extractSnapshot）
1. 扫描可交互候选（规则见 C2）。
2. 过滤不可见/不可点击节点。
3. 提取 anchor、文本、角色、bbox、上下文。
4. 生成稳定 `nodeRef`（如 hash(anchor+path+index)）。
5. 限流与去重（同 bbox + 同文本保留最高 anchor 质量）。

### F3. 定位（Locator）
- `anchor`：`querySelector([data-tour='x'])` 等。
- `css/xpath`：直接查询。
- `textRole`：按 role 过滤后文本归一匹配。
- 输出 `LocateResult`：单命中、多候选、未命中。

### F4. 监听变化（EventBus）
- 用户点击：捕获阶段监听 `click`，记录 target node。
- 输入：监听 `input/change`。
- DOM 变化：`MutationObserver`（属性/子树变更）。
- 路由变化：hook `history.pushState/replaceState` + `popstate`。
- 网络完成：可选 hook `fetch/XMLHttpRequest`（用于 `network_done` criteria）。

### F5. Runner 状态机
- `idle`：未运行。
- `running`：执行当前 step 定位与渲染。
- `awaiting_user`：等待用户完成交互。
- `repairing`：目标失效，触发 healer。
- `completed`：全部 step 成功。
- `failed`：超时/不可修复/用户退出。

### F6. 事件模型与 success_criteria 判定
- `click`：匹配点击目标或其后置可观测结果。
- `input`：目标 value 变化达到期望。
- `route_is`：路由变化命中。
- `text_present`：页面文本出现。
- `network_done`：指定请求标识完成。

### F7. Overlay 组件规格
- `mask`：全屏半透明，目标区域挖洞。
- `highlightRect`：目标描边 + 呼吸动画。
- `tooltip`：步骤文案 + 进度。
- `arrow`：指向目标。
- `controls`：next/back/exit（可按 step 配置）。

### F8. 错误处理
- 目标找不到：先 alternates，再 healer。
- 多候选：置信度差小于阈值时要求用户确认。
- 用户点错：toast 提示并保留当前 step。
- 页面突变：自动重定位一次，失败进入 repairing。

---

## G. 后续适配 Unity/Qt 的 adapter 能力要求（无代码）

### G1. Unity Adapter 必需能力
- 导出可观察 UI 树（节点 id、文本、role/控件类型、可交互状态）。
- 导出屏幕坐标系下 `bounds`。
- 支持 anchor 等价物（例如 `tutorialId`、`automationId`）。
- 支持节点定位查询（by anchor / by text+type / by hierarchy）。
- 支持事件订阅（点击、输入、界面切换）。
- 支持引导层绘制（遮罩/高亮/提示）。

### G2. Qt Adapter 必需能力
- 可访问性树（QAccessible 或等价）导出。
- 控件 objectName/accessibilityName 作为 anchor 来源。
- 控件几何信息与可见性状态。
- 信号监听（clicked/textChanged/stackChanged）。
- overlay 绘制通道（顶层透明窗口或应用内层）。

### G3. 接入检查清单
- 是否实现 `Snapshotter/Locator/OverlayRenderer/EventBus` 四对象。
- 是否能提供稳定 nodeRef 与 bbox。
- 是否能在 100ms~300ms 内完成一次 locate。
- 是否能在 UI 变化后 1s 内重建 snapshot。

### G4. Repo 结构（MVP-1 可直接落地）

```text
/runtime-ui-tutorial/
  /packages/core/
    src/protocol/types.ts                # 跨平台协议类型
    src/dsl/schema.json                  # Tutorial DSL Schema
    src/dsl/validateDsl.ts               # AJV 校验与错误格式化
    src/llm/prompts.ts                   # system/user/repair/self-fix 提示词模板
    src/runner/Runner.ts                 # 状态机与执行编排
    src/runner/successCriteria.ts        # criteria 判定器
    src/heal/healTarget.ts               # L1-L4 自愈流程
    src/heal/scoring.ts                  # 相似度评分
  /packages/adapter-web/
    src/inject/bootstrap.ts              # 注入入口
    src/snapshot/extractSnapshot.ts      # DOM 快照提取
    src/locator/locate.ts                # 定位实现
    src/events/eventBus.ts               # click/input/dom/route 监听
    src/overlay/Overlay.ts               # mask/highlight/tooltip/arrow
  /apps/demo/
    index.html                           # 演示页
    main.ts                              # SDK 接线与 demo 流程
```

### G5. 每文件职责（仅职责）
- `types.ts`：定义 Core 与 Adapter 交互协议。
- `schema.json`：DSL 结构约束与枚举规则。
- `validateDsl.ts`：校验/错误聚合/自动修复入口。
- `prompts.ts`：LLM prompt 套件。
- `Runner.ts`：状态机、步骤推进、异常分支。
- `successCriteria.ts`：可观测成功条件判断。
- `healTarget.ts`：分层修复与用户确认调用。
- `scoring.ts`：文本/结构/上下文相似度计算。
- `bootstrap.ts`：web adapter 初始化与挂载。
- `extractSnapshot.ts`：候选元素筛选与快照压缩。
- `locate.ts`：多策略定位与候选输出。
- `eventBus.ts`：统一事件订阅接口。
- `Overlay.ts`：引导 UI 绘制与交互控制。
- `apps/demo/*`：MVP 端到端演示。

---

## H. 5 条验收标准（Definition of Done）

1. **30 秒演示通过**：输入“怎么导出？”后 3 秒内出现第一步引导；用户按步骤点击可完成导出闭环。
2. **Anchor 命中率**：存在 `data-tour` 时，step 定位命中率 ≥ 95%。
3. **无 Anchor 自愈**：移除主 anchor 后，L2/L3 可在 2 秒内给出候选；置信度不足时触发用户确认流程。
4. **Schema 守卫有效**：LLM 输出不符合 schema 时，自动进入“自修复提示词”重试，最多 2 次；仍失败则阻断执行并报错。
5. **状态机健壮性**：覆盖 `idle/running/awaiting_user/repairing/completed/failed` 全路径，出现 DOM 突变时不会崩溃，可恢复或明确失败。

---

## LLM Prompt 套件（可直接用）

### 1) System Prompt（强约束，仅 JSON）

```text
你是 Tutorial DSL 生成器。你必须只输出一个合法 JSON 对象，且必须符合给定 JSON Schema。
禁止输出 markdown、解释、注释、代码块围栏。
必须满足：
1) 只使用 snapshot 中真实存在的信息，不可编造不存在的元素或路由。
2) target 必须 anchor 优先：data-tour > data-testid > aria-label > id > textRole。
3) 每个 step 必须包含：target, action, instruction, success_criteria, fallback。
4) action.type 仅允许 click/input/hover/wait。
5) success_criteria.type 仅允许 element_visible/element_value/route_is/text_present/network_done。
6) 如果信息不足，减少步骤数量，不要臆造。
输出内容必须可被 JSON.parse 直接解析。
```

### 2) User Prompt 模板（教程生成）

```text
[Task]
根据用户问题和当前 UISnapshot 生成教程 DSL。

[UserQuestion]
{{userQuestion}}

[Constraints]
- Anchor 优先级：data-tour > data-testid > aria-label > id > textRole。
- 不能使用 snapshot 中不存在的元素。
- 每个 step 必须有 success_criteria，且必须可观测。
- 每个 step 必须有 fallback（on_not_found）。
- 步骤尽量短，适合新手逐步点击。

[UISnapshot]
{{snapshotJson}}

[Output]
返回符合 schema 的 JSON。
```

### 3) Repair Prompt 模板（step 失效自愈）

```text
你是目标修复器。根据失效步骤和当前 snapshot，输出修复结果 JSON。
禁止 markdown。

[FailedStep]
{{failedStepJson}}

[CurrentSnapshot]
{{snapshotJson}}

[Rules]
- 优先尝试 anchor 重定位。
- 若失败，使用 role+text+hierarchy+context 进行候选匹配。
- 返回字段：resolved, new_target, confidence, strategy, candidates, requires_user_confirmation。
- 若候选不唯一且置信度接近，requires_user_confirmation=true。
- 不可编造 snapshot 中不存在的元素。
```

### 4) JSON 校验失败自修复提示词模板

```text
你上一次输出的 JSON 未通过 Schema 校验。请修复并仅输出修复后的 JSON。
禁止 markdown。

[SchemaValidationErrors]
{{errorsJson}}

[PreviousOutput]
{{previousJson}}

[Requirements]
- 严格修复报错字段类型、缺失 required 字段、非法枚举值。
- 保持原意，不要增加与 snapshot 不相关的新步骤。
- 输出必须可被 JSON.parse 且通过同一 schema 校验。
```

