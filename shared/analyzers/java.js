const fsp = require('fs').promises;
const path = require('path');

/**
 * Java Analyzer
 * Detects: syntax errors, logic issues, best practices, Spring Boot patterns
 */

const JAVA_PATTERNS = [
  // Invalid method and main signature issues
  {
    id: 'invalid-method-declaration',
    re: /\bclass\s+public\s+static\s+void\s+\w+\s*\(/,
    severity: 'high',
    message: 'Invalid method declaration - misplaced keywords after class',
    suggestion: 'Move access modifiers and static to method declaration, not after class keyword.',
    example: `❌ class public static void main(String[] args) { }\n✅ public class App { public static void main(String[] args) { } }`,
    category: 'syntax',
  },
  {
    id: 'main-method-misspelled',
    re: /public\s+static\s+void\s+(?!main\b)\w+\s*\(String\s*\[\]\s*args\)/,
    severity: 'high',
    message: 'main method appears misspelled - entry point must be main(String[] args)',
    suggestion: 'Rename method to main(String[] args).',
    example: `❌ public static void pain(String[] args) { }\n✅ public static void main(String[] args) { }`,
    category: 'syntax',
  },
  {
    id: 'lowercase-system-out',
    re: /\bsystem\.out\.println\s*\(/,
    severity: 'high',
    message: 'system.out.println should be System.out.println (Java is case-sensitive)',
    suggestion: 'Capitalize System: System.out.println(...)',
    example: `❌ system.out.println(a)\n✅ System.out.println(a)`,
    category: 'syntax',
  },
  // CRITICAL: Syntax Errors
  {
    id: 'missing-semicolon',
    re: /^(?!.*\/\/)(?!.*\/\*).*[^;\s\{\}]$(?!\s*\{)/m,
    severity: 'high',
    message: 'Possible missing semicolon',
    suggestion: 'Add semicolon at end of statement.',
    example: `❌ int x = 5\n✅ int x = 5;`,
    category: 'syntax',
  },
  
  // CRITICAL: Logic Errors
  {
    id: 'division-by-zero',
    re: /\/\s*0\b/,
    severity: 'critical',
    message: 'Division by zero - will throw ArithmeticException',
    suggestion: 'Add zero check before division.',
    example: `❌ result = x / 0;\n✅ if (divisor != 0) { result = x / divisor; }`,
    category: 'logic',
  },
  {
    id: 'null-comparison-wrong-order',
    re: /\w+\s*==\s*null/,
    severity: 'medium',
    message: 'Potential NullPointerException - variable compared to null',
    suggestion: 'Consider using Objects.isNull() or reverse comparison order.',
    example: `❌ if (str == null)\n✅ if (null == str) // or Objects.isNull(str)`,
    category: 'logic',
  },
  {
    id: 'null-pointer-risk',
    re: /\.\w+\(\)\.(?!\s*(equals|toString|hashCode))/,
    severity: 'medium',
    message: 'Chained method call - potential NullPointerException',
    suggestion: 'Add null checks between method calls or use Optional.',
    example: `❌ user.getAddress().getCity()\n✅ Optional.ofNullable(user.getAddress()).map(Address::getCity)`,
    category: 'logic',
  },
  {
    id: 'string-comparison-equals',
    re: /\w+\s*==\s*[\"']/,
    severity: 'high',
    message: 'String comparison using == instead of .equals()',
    suggestion: 'Use .equals() for string comparison.',
    example: `❌ if (str == \"hello\")\n✅ if (\"hello\".equals(str))`,
    category: 'logic',
  },
  
  // MEDIUM: Exception Handling
  {
    id: 'empty-catch',
    re: /catch\s*\([^)]+\)\s*\{\s*\}/,
    severity: 'high',
    message: 'Empty catch block - exceptions silently ignored',
    suggestion: 'Handle exception properly or at least log it.',
    example: `❌ catch (Exception e) {}\n✅ catch (Exception e) { logger.error("Error", e); }`,
    category: 'exception',
  },
  {
    id: 'catching-generic-exception',
    re: /catch\s*\(\s*Exception\s+\w+\s*\)/,
    severity: 'medium',
    message: 'Catching generic Exception - too broad',
    suggestion: 'Catch specific exceptions instead.',
    example: `❌ catch (Exception e)\n✅ catch (IOException | SQLException e)`,
    category: 'exception',
  },
  {
    id: 'throws-generic-exception',
    re: /throws\s+Exception\b/,
    severity: 'medium',
    message: 'Method throws generic Exception',
    suggestion: 'Throw specific exception types.',
    example: `❌ throws Exception\n✅ throws IOException, SQLException`,
    category: 'exception',
  },
  {
    id: 'print-stack-trace',
    re: /\.printStackTrace\(\)/,
    severity: 'medium',
    message: 'Using printStackTrace() - use proper logging',
    suggestion: 'Replace with logger.error().',
    example: `❌ e.printStackTrace();\n✅ logger.error("Error occurred", e);`,
    category: 'exception',
  },
  
  // MEDIUM: Resource Management
  {
    id: 'resource-not-closed',
    re: /new\s+(FileInputStream|FileOutputStream|BufferedReader|Scanner|Connection|Statement|ResultSet)\s*\([^)]+\)(?!.*try-with-resources)/,
    severity: 'high',
    message: 'Resource might not be closed - memory leak risk',
    suggestion: 'Use try-with-resources statement.',
    example: `❌ FileInputStream fis = new FileInputStream(file);\n✅ try (FileInputStream fis = new FileInputStream(file)) { }`,
    category: 'resource',
  },
  
  // Style & Best Practices
  {
    id: 'magic-number',
    re: /=\s*\d{3,}\b/,
    severity: 'low',
    message: 'Magic number - unclear meaning',
    suggestion: 'Use named constant.',
    example: `❌ if (age > 65)\n✅ private static final int RETIREMENT_AGE = 65;`,
    category: 'style',
  },
  {
    id: 'system-out-println',
    re: /System\.out\.println/,
    severity: 'low',
    message: 'Using System.out.println - use logger instead',
    suggestion: 'Replace with proper logging framework (SLF4J, Log4j).',
    example: `❌ System.out.println(\"Debug\");\n✅ logger.debug(\"Debug\");`,
    category: 'style',
  },
  {
    id: 'public-field',
    re: /public\s+(?!static\s+final)\s*(?:int|long|double|float|String|boolean|byte|short|char)\s+\w+\s*[;=]/,
    severity: 'medium',
    message: 'Public field - breaks encapsulation',
    suggestion: 'Make fields private and provide getters/setters.',
    example: `❌ public String name;\n✅ private String name; public String getName() { }`,
    category: 'style',
  },
  {
    id: 'raw-type',
    re: /\b(List|Set|Map|ArrayList|HashMap|HashSet)\s+\w+\s*=\s*new\s+\1\s*\(\)/,
    severity: 'medium',
    message: 'Using raw type - missing generic type parameter',
    suggestion: 'Specify generic type for type safety.',
    example: `❌ List list = new ArrayList();\n✅ List<String> list = new ArrayList<>();`,
    category: 'style',
  },
  
  // Spring Boot Specific
  {
    id: 'autowired-field-injection',
    re: /@Autowired\s+(?:private|protected|public)\s+\w+\s+\w+;/,
    severity: 'medium',
    message: 'Field injection with @Autowired - use constructor injection',
    suggestion: 'Constructor injection is preferred for testability.',
    example: `❌ @Autowired private Service service;\n✅ private final Service service; @Autowired public MyClass(Service service) { }`,
    category: 'spring',
  },
  {
    id: 'missing-transactional',
    re: /public\s+\w+\s+save\w*\s*\([^)]*\)\s*\{/,
    severity: 'low',
    message: 'Save method without @Transactional',
    suggestion: 'Consider adding @Transactional for database operations.',
    example: `❌ public void saveUser(User user)\n✅ @Transactional public void saveUser(User user)`,
    category: 'spring',
  },
  
  // Security Issues
  {
    id: 'hardcoded-password',
    re: /password\s*=\s*[\"'][^\"']+[\"']/i,
    severity: 'critical',
    message: 'Hardcoded password detected',
    suggestion: 'Use environment variables or secure vault.',
    example: `❌ String password = \"secret123\";\n✅ String password = System.getenv(\"DB_PASSWORD\");`,
    category: 'security',
  },
  {
    id: 'sql-injection-risk',
    re: /(Statement|executeQuery|executeUpdate).*\+.*[\"']/,
    severity: 'critical',
    message: 'SQL injection risk - string concatenation in query',
    suggestion: 'Use PreparedStatement with parameters.',
    example: `❌ stmt.execute(\"SELECT * FROM users WHERE id = \" + userId);\n✅ PreparedStatement ps = conn.prepareStatement(\"SELECT * FROM users WHERE id = ?\");`,
    category: 'security',
  },
  
  // Common Mistakes
  {
    id: 'equals-vs-assignment',
    re: /if\s*\(\s*\w+\s*=\s*[^=]/,
    severity: 'critical',
    message: 'Assignment (=) instead of comparison (==) in if statement',
    suggestion: 'Use == for comparison.',
    example: `❌ if (x = 5)\n✅ if (x == 5)`,
    category: 'logic',
  },
  {
    id: 'todo-comment',
    re: /\/\/\s*TODO|\/\*\s*TODO/i,
    severity: 'low',
    message: 'TODO comment found',
    suggestion: 'Track TODOs in issue tracker.',
    example: `❌ // TODO: Fix this\n✅ // Create JIRA ticket`,
    category: 'style',
  },
];

async function analyzeJava(baseDir, files) {
  const findings = [];
  
  const javaFiles = files.filter(f => /\.java$/i.test(f));
  
  if (javaFiles.length === 0) {
    return [];
  }
  
  for (const file of javaFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      // Check each pattern
      for (const pattern of JAVA_PATTERNS) {
        lines.forEach((line, idx) => {
          // Skip comments for some patterns
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            if (pattern.id !== 'todo-comment') {
              return;
            }
          }
          
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'java',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'java-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 120),
              category: pattern.category,
              language: 'Java',
            });
          }
        });
      }
      
      // Additional whole-file checks

      // Detect duplicate variable declarations in the same file (heuristic)
      const declRegex = /\b(int|long|double|float|boolean|char|short|byte|String)\s+([A-Za-z_]\w*)\s*=\s*[^;]*;/g;
      const seenVars = new Map();
      let match;
      while ((match = declRegex.exec(content)) !== null) {
        const name = match[2];
        const before = content.slice(0, match.index);
        const line = (before.match(/\r?\n/g) || []).length + 1;
        if (seenVars.has(name)) {
          findings.push({
            analyzer: 'java',
            file: path.relative(baseDir, filePath),
            line,
            column: 1,
            rule: 'duplicate-variable-declaration',
            severity: 'high',
            message: `Variable '${name}' redeclared in same scope`,
            source: 'java-analyzer',
            suggestion: 'Remove duplicate declaration or rename the variable.',
            example: `❌ int a = 1; ... int a = 4;\n✅ int a = 1; a = 4;`,
            codeSnippet: content.split(/\r?\n/)[line - 1]?.trim()?.slice(0, 120) || '',
            category: 'logic',
            language: 'Java',
          });
        } else {
          seenVars.set(name, true);
        }
      }
      
      // Check for missing class declaration
      if (!/\bclass\s+\w+/i.test(content)) {
        findings.push({
          analyzer: 'java',
          file: path.relative(baseDir, filePath),
          line: 1,
          column: 1,
          rule: 'missing-class-declaration',
          severity: 'high',
          message: 'Java file missing class declaration',
          source: 'java-analyzer',
          suggestion: 'Every .java file should contain a class definition.',
          example: `✅ public class MyClass { }`,
          codeSnippet: '',
          category: 'syntax',
          language: 'Java',
        });
      }
      
      // Check brace balance
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        findings.push({
          analyzer: 'java',
          file: path.relative(baseDir, filePath),
          line: 1,
          column: 1,
          rule: 'mismatched-braces',
          severity: 'critical',
          message: `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`,
          source: 'java-analyzer',
          suggestion: 'Balance all opening and closing braces.',
          example: `❌ { ... \n✅ { ... }`,
          codeSnippet: '',
          category: 'syntax',
          language: 'Java',
        });
      }
      
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return findings;
}

module.exports = { analyzeJava };
