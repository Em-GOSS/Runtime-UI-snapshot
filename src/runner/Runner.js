import { healTarget } from '../heal/healTarget.js';

export class Runner {
  constructor({ overlay, snapshotProvider }) {
    this.overlay = overlay;
    this.snapshotProvider = snapshotProvider;
    this.state = 'idle';
    this.dsl = null;
    this.stepIndex = 0;
  }

  async start(dsl) {
    this.dsl = dsl;
    this.stepIndex = 0;
    this.state = 'running';
    this.bindControls();
    this.runCurrentStep();
  }

  bindControls() {
    this.overlay.onControl((act) => {
      if (act === 'next') this.next();
      if (act === 'back') this.back();
      if (act === 'exit') this.stop('failed');
    });
  }

  locate(strategy) {
    if (!strategy) return null;
    if (strategy.kind === 'anchor') {
      const map = {
        'data-tour': `[data-tour="${strategy.value}"]`,
        'data-testid': `[data-testid="${strategy.value}"]`,
        'aria-label': `[aria-label="${strategy.value}"]`,
        'id': `#${CSS.escape(strategy.value)}`,
      };
      return document.querySelector(map[strategy.key]);
    }
    if (strategy.kind === 'textRole') {
      const nodes = Array.from(document.querySelectorAll('button,a,input,[role]'));
      return nodes.find((n) => (n.innerText || n.textContent || '').includes(strategy.text));
    }
    if (strategy.kind === 'css') return document.querySelector(strategy.value);
    return null;
  }

  async runCurrentStep() {
    const step = this.dsl.steps[this.stepIndex];
    if (!step) return this.stop('completed');

    let targetEl = this.locate(step.target.primary);
    if (!targetEl && step.target.alternates) {
      for (const alt of step.target.alternates) {
        targetEl = this.locate(alt);
        if (targetEl) break;
      }
    }

    if (!targetEl) {
      this.state = 'repairing';
      const healed = healTarget({ failedStep: step, snapshot: this.snapshotProvider() });
      if (!healed.resolved) return this.stop('failed');
      if (healed.requires_user_confirmation) {
        this.overlay.showCandidatePicker(healed.candidates, (picked) => {
          step.target.primary = picked.target;
          this.state = 'running';
          this.runCurrentStep();
        });
        return;
      }
      step.target.primary = healed.new_target.primary;
      this.state = 'running';
      return this.runCurrentStep();
    }

    const rect = targetEl.getBoundingClientRect();
    this.overlay.showStep({ title: this.dsl.title, instruction: step.instruction, rect });
    this.state = 'awaiting_user';

    const handler = () => {
      targetEl.removeEventListener('click', handler);
      this.next();
    };

    if (step.action.type === 'click') {
      targetEl.addEventListener('click', handler, { once: true });
    }
  }

  next() {
    this.stepIndex += 1;
    this.state = 'running';
    this.runCurrentStep();
  }

  back() {
    this.stepIndex = Math.max(0, this.stepIndex - 1);
    this.state = 'running';
    this.runCurrentStep();
  }

  stop(state = 'failed') {
    this.state = state;
    this.overlay.clear();
    window.dispatchEvent(new CustomEvent('tutorial:state', { detail: state }));
  }
}
