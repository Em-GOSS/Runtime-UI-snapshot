import { ACTION_TYPES, SUCCESS_TYPES, tutorialSchemaHint } from './schema.js';

export function validateDsl(dsl) {
  const errors = [];

  for (const k of tutorialSchemaHint.requiredTopLevel) {
    if (dsl?.[k] == null) errors.push(`missing top-level field: ${k}`);
  }

  if (!Array.isArray(dsl?.steps) || dsl.steps.length === 0) {
    errors.push('steps must be a non-empty array');
  } else {
    dsl.steps.forEach((step, index) => {
      for (const k of tutorialSchemaHint.requiredStep) {
        if (step?.[k] == null) errors.push(`step[${index}] missing field: ${k}`);
      }
      if (step?.action?.type && !ACTION_TYPES.includes(step.action.type)) {
        errors.push(`step[${index}] invalid action.type: ${step.action.type}`);
      }
      if (!Array.isArray(step?.success_criteria) || step.success_criteria.length === 0) {
        errors.push(`step[${index}] success_criteria must be non-empty`);
      } else {
        step.success_criteria.forEach((c, ci) => {
          if (!SUCCESS_TYPES.includes(c.type)) {
            errors.push(`step[${index}] criteria[${ci}] invalid type: ${c.type}`);
          }
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
