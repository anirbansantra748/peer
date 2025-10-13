// Map linters and heuristic rules to quick, actionable suggestions.
// Extend as needed.

const suggestionByRule = new Map([
  // ESLint common
  ['semi', 'Add a semicolon at the end of the statement. Consider enabling auto-fix (eslint --fix).'],
  ['quotes', 'Use consistent quotes (prefer single quotes) throughout the file.'],
  ['no-unused-vars', 'Remove unused variables or prefix with _ if needed to signal intent.'],
  ['eqeqeq', 'Use strict equality (=== / !==) instead of == / != to avoid type coercion bugs.'],
  ['no-undef', 'Declare the variable or import it. Ensure correct scope.'],
  ['no-console', 'Remove console.log in production code or guard it behind a debug flag.'],
  ['no-eval', 'Avoid eval(); refactor to safer APIs such as JSON.parse, Function arguments, or a vetted parser.'],
  ['no-implied-eval', 'Avoid passing strings to setTimeout/setInterval; pass a function instead.'],
  ['no-alert', 'Avoid alert/confirm/prompt in production; use non-blocking UI notifications.'],
  ['curly', 'Wrap multi-line control statements in curly braces for clarity and safety.'],
  ['no-var', 'Use let/const instead of var; prefer const for values not reassigned.'],
  ['prefer-const', 'Use const for variables that are never reassigned.'],
  ['no-extra-boolean-cast', 'Remove unnecessary Boolean casts; most contexts already coerce to boolean.'],
  ['no-unreachable', 'Remove or refactor unreachable code (after return/throw/break).'],
  ['no-fallthrough', 'Add break or explicit fallthrough comment in switch cases.'],
  ['no-prototype-builtins', 'Use Object.hasOwn(obj, key) instead of obj.hasOwnProperty(key).'],

  // Heuristics we emit
  ['child-process-exec', 'Avoid shelling out without sanitizing inputs; use safe APIs and validate parameters.'],
  ['console-log-secret', 'Avoid logging secrets (tokens, api keys). Mask or remove sensitive values.'],

  // IaC
  ['iac-open-cidr', 'Avoid 0.0.0.0/0; restrict to known CIDR ranges or use security groups with least privilege.'],
  ['iac-plaintext-aws-key', 'Do not store AWS credentials in plaintext; move to a secret manager or environment variables.'],
  ['iac-public-read', 'Avoid public-read/public-read-write unless absolutely necessary; make buckets private.'],

  // Semgrep examples
  ['javascript.lang.security.eval-detected', 'Remove or refactor eval usage; prefer safer alternatives.'],
]);

function mapRuleToSuggestion(ruleId, fallback) {
  if (!ruleId) return fallback;
  const sug = suggestionByRule.get(ruleId);
  return sug || fallback;
}

module.exports = { mapRuleToSuggestion };
