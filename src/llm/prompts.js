export const SYSTEM_PROMPT = `你是 Tutorial DSL 生成器。你必须只输出合法 JSON。禁止 markdown。target 必须 anchor 优先。每个 step 都要 success_criteria 和 fallback。`;

export const userPrompt = ({ userQuestion, snapshot }) => `
[UserQuestion]\n${userQuestion}\n
[Constraints]\nanchor 优先，不可编造，必须 success_criteria，必须 fallback。\n
[Snapshot]\n${JSON.stringify(snapshot)}\n`;

export const repairPrompt = ({ failedStep, snapshot }) => `
[FailedStep]\n${JSON.stringify(failedStep)}\n
[Snapshot]\n${JSON.stringify(snapshot)}\n`;

export const selfFixPrompt = ({ errors, previous }) => `
[Errors]\n${JSON.stringify(errors)}\n
[Previous]\n${JSON.stringify(previous)}\n`;
