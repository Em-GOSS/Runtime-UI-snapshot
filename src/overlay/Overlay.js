export class Overlay {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'tour-overlay';
    this.root.innerHTML = `
      <div class="tour-mask"></div>
      <div class="tour-highlight"></div>
      <div class="tour-tooltip">
        <div class="tour-title"></div>
        <div class="tour-instruction"></div>
        <div class="tour-controls">
          <button data-act="back">上一步</button>
          <button data-act="next">下一步</button>
          <button data-act="exit">退出</button>
        </div>
      </div>`;
    document.body.appendChild(this.root);
    this.highlight = this.root.querySelector('.tour-highlight');
    this.title = this.root.querySelector('.tour-title');
    this.instruction = this.root.querySelector('.tour-instruction');
    this.root.style.display = 'none';
  }

  onControl(cb) {
    this.root.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => cb(btn.dataset.act)));
  }

  showStep({ title, instruction, rect }) {
    this.root.style.display = 'block';
    this.title.textContent = title;
    this.instruction.textContent = instruction;
    if (rect) {
      Object.assign(this.highlight.style, {
        left: `${rect.x - 4}px`, top: `${rect.y - 4}px`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px`,
      });
    }
  }

  showCandidatePicker(candidates, onPick) {
    const picker = document.createElement('div');
    picker.className = 'tour-picker';
    picker.textContent = '请选择正确的目标：';
    candidates.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.textContent = `${i + 1}. ${c.reason}`;
      btn.onclick = () => { picker.remove(); onPick(c); };
      picker.appendChild(btn);
    });
    document.body.appendChild(picker);
  }

  clear() {
    this.root.style.display = 'none';
  }
}
