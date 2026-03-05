export const ACTION_TYPES = ['click', 'input', 'hover', 'wait'];
export const SUCCESS_TYPES = ['element_visible', 'element_value', 'route_is', 'text_present', 'network_done'];

export const tutorialSchemaHint = {
  requiredTopLevel: ['version', 'title', 'user_goal', 'steps'],
  requiredStep: ['id', 'target', 'action', 'instruction', 'success_criteria', 'fallback'],
};
