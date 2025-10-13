const fsp = require('fs').promises;
const path = require('path');

/**
 * TypeScript & React Analyzer
 * Detects: type errors, React hooks issues, JSX problems, Next.js patterns
 */

const TYPESCRIPT_PATTERNS = [
  // Type Errors
  {
    id: 'any-type',
    re: /:\s*any\b/,
    severity: 'medium',
    message: 'Using "any" type - loses type safety',
    suggestion: 'Define specific types instead of any.',
    example: `❌ const data: any\n✅ const data: string | number`,
    category: 'type',
  },
  {
    id: 'implicit-any',
    re: /\bfunction\s+\w+\([^)]*\w+[^:)]*\)/,
    severity: 'medium',
    message: 'Function parameter without type annotation',
    suggestion: 'Add type annotations to parameters.',
    example: `❌ function foo(x) {}\n✅ function foo(x: number) {}`,
    category: 'type',
  },
  {
    id: 'non-null-assertion',
    re: /!(?=\.|\[)/,
    severity: 'medium',
    message: 'Non-null assertion (!) - potential runtime error',
    suggestion: 'Add proper null check instead.',
    example: `❌ user!.name\n✅ user?.name || if (user) { user.name }`,
    category: 'type',
  },
  {
    id: 'ts-ignore-comment',
    re: /@ts-ignore|@ts-expect-error/,
    severity: 'medium',
    message: 'TypeScript error suppression - masks potential issues',
    suggestion: 'Fix the underlying type issue instead.',
    example: `❌ // @ts-ignore\n✅ Fix the type error properly`,
    category: 'type',
  },

  // React Hooks Issues
  {
    id: 'useState-without-type',
    re: /useState\(\)(?!<)/,
    severity: 'medium',
    message: 'useState without initial value or type parameter',
    suggestion: 'Provide initial value or type parameter.',
    example: `❌ const [state, setState] = useState()\n✅ const [state, setState] = useState<string>('')`,
    category: 'react',
  },
  {
    id: 'missing-deps-array',
    re: /useEffect\([^,)]+\)(?!\s*,)/,
    severity: 'high',
    message: 'useEffect without dependencies array',
    suggestion: 'Add dependencies array to control effect execution.',
    example: `❌ useEffect(() => {})\n✅ useEffect(() => {}, [dependencies])`,
    category: 'react',
  },
  {
    id: 'async-useEffect',
    re: /useEffect\(async\s+\(/,
    severity: 'high',
    message: 'async function directly in useEffect',
    suggestion: 'Define async function inside useEffect.',
    example: `❌ useEffect(async () => {})\n✅ useEffect(() => { async function fetch() {} fetch(); })`,
    category: 'react',
  },
  {
    id: 'hooks-in-condition',
    re: /if\s*\([^)]*\)\s*\{[^}]*use(State|Effect|Context|Reducer|Callback|Memo)/,
    severity: 'critical',
    message: 'Hook called conditionally - violates Rules of Hooks',
    suggestion: 'Call hooks at top level only.',
    example: `❌ if (condition) { useState() }\n✅ const state = useState(); if (condition) { ... }`,
    category: 'react',
  },

  // JSX Issues
  {
    id: 'inline-function-in-jsx',
    re: /(?:onClick|onChange|onSubmit)=\{[^}]*=>/,
    severity: 'medium',
    message: 'Inline function in JSX prop - creates new function on each render',
    suggestion: 'Use useCallback or define function outside.',
    example: `❌ onClick={() => handler()}\n✅ const handleClick = useCallback(() => handler(), [])`,
    category: 'react',
  },
  {
    id: 'dangerouslySetInnerHTML',
    re: /dangerouslySetInnerHTML/,
    severity: 'high',
    message: 'Using dangerouslySetInnerHTML - XSS risk',
    suggestion: 'Sanitize HTML or avoid if possible.',
    example: `⚠️ dangerouslySetInnerHTML={{__html: content}}\n✅ Use DOMPurify.sanitize() first`,
    category: 'security',
  },
  {
    id: 'key-with-index',
    re: /key=\{(?:index|i|idx)\}/,
    severity: 'medium',
    message: 'Using array index as React key',
    suggestion: 'Use unique identifier as key.',
    example: `❌ key={index}\n✅ key={item.id}`,
    category: 'react',
  },

  // Next.js Specific
  {
    id: 'next-image-without-alt',
    re: /<Image[^>]*(?!alt=)/,
    severity: 'high',
    message: 'Next.js Image component without alt attribute',
    suggestion: 'Add alt attribute for accessibility.',
    example: `❌ <Image src={} />\n✅ <Image src={} alt="description" />`,
    category: 'accessibility',
  },
  {
    id: 'next-link-with-a',
    re: /<Link[^>]*>\s*<a[^>]*>/,
    severity: 'medium',
    message: 'Next.js Link wrapping <a> tag - no longer needed',
    suggestion: 'Remove <a> tag in Next.js 13+.',
    example: `❌ <Link><a>Text</a></Link>\n✅ <Link>Text</Link>`,
    category: 'deprecation',
  },

  // Common Errors
  {
    id: 'console-log',
    re: /console\.log/,
    severity: 'low',
    message: 'console.log in code',
    suggestion: 'Remove or use proper logging.',
    example: `❌ console.log()\n✅ Use logger or remove`,
    category: 'style',
  },
  {
    id: 'var-declaration',
    re: /\bvar\s+\w+/,
    severity: 'medium',
    message: 'Using var instead of let/const',
    suggestion: 'Use const or let for block-scoped variables.',
    example: `❌ var x = 5\n✅ const x = 5`,
    category: 'style',
  },
  {
    id: 'equality-operator',
    re: /[^=!<>]={2}[^=]/,
    severity: 'medium',
    message: 'Using == instead of ===',
    suggestion: 'Use === for strict equality.',
    example: `❌ if (x == 5)\n✅ if (x === 5)`,
    category: 'logic',
  },
];

async function analyzeTypeScript(baseDir, files) {
  const findings = [];
  
  const tsFiles = files.filter(f => /\.(ts|tsx|jsx)$/i.test(f));
  
  if (tsFiles.length === 0) {
    return [];
  }
  
  for (const file of tsFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    const ext = path.extname(file).toLowerCase();
    const language = ext === '.tsx' || ext === '.jsx' ? 'React' : 'TypeScript';
    
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      for (const pattern of TYPESCRIPT_PATTERNS) {
        lines.forEach((line, idx) => {
          // Skip comments
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            return;
          }
          
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'typescript',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'typescript-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 120),
              category: pattern.category,
              language,
            });
          }
        });
      }
      
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return findings;
}

module.exports = { analyzeTypeScript };
