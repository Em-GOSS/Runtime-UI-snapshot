function pick(snapshot, pred) {
  return snapshot.elements.find(pred);
}

export async function generateTutorialDsl({ userQuestion, snapshot }) {
  const q = userQuestion.toLowerCase();
  const exportBtn = pick(snapshot, (e) => e.anchor?.dataTour === 'export-btn' || e.text?.includes('导出'));
  const formatSelect = pick(snapshot, (e) => e.anchor?.dataTour === 'format-select' || e.text?.includes('格式'));
  const confirmBtn = pick(snapshot, (e) => e.anchor?.dataTour === 'confirm-export-btn' || e.text?.includes('确认导出'));

  if (!q.includes('导出') || !exportBtn) {
    return {
      version: '1.0',
      title: '未找到可执行教程',
      user_goal: userQuestion,
      steps: [
        {
          id: 'wait_step',
          target: { primary: { kind: 'textRole', text: '页面', role: 'document' } },
          action: { type: 'wait', timeout_ms: 1000 },
          instruction: '未识别到导出入口，请先打开目标页面。',
          success_criteria: [{ type: 'text_present', value: '导出' }],
          fallback: { on_not_found: 'abort', hint: '缺少导出相关控件' },
        },
      ],
    };
  }

  const mkAnchor = (el) => {
    if (el?.anchor?.dataTour) return { kind: 'anchor', key: 'data-tour', value: el.anchor.dataTour };
    if (el?.anchor?.dataTestid) return { kind: 'anchor', key: 'data-testid', value: el.anchor.dataTestid };
    if (el?.anchor?.ariaLabel) return { kind: 'anchor', key: 'aria-label', value: el.anchor.ariaLabel };
    if (el?.anchor?.id) return { kind: 'anchor', key: 'id', value: el.anchor.id };
    return { kind: 'textRole', text: el?.text || '按钮', role: el?.role || 'button' };
  };

  return {
    version: '1.0',
    title: '导出数据教程',
    user_goal: userQuestion,
    prerequisites: ['位于数据列表页'],
    steps: [
      {
        id: 'open_export',
        target: { primary: mkAnchor(exportBtn) },
        action: { type: 'click' },
        instruction: '点击“导出”按钮。',
        success_criteria: [{ type: 'element_visible', target: mkAnchor(formatSelect || confirmBtn || exportBtn) }],
        fallback: { on_not_found: 'heal_target', hint: '检查右上角操作区' },
      },
      {
        id: 'pick_format',
        target: { primary: mkAnchor(formatSelect || confirmBtn || exportBtn) },
        action: { type: 'click' },
        instruction: '选择导出格式（CSV）。',
        success_criteria: [{ type: 'text_present', value: 'CSV' }],
        fallback: { on_not_found: 'try_alternates', hint: '查找格式选择器' },
      },
      {
        id: 'confirm_export',
        target: { primary: mkAnchor(confirmBtn || exportBtn) },
        action: { type: 'click' },
        instruction: '点击“确认导出”。',
        success_criteria: [{ type: 'text_present', value: '导出任务已创建' }],
        fallback: { on_not_found: 'ask_user_pick', hint: '请选择确认按钮' },
      },
    ],
  };
}
