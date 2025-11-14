import { reactive } from 'vue';

export function useValidation(initialErrors = {}) {
  const errors = reactive({ ...initialErrors });
  const rules = {};

  function setRule(field, fn) {
    rules[field] = fn;
  }

  function validate() {
    let ok = true;
    for (const [field, fn] of Object.entries(rules)) {
      const msg = fn();
      errors[field] = msg || '';
      if (msg) ok = false;
    }
    return ok;
  }

  function hasErrors() {
    return Object.values(errors).some((v) => v);
  }

  return { errors, setRule, validate, hasErrors };
}
