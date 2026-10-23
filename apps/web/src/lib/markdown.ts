import MarkdownIt from 'markdown-it';
import { katex } from '@mdit/plugin-katex';
import hljs from 'highlight.js/lib/core';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import delphi from 'highlight.js/lib/languages/delphi';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import DOMPurify from 'dompurify';

hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('pascal', delphi);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);

const LANGUAGE_ALIASES: Record<string, string> = {
  'c++': 'cpp',
  'cxx': 'cpp',
  cc: 'cpp',
  py: 'python',
  python3: 'python',
  pas: 'pascal',
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
};

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  highlight(code: string, language: string): string {
    const requested = (language ?? '').toLowerCase();
    const name = LANGUAGE_ALIASES[requested] ?? requested;
    try {
      if (name !== '' && hljs.getLanguage(name) !== undefined) {
        return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code, ['cpp', 'c', 'python', 'java', 'pascal', 'go', 'rust'])
        .value;
    } catch {
      return md.utils.escapeHtml(code);
    }
  },
});

md.use(katex, {
  throwOnError: false,
  strict: 'ignore',
  output: 'htmlAndMathml',
  macros: {
    '\\bm': '\\boldsymbol',
    '\\R': '\\mathbb{R}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
  },
});

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) =>
    self.renderToken(tokens, index, options));

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  token.attrSet('target', '_blank');
  token.attrSet('rel', 'noopener noreferrer');
  return defaultLinkOpen(tokens, index, options, env, self);
};

const defaultImage =
  md.renderer.rules.image ??
  ((tokens, index, options, _env, self) =>
    self.renderToken(tokens, index, options));

md.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index];
  token.attrSet('loading', 'lazy');
  token.attrSet('referrerpolicy', 'no-referrer');
  return defaultImage(tokens, index, options, env, self);
};

md.renderer.rules.table_open = () => '<div class="statement-table">\n<table>\n';
md.renderer.rules.table_close = () => '</table>\n</div>\n';

const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true, svg: true, mathMl: true },
  ADD_ATTR: ['target', 'rel', 'loading', 'referrerpolicy'],
};

function stripLuoguDirectives(source: string): string {
  return source
    .replace(/^[ \t]*::[A-Za-z][\w-]*(?:\{[^}]*\})?[ \t]*$/gm, '')
    .replace(/^[ \t]*:::[ \t]*[A-Za-z-]*[ \t]*$/gm, '');
}

export function renderMarkdown(source: string): string {
  const cleaned = stripLuoguDirectives(source);
  if (cleaned.trim() === '') return '';
  const html = md.render(cleaned);
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
