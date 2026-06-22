export const sanitization = {
  forbiddenCodeRegex:
    /(<\?php|<script|function\s*\(|SELECT\s+|INSERT\s+|UPDATE\s+|DELETE\s+|DROP\s+|CREATE\s+|EXEC\s+|system\(|eval\(|require\(|import\s+|export\s+)/i,
};
