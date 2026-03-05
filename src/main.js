import { extractSnapshot } from './snapshot/extractSnapshot.js';
import { generateTutorialDsl } from './llm/mockLlm.js';
import { validateDsl } from './dsl/validateDsl.js';
import { Overlay } from './overlay/Overlay.js';
import { Runner } from './runner/Runner.js';

const askBtn = document.querySelector('#ask-btn');
const questionInput = document.querySelector('#question-input');
const snapshotPre = document.querySelector('#snapshot');
const dslPre = document.querySelector('#dsl');
const statusEl = document.querySelector('#status');

const overlay = new Overlay();
const runner = new Runner({ overlay, snapshotProvider: () => extractSnapshot() });

window.addEventListener('tutorial:state', (e) => {
  statusEl.textContent = `状态: ${e.detail}`;
});

askBtn.addEventListener('click', async () => {
  const question = questionInput.value.trim() || '怎么导出？';
  const snapshot = extractSnapshot();
  snapshotPre.textContent = JSON.stringify(snapshot, null, 2);

  const dsl = await generateTutorialDsl({ userQuestion: question, snapshot });
  const res = validateDsl(dsl);
  if (!res.valid) {
    statusEl.textContent = `DSL 校验失败: ${res.errors.join('; ')}`;
    dslPre.textContent = JSON.stringify(dsl, null, 2);
    return;
  }

  dslPre.textContent = JSON.stringify(dsl, null, 2);
  statusEl.textContent = '状态: running';
  runner.start(dsl);
});

// demo app behavior
const exportBtn = document.querySelector('[data-tour="export-btn"]');
const modal = document.querySelector('#export-modal');
const confirm = document.querySelector('[data-tour="confirm-export-btn"]');
const format = document.querySelector('[data-tour="format-select"]');
const toast = document.querySelector('#toast');

exportBtn.addEventListener('click', () => {
  modal.hidden = false;
});

confirm.addEventListener('click', () => {
  modal.hidden = true;
  toast.textContent = `导出任务已创建（${format.value}）`;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 2200);
});
