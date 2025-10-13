const path = require('path');

/**
 * Comprehensive Language Detection System
 * Detects programming languages, frameworks, and file purposes
 */

// File extension to language mapping
const LANGUAGE_MAP = {
  // JavaScript Ecosystem
  '.js': 'JavaScript',
  '.jsx': 'React',
  '.ts': 'TypeScript',
  '.tsx': 'React TypeScript',
  '.mjs': 'JavaScript Module',
  '.cjs': 'CommonJS',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  
  // Python Ecosystem
  '.py': 'Python',
  '.pyw': 'Python GUI',
  '.pyx': 'Cython',
  
  // JVM Languages
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin Script',
  '.scala': 'Scala',
  '.groovy': 'Groovy',
  
  // .NET Languages
  '.cs': 'C#',
  '.vb': 'Visual Basic',
  '.fs': 'F#',
  
  // Systems Languages
  '.c': 'C',
  '.h': 'C Header',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++ Header',
  '.rs': 'Rust',
  '.go': 'Go',
  
  // Web Languages
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.less': 'Less',
  '.php': 'PHP',
  
  // Mobile
  '.swift': 'Swift',
  '.m': 'Objective-C',
  '.mm': 'Objective-C++',
  '.dart': 'Dart',
  
  // Ruby
  '.rb': 'Ruby',
  '.erb': 'ERB',
  
  // Shell & Scripts
  '.sh': 'Shell',
  '.bash': 'Bash',
  '.zsh': 'Zsh',
  '.fish': 'Fish',
  '.ps1': 'PowerShell',
  '.bat': 'Batch',
  '.cmd': 'Command',
  
  // Databases
  '.sql': 'SQL',
  '.plsql': 'PL/SQL',
  '.psql': 'PostgreSQL',
  
  // Config & Data
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.ini': 'INI',
  '.env': 'Environment',
  '.properties': 'Properties',
  
  // Infrastructure
  '.dockerfile': 'Dockerfile',
  '.tf': 'Terraform',
  '.hcl': 'HCL',
  '.nomad': 'Nomad',
  
  // Templates
  '.ejs': 'EJS',
  '.hbs': 'Handlebars',
  '.pug': 'Pug',
  '.jade': 'Jade',
  
  // Other
  '.r': 'R',
  '.R': 'R',
  '.lua': 'Lua',
  '.pl': 'Perl',
  '.ex': 'Elixir',
  '.exs': 'Elixir Script',
  '.clj': 'Clojure',
  '.elm': 'Elm',
  '.hs': 'Haskell',
  '.erl': 'Erlang',
  '.ml': 'OCaml',
  '.v': 'Verilog',
};

// Framework detection patterns
const FRAMEWORK_PATTERNS = {
  React: [
    /import.*from\s+['"]react['"]/,
    /import.*\{.*Component.*\}.*from\s+['"]react['"]/,
    /React\.Component/,
    /useState|useEffect|useContext/,
    /jsx|tsx/i,
  ],
  NextJS: [
    /import.*from\s+['"]next/,
    /export\s+default\s+function.*\(\{.*\}\)/,
    /getServerSideProps|getStaticProps|getStaticPaths/,
  ],
  Vue: [
    /<template>/,
    /<script>.*export\s+default/,
    /Vue\.component/,
    /createApp|defineComponent/,
  ],
  Angular: [
    /@Component|@NgModule|@Injectable/,
    /import.*from\s+['"]@angular/,
  ],
  Express: [
    /require\(['"]express['"]\)/,
    /app\.(get|post|put|delete|use)\(/,
    /router\.(get|post|put|delete)/,
  ],
  FastAPI: [
    /from\s+fastapi\s+import/,
    /@app\.(get|post|put|delete)/,
    /FastAPI\(/,
  ],
  Django: [
    /from\s+django/,
    /django\.conf|django\.urls|django\.views/,
    /models\.Model|forms\.Form/,
  ],
  Flask: [
    /from\s+flask\s+import/,
    /@app\.route/,
    /Flask\(__name__\)/,
  ],
  Spring: [
    /@SpringBootApplication|@RestController|@Service|@Repository/,
    /import\s+org\.springframework/,
  ],
  Rails: [
    /class.*<\s*ApplicationController/,
    /ActiveRecord::Base/,
    /Rails\./,
  ],
  Tailwind: [
    /className=["'][^"']*\b(flex|grid|bg-|text-|p-|m-|w-|h-)/,
    /@apply\s+/,
  ],
};

// File purpose detection
const FILE_PURPOSES = {
  Dockerfile: /^Dockerfile/i,
  'Docker Compose': /^docker-compose/i,
  'GitHub Actions': /\.github\/workflows/,
  'CI Config': /\.(travis|circle|gitlab-ci|jenkins)/,
  'Package Config': /^package\.json$/,
  'Lock File': /\.(lock|yarn\.lock|Gemfile\.lock)$/,
  'Environment': /\.env/,
  'Config': /\.(config|conf|cfg|rc)$/,
  'Test': /\.(test|spec)\./,
  'Migration': /migrations?\//i,
  'Schema': /schema\.|database\./i,
};

/**
 * Detect language from file extension
 */
function detectLanguage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return LANGUAGE_MAP[ext] || 'Unknown';
}

/**
 * Detect framework by analyzing file content
 */
function detectFramework(content, filename) {
  const frameworks = [];
  
  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        frameworks.push(framework);
        break;
      }
    }
  }
  
  return frameworks;
}

/**
 * Detect file purpose
 */
function detectPurpose(filename) {
  const basename = path.basename(filename);
  
  for (const [purpose, pattern] of Object.entries(FILE_PURPOSES)) {
    if (pattern.test(filename) || pattern.test(basename)) {
      return purpose;
    }
  }
  
  return null;
}

/**
 * Check if file is analyzable (programming/config file)
 */
function isAnalyzable(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  // Exclude binary and media files
  const nonAnalyzable = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico',
    '.mp4', '.mov', '.avi', '.webm',
    '.mp3', '.wav', '.ogg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.woff', '.woff2', '.ttf', '.eot',
  ];
  
  if (nonAnalyzable.includes(ext)) {
    return false;
  }
  
  // Check if it's a known language
  if (LANGUAGE_MAP[ext]) {
    return true;
  }
  
  // Check if it's a special config file without extension
  const basename = path.basename(filename);
  const configFiles = [
    'Dockerfile', 'Makefile', 'Rakefile', 'Gemfile', 
    'Procfile', 'Vagrantfile', '.gitignore', '.dockerignore',
    'docker-compose.yml', 'docker-compose.yaml'
  ];
  
  return configFiles.some(cf => basename === cf || basename.startsWith(cf));
}

/**
 * Get comprehensive file analysis
 */
function analyzeFile(filename, content = '') {
  const language = detectLanguage(filename);
  const frameworks = detectFramework(content, filename);
  const purpose = detectPurpose(filename);
  const analyzable = isAnalyzable(filename);
  
  return {
    filename,
    language,
    frameworks,
    purpose,
    analyzable,
    category: getCategoryFromLanguage(language),
  };
}

/**
 * Get category for organizing analyzers
 */
function getCategoryFromLanguage(language) {
  const categories = {
    frontend: ['JavaScript', 'TypeScript', 'React', 'Vue', 'Svelte', 'HTML', 'CSS', 'SCSS', 'Sass', 'Less'],
    backend: ['Python', 'Java', 'Go', 'Ruby', 'PHP', 'C#', 'Kotlin', 'Scala'],
    mobile: ['Swift', 'Objective-C', 'Dart', 'Kotlin'],
    database: ['SQL', 'PL/SQL', 'PostgreSQL'],
    infrastructure: ['Dockerfile', 'Terraform', 'HCL', 'Shell', 'Bash', 'YAML'],
    systems: ['C', 'C++', 'Rust', 'Go'],
  };
  
  for (const [category, languages] of Object.entries(categories)) {
    if (languages.includes(language)) {
      return category;
    }
  }
  
  return 'other';
}

/**
 * Get appropriate analyzers for a file
 */
function getAnalyzersForFile(filename, content = '') {
  const analysis = analyzeFile(filename, content);
  const analyzers = [];
  
  if (!analysis.analyzable) {
    return [];
  }
  
  // Universal analyzer always runs
  analyzers.push('universal');
  
  // Add language-specific analyzers
  switch (analysis.language) {
    case 'JavaScript':
    case 'React':
    case 'TypeScript':
    case 'React TypeScript':
      analyzers.push('javascript', 'style', 'logic');
      break;
    case 'Python':
      analyzers.push('python', 'style', 'logic');
      break;
    case 'Java':
    case 'Kotlin':
    case 'Scala':
      analyzers.push('java', 'style', 'logic');
      break;
    case 'HTML':
      analyzers.push('html');
      break;
    case 'CSS':
    case 'SCSS':
    case 'Sass':
    case 'Less':
      analyzers.push('css');
      break;
    case 'SQL':
    case 'PL/SQL':
    case 'PostgreSQL':
      analyzers.push('sql');
      break;
    case 'Dockerfile':
      analyzers.push('docker');
      break;
    case 'Go':
      analyzers.push('go', 'style', 'logic');
      break;
    case 'Ruby':
      analyzers.push('ruby', 'style', 'logic');
      break;
    case 'C#':
      analyzers.push('csharp', 'style', 'logic');
      break;
  }
  
  // Add framework-specific analyzers
  if (analysis.frameworks.includes('React')) {
    analyzers.push('react');
  }
  if (analysis.frameworks.includes('NextJS')) {
    analyzers.push('nextjs');
  }
  
  // Security analyzer for all code
  if (analysis.category !== 'other') {
    analyzers.push('security');
  }
  
  return [...new Set(analyzers)]; // Remove duplicates
}

module.exports = {
  detectLanguage,
  detectFramework,
  detectPurpose,
  isAnalyzable,
  analyzeFile,
  getAnalyzersForFile,
  LANGUAGE_MAP,
};
