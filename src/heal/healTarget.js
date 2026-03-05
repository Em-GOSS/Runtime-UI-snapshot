export function healTarget({ failedStep, snapshot }) {
  const old = failedStep?.target?.primary;
  if (!old) return { resolved: false, confidence: 0, strategy: 'L0', candidates: [], requires_user_confirmation: false };

  const candidates = [];
  for (const el of snapshot.elements) {
    if (old.kind === 'anchor') {
      if (old.key === 'data-tour' && el.anchor?.dataTour === old.value) {
        candidates.push({ target: { kind: 'anchor', key: 'data-tour', value: el.anchor.dataTour }, confidence: 1, reason: 'L1 exact anchor' });
      }
      if (old.key === 'data-testid' && el.anchor?.dataTestid === old.value) {
        candidates.push({ target: { kind: 'anchor', key: 'data-testid', value: el.anchor.dataTestid }, confidence: 1, reason: 'L1 exact anchor' });
      }
    }

    const oldText = failedStep.instruction || '';
    const score = (el.text || '').includes(oldText.replace(/点击|输入|。/g, '')) ? 0.7 : 0;
    if (score > 0) {
      candidates.push({ target: { kind: 'textRole', text: el.text || '', role: el.role || 'button' }, confidence: score, reason: 'L2 text similarity' });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const top = candidates[0];
  if (!top) return { resolved: false, confidence: 0, strategy: 'L3', candidates: [], requires_user_confirmation: false };

  const requires_user_confirmation = candidates[1] && Math.abs(top.confidence - candidates[1].confidence) < 0.08;
  return {
    resolved: true,
    new_target: { primary: top.target },
    confidence: top.confidence,
    strategy: top.confidence >= 1 ? 'L1' : 'L2',
    candidates: candidates.slice(0, 3),
    requires_user_confirmation,
  };
}
