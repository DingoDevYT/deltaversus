/**
 * gml_compiler.js — a real GML front end: lexer -> AST -> JavaScript.
 *
 * This replaces the line-by-line regex substitution approach, which could not
 * express the things Deltarune attack code actually does:
 *
 *   with (inst) { ... }   rebinds `self` for the block and makes the caller
 *                         `other`. Regex replacement left the body pointing at
 *                         the original instance, so every `with` was a no-op or
 *                         worse.
 *   exit / break          have to unwind the real event, from any nesting depth.
 *   a[i] = v              auto-creates and grows arrays in GML.
 *   #RRGGBB               is an RGB literal that packs to a BGR integer.
 *   div mod and or not    are operators, not identifiers.
 *   statements spanning    multiple lines are one statement; a line-oriented
 *   several lines          pass mangles them.
 *   x = 1+2               is not the number "1+2".
 *
 * Output contract — the generated code is evaluated as:
 *     new Function('GMLInstance', 'runtime', code + ';\nreturn ' + name + ';')
 * so only `GMLInstance` and `runtime` are in scope, plus anything on `window`
 * (which is where gml_runtime.js publishes its builtins). Helpers the codegen
 * needs beyond that live on `runtime.H` and are emitted as `$R`.
 *
 * Every compiler-internal identifier is `$`-prefixed. GML identifiers cannot
 * contain `$`, so generated temporaries can never collide with user variables.
 */
(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // TOKENIZER
  // ═══════════════════════════════════════════════════════════════════════

  const KEYWORDS = new Set([
    'if', 'else', 'while', 'do', 'until', 'for', 'repeat', 'switch', 'case',
    'default', 'break', 'continue', 'exit', 'return', 'with', 'var', 'globalvar',
    'enum', 'function', 'constructor', 'static', 'try', 'catch', 'finally',
    'throw', 'new', 'delete', 'begin', 'end',
  ]);

  // Word-form operators. GML accepts both these and the symbolic forms.
  const WORD_OPS = {
    div: 'div', mod: '%', and: '&&', or: '||', xor: '^^', not: '!',
  };

  // Longest-first so `<<` beats `<` and `??=` beats `??`.
  const PUNCT = [
    '??=', '<<=', '>>=',
    '==', '!=', '<>', '<=', '>=', '&&', '||', '^^', '<<', '>>', '??',
    '+=', '-=', '*=', '/=', '%=', '|=', '&=', '^=', '++', '--',
    '{', '}', '(', ')', '[', ']', ';', ',', '.', ':', '?',
    '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '|', '&', '^', '@',
  ];

  // Array/data-structure accessors: `a[# i, j]`, `a[| i]`, `a[? k]`, `a[$ k]`, `a[@ i]`.
  const ACCESSORS = { '#': 'grid', '|': 'list', '?': 'map', '$': 'struct', '@': 'direct' };

  class GMLSyntaxError extends Error {
    constructor(msg, line, col) {
      super(`${msg} (line ${line}, col ${col})`);
      this.name = 'GMLSyntaxError';
      this.line = line;
      this.col = col;
    }
  }

  class Lexer {
    constructor(src) {
      this.src = String(src == null ? '' : src);
      this.pos = 0;
      this.line = 1;
      this.col = 1;
      this.tokens = [];
      this.macros = Object.create(null);
    }

    error(msg) { throw new GMLSyntaxError(msg, this.line, this.col); }

    push(type, value, extra) {
      const t = { type, value, line: this.line, col: this.col };
      if (extra) Object.assign(t, extra);
      this.tokens.push(t);
      return t;
    }

    advance(n) {
      for (let i = 0; i < n; i++) {
        if (this.src[this.pos] === '\n') { this.line++; this.col = 1; }
        else this.col++;
        this.pos++;
      }
    }

    /**
     * GML 2.3 template string: emit `$"a{x}b"` as the tokens for
     * `("a" + string(x) + "b")`.
     *
     * Done in the LEXER rather than as an AST node so every downstream pass —
     * codegen, the macro expander, the `+` string/number dispatch in $R.add —
     * sees an ordinary concatenation and needs no new case. Braces are doubled
     * to escape ({{ and }}), matching GameMaker.
     *
     * `string()` is what GML uses to stringify, and it is already implemented,
     * so numeric and struct interpolands format the same way they do in game.
     */
    pushInterpolated(raw, quote) {
      const parts = [];
      let lit = '';
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if ((ch === '{' && raw[i + 1] === '{') || (ch === '}' && raw[i + 1] === '}')) {
          lit += ch; i++; continue;
        }
        if (ch === '{') {
          let depth = 1, j = i + 1, expr = '';
          for (; j < raw.length; j++) {
            const c2 = raw[j];
            if (c2 === '{') depth++;
            else if (c2 === '}') { depth--; if (depth === 0) break; }
            expr += c2;
          }
          parts.push({ lit });
          parts.push({ expr });
          lit = '';
          i = j;
          continue;
        }
        lit += ch;
      }
      parts.push({ lit });

      // No interpolation actually present: a plain string, so stay a plain string.
      if (!parts.some(p => p.expr !== undefined)) {
        this.push('string', Lexer.unescape(parts.map(p => p.lit || '').join('')));
        return;
      }

      this.push('punct', '(');
      let emitted = 0;
      for (const p of parts) {
        if (p.expr !== undefined) {
          const inner = p.expr.trim();
          if (!inner) continue;
          if (emitted++) this.push('punct', '+');
          this.push('ident', 'string');
          this.push('punct', '(');
          // Nested lex: the interpoland is ordinary GML.
          const sub = new Lexer(inner).tokenize().filter(t => t.type !== 'eof');
          for (const t of sub) this.tokens.push({ ...t, line: this.line, col: this.col });
          this.push('punct', ')');
          continue;
        }
        if (!p.lit) continue;
        if (emitted++) this.push('punct', '+');
        this.push('string', Lexer.unescape(p.lit));
      }
      // `$""` or `$"{}"` — nothing to concatenate, so the value is "".
      if (!emitted) this.push('string', '');
      this.push('punct', ')');
    }

    tokenize() {
      const src = this.src;
      while (this.pos < src.length) {
        const c = src[this.pos];

        // Whitespace
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { this.advance(1); continue; }

        // Comments
        if (c === '/' && src[this.pos + 1] === '/') {
          while (this.pos < src.length && src[this.pos] !== '\n') this.advance(1);
          continue;
        }
        if (c === '/' && src[this.pos + 1] === '*') {
          const end = src.indexOf('*/', this.pos + 2);
          this.advance((end === -1 ? src.length : end + 2) - this.pos);
          continue;
        }

        // Colour literal `#RRGGBB` / `#RRGGBBAA`, tested BEFORE directives.
        //
        // Order matters and the obvious order is wrong: a directive was matched
        // by "# followed by a letter", which also describes every colour whose
        // first hex digit is a letter — `#EE5577`, `#FF88AA`. Those were lexed
        // as `#macro`, swallowing the rest of the line, and the enclosing event
        // then failed to parse. It cost obj_purplecontrols its entire Draw event
        // (so the rotating box, the 3D tunnel and the node maze all rendered
        // nothing) plus 119 other events and 5 GlobalScripts, silently.
        //
        // Testing the colour first is safe: no GML directive name — macro,
        // region, endregion — is 6 or 8 hex characters long.
        //
        // GameMaker reads these as RGB and stores them BGR-packed, which is what
        // we emit.
        if (c === '#') {
          const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?(?![0-9a-fA-F])/.exec(src.slice(this.pos));
          if (m) {
            const r = parseInt(m[1].slice(0, 2), 16);
            const g = parseInt(m[1].slice(2, 4), 16);
            const b = parseInt(m[1].slice(4, 6), 16);
            this.push('number', r | (g << 8) | (b << 16));
            this.advance(m[0].length);
            continue;
          }
          // Not a colour, so it must be a preprocessor directive:
          // `#macro NAME body`, `#region`, `#endregion`.
          if (/[a-zA-Z_]/.test(src[this.pos + 1] || '')) {
            this.lexDirective();
            continue;
          }
          this.error('unexpected #');
        }

        // `$RRGGBB` / `$1F` — a raw hex number, NOT reordered.
        if (c === '$') {
          const m = /^\$([0-9a-fA-F]+)/.exec(src.slice(this.pos));
          if (m) {
            this.push('number', parseInt(m[1], 16));
            this.advance(m[0].length);
            continue;
          }
          // GML 2.3 string interpolation: $"text {expr} more".
          // This used to throw, and a throw in the LEXER kills the entire event.
          // Rewritten as string_concat of its pieces so the braces evaluate:
          // "a{x}b" -> ("a" + string(x) + "b"). Doubled braces are literal.
          if (src[this.pos + 1] === '"' || src[this.pos + 1] === "'") {
            const quote = src[this.pos + 1];
            let j = this.pos + 2;
            let raw = '';
            while (j < src.length && src[j] !== quote) {
              if (src[j] === '\\' && j + 1 < src.length) { raw += src[j] + src[j + 1]; j += 2; continue; }
              raw += src[j++];
            }
            this.advance((j < src.length ? j + 1 : j) - this.pos);
            this.pushInterpolated(raw, quote);
            continue;
          }
          this.error('unexpected $');
        }

        // Verbatim strings: @"..." / @'...' — no escape processing.
        if (c === '@' && (src[this.pos + 1] === '"' || src[this.pos + 1] === "'")) {
          const quote = src[this.pos + 1];
          let end = this.pos + 2;
          while (end < src.length && src[end] !== quote) end++;
          this.push('string', src.slice(this.pos + 2, end));
          this.advance(Math.min(end + 1, src.length) - this.pos);
          continue;
        }

        // Strings.
        if (c === '"' || c === "'") { this.lexString(c); continue; }

        // Numbers. Deliberately narrow: digits and at most one dot. The old
        // translator's character-class approach swallowed `1+2` whole.
        if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[this.pos + 1] || ''))) {
          this.lexNumber();
          continue;
        }

        // Identifiers / keywords / word operators.
        if (/[a-zA-Z_]/.test(c)) { this.lexWord(); continue; }

        // Accessors — only right after `[`.
        if (c === '[') {
          const nxt = src[this.pos + 1];
          if (nxt && ACCESSORS[nxt] && nxt !== '@') {
            this.push('accessor', ACCESSORS[nxt]);
            this.advance(2);
            continue;
          }
          if (nxt === '@') { this.push('accessor', 'direct'); this.advance(2); continue; }
          this.push('punct', '[');
          this.advance(1);
          continue;
        }

        // Punctuation.
        let matched = null;
        for (const p of PUNCT) {
          if (src.startsWith(p, this.pos)) { matched = p; break; }
        }
        if (matched) { this.push('punct', matched); this.advance(matched.length); continue; }

        this.error(`unexpected character '${c}'`);
      }
      this.push('eof', null);
      return this.tokens;
    }

    lexDirective() {
      const src = this.src;
      const m = /^#([a-zA-Z_]\w*)[ \t]*/.exec(src.slice(this.pos));
      const name = m[1];
      this.advance(m[0].length);

      if (name === 'region' || name === 'endregion') {
        while (this.pos < src.length && src[this.pos] !== '\n') this.advance(1);
        return;
      }

      if (name === 'macro') {
        const nm = /^([a-zA-Z_]\w*)[ \t]*/.exec(src.slice(this.pos));
        if (!nm) this.error('malformed #macro');
        const macroName = nm[1];
        this.advance(nm[0].length);
        // Macro bodies run to end of line, continued while the line ends in `\`.
        let body = '';
        for (;;) {
          let end = src.indexOf('\n', this.pos);
          if (end === -1) end = src.length;
          let chunk = src.slice(this.pos, end);
          this.advance(end - this.pos);
          if (/\\\s*$/.test(chunk)) {
            body += chunk.replace(/\\\s*$/, '');
            if (this.pos < src.length) this.advance(1);
            continue;
          }
          body += chunk;
          break;
        }
        this.macros[macroName] = body.trim();
        return;
      }

      // Unknown directive — skip the line rather than fail the whole event.
      while (this.pos < src.length && src[this.pos] !== '\n') this.advance(1);
    }

    /** The escape rules of lexString, for text already sliced out of the source. */
    static unescape(text) {
      let out = '';
      for (let p = 0; p < text.length; p++) {
        if (text[p] !== '\\') { out += text[p]; continue; }
        const e = text[p + 1];
        if (e === 'n') out += '\n';
        else if (e === 't') out += '\t';
        else if (e === 'r') out += '\r';
        else if (e === '\\') out += '\\';
        else if (e === '"') out += '"';
        else if (e === "'") out += "'";
        else out += e === undefined ? '' : e;
        p++;
      }
      return out;
    }

    lexString(quote) {
      const src = this.src;
      let out = '';
      let p = this.pos + 1;
      while (p < src.length && src[p] !== quote) {
        if (src[p] === '\\') {
          const e = src[p + 1];
          if (e === 'n') out += '\n';
          else if (e === 't') out += '\t';
          else if (e === 'r') out += '\r';
          else if (e === '\\') out += '\\';
          else if (e === '"') out += '"';
          else if (e === "'") out += "'";
          else out += e === undefined ? '' : e;
          p += 2;
          continue;
        }
        out += src[p];
        p++;
      }
      this.push('string', out);
      this.advance(Math.min(p + 1, src.length) - this.pos);
    }

    lexNumber() {
      const src = this.src;
      const hex = /^0[xX][0-9a-fA-F]+/.exec(src.slice(this.pos));
      if (hex) {
        this.push('number', parseInt(hex[0], 16));
        this.advance(hex[0].length);
        return;
      }
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(this.pos));
      this.push('number', parseFloat(m[0]));
      this.advance(m[0].length);
    }

    lexWord() {
      const src = this.src;
      const m = /^[a-zA-Z_]\w*/.exec(src.slice(this.pos));
      const w = m[0];
      this.advance(w.length);
      if (Object.prototype.hasOwnProperty.call(WORD_OPS, w)) {
        // `not` is unary, the rest binary — the parser decides by position.
        this.push('wordop', w);
      } else if (KEYWORDS.has(w)) {
        this.push('keyword', w);
      } else {
        this.push('ident', w);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PARSER
  // ═══════════════════════════════════════════════════════════════════════

  // Precedence, loosest first.
  //
  // GameMaker does NOT define a portable precedence order. The manual's
  // Expressions And Operators page lists operator CATEGORIES, not a precedence
  // table, and states outright that "different target compilers will perform the
  // operations in different orders since they are not explicitly shown",
  // recommending explicit brackets. So this table is a choice, not a spec.
  //
  // It's safe for this corpus: the only place bitwise meets comparison without
  // brackets is already parenthesised, and there are no `a & b == c` forms at all
  // (bitwise use is confined to hexcolor.gml / scr_bitmask.gml, which bracket
  // everything). Ordering here follows the manual's listing, with bitwise looser
  // than comparison.
  const PREC = {
    '??': 1,
    '&&': 2, '||': 2, '^^': 2,
    '&': 3, '|': 3, '^': 3,
    '<': 4, '<=': 4, '>': 4, '>=': 4, '==': 4, '!=': 4, '<>': 4, '=': 4,
    '<<': 5, '>>': 5,
    '+': 6, '-': 6,
    '*': 7, '/': 7, '%': 7, 'div': 7,
  };

  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '|=', '&=', '^=', '??=', '<<=', '>>=']);

  class Parser {
    constructor(tokens, macros) {
      this.toks = tokens;
      this.i = 0;
      this.macros = macros || Object.create(null);
      this.enums = Object.create(null);
      // `=` means equality inside parentheses/brackets/arguments, assignment at
      // statement level. GML overloads it; tracking nesting resolves which.
      this.parenDepth = 0;
    }

    peek(k) { return this.toks[this.i + (k || 0)]; }
    get cur() { return this.toks[this.i]; }
    next() { return this.toks[this.i++]; }
    error(msg, tok) {
      const t = tok || this.cur || { line: 0, col: 0 };
      throw new GMLSyntaxError(msg, t.line, t.col);
    }

    isPunct(v, k) { const t = this.peek(k); return t.type === 'punct' && t.value === v; }
    isKeyword(v, k) { const t = this.peek(k); return t.type === 'keyword' && t.value === v; }
    isWordOp(v, k) { const t = this.peek(k); return t.type === 'wordop' && t.value === v; }

    eatPunct(v) { if (this.isPunct(v)) { this.i++; return true; } return false; }
    eatKeyword(v) { if (this.isKeyword(v)) { this.i++; return true; } return false; }
    expectPunct(v) { if (!this.eatPunct(v)) this.error(`expected '${v}'`); }

    /** Optional statement terminator — GML tolerates a missing semicolon. */
    eatSemis() { while (this.isPunct(';')) this.i++; }

    parseProgram() {
      const body = [];
      while (this.cur.type !== 'eof') {
        const s = this.parseStatement();
        if (s) body.push(s);
      }
      return { type: 'Program', body };
    }

    // ── statements ──────────────────────────────────────────────────────

    parseStatement() {
      const t = this.cur;

      if (t.type === 'punct') {
        if (t.value === ';') { this.i++; return null; }
        if (t.value === '{') return this.parseBlock();
      }

      if (t.type === 'keyword') {
        switch (t.value) {
          case 'begin': this.i++; return this.parseBlock(true);
          case 'if': return this.parseIf();
          case 'while': return this.parseWhile();
          case 'do': return this.parseDoUntil();
          case 'for': return this.parseFor();
          case 'repeat': return this.parseRepeat();
          case 'switch': return this.parseSwitch();
          case 'with': return this.parseWith();
          case 'var': return this.parseVarDecl(false);
          case 'globalvar': return this.parseVarDecl(true);
          case 'static': return this.parseStatic();
          case 'enum': return this.parseEnum();
          case 'function': return this.parseFunctionDecl();
          case 'try': return this.parseTry();
          case 'throw': {
            this.i++;
            const arg = this.parseExpression();
            this.eatSemis();
            return { type: 'Throw', argument: arg };
          }
          case 'break': this.i++; this.eatSemis(); return { type: 'Break' };
          case 'continue': this.i++; this.eatSemis(); return { type: 'Continue' };
          case 'exit': this.i++; this.eatSemis(); return { type: 'Exit' };
          case 'return': {
            this.i++;
            let arg = null;
            if (!this.isPunct(';') && !this.isPunct('}') && this.cur.type !== 'eof') {
              arg = this.parseExpression();
            }
            this.eatSemis();
            return { type: 'Return', argument: arg };
          }
          case 'delete': {
            this.i++;
            const arg = this.parseExpression();
            this.eatSemis();
            return { type: 'Delete', argument: arg };
          }
        }
      }

      return this.parseExpressionStatement();
    }

    parseBlock(begunWithBeginKeyword) {
      if (!begunWithBeginKeyword) this.expectPunct('{');
      // A block resets `=` disambiguation: a function literal's body can sit
      // inside a call's parentheses, but its statements are still statements.
      const savedDepth = this.parenDepth;
      this.parenDepth = 0;
      const body = [];
      for (;;) {
        if (this.cur.type === 'eof') break;
        if (begunWithBeginKeyword ? this.isKeyword('end') : this.isPunct('}')) { this.i++; break; }
        const s = this.parseStatement();
        if (s) body.push(s);
      }
      this.parenDepth = savedDepth;
      return { type: 'Block', body };
    }

    /** Body of if/while/for/with/repeat — either a block or a single statement. */
    parseBody() {
      const s = this.parseStatement();
      if (!s) return { type: 'Block', body: [] };
      return s;
    }

    parseParenExpr() {
      this.expectPunct('(');
      this.parenDepth++;
      const e = this.parseExpression();
      this.parenDepth--;
      this.expectPunct(')');
      return e;
    }

    parseIf() {
      this.i++;
      // GML allows `if x > 3` without parentheses.
      const test = this.isPunct('(') ? this.parenExprOrCondition() : this.parseCondition();
      this.eatKeyword('then');
      const consequent = this.parseBody();
      let alternate = null;
      this.eatSemis();
      if (this.eatKeyword('else')) alternate = this.parseBody();
      return { type: 'If', test, consequent, alternate };
    }

    /**
     * `if (...)` — but the parens might just be the first primary of a larger
     * condition, as in `if (a) && (b)`. Parse a full condition with `=` treated
     * as equality throughout.
     */
    parenExprOrCondition() { return this.parseCondition(); }

    parseCondition() {
      this.parenDepth++;
      const e = this.parseExpression();
      this.parenDepth--;
      return e;
    }

    parseWhile() {
      this.i++;
      const test = this.parseCondition();
      const body = this.parseBody();
      return { type: 'While', test, body };
    }

    parseDoUntil() {
      this.i++;
      const body = this.parseBody();
      if (!this.eatKeyword('until')) this.error("expected 'until' after 'do' body");
      const test = this.parseCondition();
      this.eatSemis();
      return { type: 'DoUntil', body, test };
    }

    parseFor() {
      this.i++;
      this.expectPunct('(');
      // Inside for(...) the clauses are statements, so `=` is assignment again.
      const saved = this.parenDepth;
      this.parenDepth = 0;
      let init = null;
      if (!this.isPunct(';')) init = this.isKeyword('var') ? this.parseVarDecl(false, true) : this.parseSimpleStatement();
      this.eatPunct(';');
      let test = null;
      if (!this.isPunct(';')) { this.parenDepth = 1; test = this.parseExpression(); this.parenDepth = 0; }
      this.eatPunct(';');
      let update = null;
      if (!this.isPunct(')')) update = this.parseSimpleStatement();
      this.parenDepth = saved;
      this.expectPunct(')');
      const body = this.parseBody();
      return { type: 'For', init, test, update, body };
    }

    parseRepeat() {
      this.i++;
      // Parens optional: `repeat (3)` and `repeat 3` are both legal.
      const count = this.isPunct('(') ? this.parseParenExpr() : this.parseExpression();
      const body = this.parseBody();
      return { type: 'Repeat', count, body };
    }

    parseSwitch() {
      this.i++;
      const disc = this.parseCondition();
      this.expectPunct('{');
      const savedDepth = this.parenDepth;
      this.parenDepth = 0;
      const cases = [];
      while (!this.isPunct('}') && this.cur.type !== 'eof') {
        if (this.eatKeyword('case')) {
          this.parenDepth++;
          const test = this.parseExpression();
          this.parenDepth--;
          this.expectPunct(':');
          cases.push({ test, body: [] });
        } else if (this.eatKeyword('default')) {
          this.expectPunct(':');
          cases.push({ test: null, body: [] });
        } else {
          const s = this.parseStatement();
          if (s) {
            if (!cases.length) cases.push({ test: null, body: [], stray: true });
            cases[cases.length - 1].body.push(s);
          }
        }
      }
      this.expectPunct('}');
      this.parenDepth = savedDepth;
      return { type: 'Switch', discriminant: disc, cases };
    }

    parseWith() {
      this.i++;
      const target = this.isPunct('(') ? this.parseParenExpr() : this.parseExpression();
      const body = this.parseBody();
      return { type: 'With', target, body };
    }

    parseVarDecl(isGlobal, noSemi) {
      this.i++;
      const decls = [];
      for (;;) {
        if (this.cur.type !== 'ident') this.error('expected variable name');
        const name = this.next().value;
        let init = null;
        if (this.isPunct('=')) {
          this.i++;
          this.parenDepth++;   // RHS: `=` inside would be equality
          init = this.parseExpression();
          this.parenDepth--;
        }
        decls.push({ name, init });
        if (this.eatPunct(',')) continue;
        break;
      }
      if (!noSemi) this.eatSemis();
      return { type: isGlobal ? 'GlobalVarDecl' : 'VarDecl', declarations: decls };
    }

    parseStatic() {
      this.i++;
      const name = this.next().value;
      let init = null;
      if (this.eatPunct('=')) {
        this.parenDepth++;
        init = this.parseExpression();
        this.parenDepth--;
      }
      this.eatSemis();
      return { type: 'StaticDecl', name, init };
    }

    parseEnum() {
      this.i++;
      const name = this.next().value;
      this.expectPunct('{');
      const members = {};
      let auto = 0;
      while (!this.isPunct('}') && this.cur.type !== 'eof') {
        const mname = this.next().value;
        if (this.eatPunct('=')) {
          this.parenDepth++;
          const expr = this.parseExpression();
          this.parenDepth--;
          const v = staticEval(expr, members);
          auto = (v === undefined ? auto : v);
        }
        members[mname] = auto;
        auto++;
        if (!this.eatPunct(',')) break;
      }
      this.expectPunct('}');
      this.eatSemis();
      this.enums[name] = members;
      return { type: 'EnumDecl', name, members };
    }

    parseFunctionDecl() {
      this.i++;
      let name = null;
      if (this.cur.type === 'ident') name = this.next().value;
      const params = this.parseParams();
      // GML 2.3 constructor INHERITANCE: `function Child(a) : Parent(a) constructor {}`
      // The parser went straight from the parameter list to parseBlock, whose
      // expectPunct('{') threw "expected '{'" on the colon — and a throw here
      // kills the WHOLE event, not just the declaration.
      const parent = this.parseCtorParent();
      const isCtor = this.eatKeyword('constructor');
      const body = this.parseBlock();
      return { type: 'FunctionDecl', name, params, body, isConstructor: isCtor, parent };
    }

    /** `: Parent(args)` after a function's parameter list, or null. */
    parseCtorParent() {
      if (!this.isPunct(':')) return null;
      this.i++;
      const pname = this.cur.type === 'ident' ? this.next().value : null;
      const args = this.isPunct('(') ? this.parseArgs() : [];
      return pname ? { name: pname, args } : null;
    }

    parseParams() {
      this.expectPunct('(');
      const params = [];
      const saved = this.parenDepth;
      this.parenDepth = 0;   // default values use `=` as assignment
      while (!this.isPunct(')') && this.cur.type !== 'eof') {
        const pname = this.next().value;
        let def = null;
        if (this.eatPunct('=')) { this.parenDepth = 1; def = this.parseExpression(); this.parenDepth = 0; }
        params.push({ name: pname, default: def });
        if (!this.eatPunct(',')) break;
      }
      this.parenDepth = saved;
      this.expectPunct(')');
      return params;
    }

    parseTry() {
      this.i++;
      const block = this.parseBlock();
      let param = null;
      let handler = null;
      let finalizer = null;
      if (this.eatKeyword('catch')) {
        if (this.eatPunct('(')) { param = this.next().value; this.expectPunct(')'); }
        handler = this.parseBlock();
      }
      if (this.eatKeyword('finally')) finalizer = this.parseBlock();
      return { type: 'Try', block, param, handler, finalizer };
    }

    /** An assignment or bare expression, with no terminator consumed. */
    parseSimpleStatement() {
      const start = this.i;
      const left = this.parseUnary();
      if (this.cur.type === 'punct' && ASSIGN_OPS.has(this.cur.value)) {
        const op = this.next().value;
        this.parenDepth++;
        const right = this.parseExpression();
        this.parenDepth--;
        return { type: 'Assign', operator: op, left, right };
      }
      // Not an assignment — finish parsing it as an expression from `left`.
      this.i = start;
      this.parenDepth++;
      const expr = this.parseExpression();
      this.parenDepth--;
      return { type: 'ExpressionStatement', expression: expr };
    }

    parseExpressionStatement() {
      const s = this.parseSimpleStatement();
      this.eatSemis();
      return s;
    }

    // ── expressions ─────────────────────────────────────────────────────

    parseExpression() { return this.parseTernary(); }

    parseTernary() {
      const test = this.parseBinary(0);
      if (this.isPunct('?')) {
        this.i++;
        this.parenDepth++;
        const consequent = this.parseTernary();
        this.expectPunct(':');
        const alternate = this.parseTernary();
        this.parenDepth--;
        return { type: 'Conditional', test, consequent, alternate };
      }
      return test;
    }

    binaryOpAt() {
      const t = this.cur;
      if (t.type === 'wordop') {
        if (t.value === 'not') return null;
        return WORD_OPS[t.value];
      }
      if (t.type !== 'punct') return null;
      const v = t.value;
      // A bare `=` is equality only inside parens/args; at statement level the
      // caller has already peeled off assignment.
      if (v === '=' && this.parenDepth === 0) return null;
      return PREC[v] !== undefined ? v : null;
    }

    parseBinary(minPrec) {
      let left = this.parseUnary();
      for (;;) {
        const op = this.binaryOpAt();
        if (op === null) break;
        const prec = PREC[op];
        if (prec === undefined || prec < minPrec) break;
        this.i++;
        const right = this.parseBinary(prec + 1);
        left = { type: 'Binary', operator: op === '<>' ? '!=' : op, left, right };
      }
      return left;
    }

    parseUnary() {
      const t = this.cur;
      if (t.type === 'wordop' && t.value === 'not') {
        this.i++;
        return { type: 'Unary', operator: '!', argument: this.parseUnary() };
      }
      if (t.type === 'punct') {
        if (t.value === '-' || t.value === '+' || t.value === '!' || t.value === '~') {
          this.i++;
          return { type: 'Unary', operator: t.value, argument: this.parseUnary() };
        }
        if (t.value === '++' || t.value === '--') {
          this.i++;
          return { type: 'Update', operator: t.value, prefix: true, argument: this.parseUnary() };
        }
      }
      if (t.type === 'keyword' && t.value === 'new') {
        this.i++;
        const callee = this.parsePostfix(this.parsePrimary(), true);
        let args = [];
        if (this.isPunct('(')) args = this.parseArgs();
        return this.parsePostfix({ type: 'New', callee, arguments: args });
      }
      return this.parsePostfix(this.parsePrimary());
    }

    parseArgs() {
      this.expectPunct('(');
      this.parenDepth++;
      const args = [];
      while (!this.isPunct(')') && this.cur.type !== 'eof') {
        // GML permits elided arguments: `f(1, , 3)`.
        if (this.isPunct(',')) { args.push({ type: 'Undefined' }); this.i++; continue; }
        args.push(this.parseExpression());
        if (!this.eatPunct(',')) break;
      }
      this.parenDepth--;
      this.expectPunct(')');
      return args;
    }

    parsePostfix(node, stopBeforeCall) {
      for (;;) {
        if (this.isPunct('.')) {
          this.i++;
          const nameTok = this.next();
          node = { type: 'Member', object: node, property: String(nameTok.value), computed: false };
          continue;
        }
        if (this.isPunct('[') || this.cur.type === 'accessor') {
          const kind = this.cur.type === 'accessor' ? this.cur.value : 'array';
          this.i++;
          this.parenDepth++;
          const indices = [];
          while (!this.isPunct(']') && this.cur.type !== 'eof') {
            indices.push(this.parseExpression());
            if (!this.eatPunct(',')) break;
          }
          this.parenDepth--;
          this.expectPunct(']');
          node = { type: 'Index', object: node, indices, kind };
          continue;
        }
        if (!stopBeforeCall && this.isPunct('(')) {
          node = { type: 'Call', callee: node, arguments: this.parseArgs() };
          continue;
        }
        if (this.isPunct('++') || this.isPunct('--')) {
          const op = this.next().value;
          node = { type: 'Update', operator: op, prefix: false, argument: node };
          continue;
        }
        break;
      }
      return node;
    }

    parsePrimary() {
      const t = this.cur;

      if (t.type === 'number') { this.i++; return { type: 'Number', value: t.value }; }
      if (t.type === 'string') { this.i++; return { type: 'String', value: t.value }; }

      if (t.type === 'punct') {
        if (t.value === '(') {
          this.i++;
          this.parenDepth++;
          const e = this.parseExpression();
          this.parenDepth--;
          this.expectPunct(')');
          return { type: 'Paren', expression: e };
        }
        if (t.value === '[') {
          this.i++;
          this.parenDepth++;
          const elements = [];
          while (!this.isPunct(']') && this.cur.type !== 'eof') {
            elements.push(this.parseExpression());
            if (!this.eatPunct(',')) break;
          }
          this.parenDepth--;
          this.expectPunct(']');
          return { type: 'ArrayLiteral', elements };
        }
        if (t.value === '{') return this.parseStructLiteral();
      }

      if (t.type === 'keyword') {
        if (t.value === 'function') {
          this.i++;
          let name = null;
          if (this.cur.type === 'ident') name = this.next().value;
          const params = this.parseParams();
          const parent = this.parseCtorParent();
          const isCtor = this.eatKeyword('constructor');
          const body = this.parseBlock();
          return { type: 'FunctionExpr', name, params, body, isConstructor: isCtor, parent };
        }
      }

      if (t.type === 'ident') {
        this.i++;
        // Macro expansion happens here so macros can hold whole expressions.
        if (Object.prototype.hasOwnProperty.call(this.macros, t.value)) {
          return { type: 'Macro', name: t.value, body: this.macros[t.value] };
        }
        return { type: 'Identifier', name: t.value, line: t.line };
      }

      this.error(`unexpected token ${t.type === 'eof' ? 'end of code' : `'${t.value}'`}`);
    }

    parseStructLiteral() {
      this.expectPunct('{');
      const props = [];
      const saved = this.parenDepth;
      this.parenDepth = 1;
      while (!this.isPunct('}') && this.cur.type !== 'eof') {
        const keyTok = this.next();
        const key = keyTok.type === 'string' ? keyTok.value : String(keyTok.value);
        this.expectPunct(':');
        props.push({ key, value: this.parseExpression() });
        if (!this.eatPunct(',')) break;
      }
      this.parenDepth = saved;
      this.expectPunct('}');
      return { type: 'StructLiteral', properties: props };
    }
  }

  /** Constant-folds enum initialisers, which must be compile-time values. */
  function staticEval(node, scope) {
    switch (node.type) {
      case 'Number': return node.value;
      case 'Paren': return staticEval(node.expression, scope);
      case 'Identifier': return scope && scope[node.name];
      case 'Unary': {
        const v = staticEval(node.argument, scope);
        if (v === undefined) return undefined;
        return node.operator === '-' ? -v : node.operator === '!' ? (v ? 0 : 1) : v;
      }
      case 'Binary': {
        const a = staticEval(node.left, scope);
        const b = staticEval(node.right, scope);
        if (a === undefined || b === undefined) return undefined;
        switch (node.operator) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
          case '%': return a % b;
          case '<<': return a << b;
          case '>>': return a >> b;
          case '|': return a | b;
          case '&': return a & b;
          case '^': return a ^ b;
        }
        return undefined;
      }
    }
    return undefined;
  }

  global.GMLLexer = Lexer;
  global.GMLParser = Parser;
  global.GMLSyntaxError = GMLSyntaxError;
  global.GML_PARSE = function parseGML(src) {
    const lx = new Lexer(src);
    const toks = lx.tokenize();
    const p = new Parser(toks, lx.macros);
    const ast = p.parseProgram();
    return { ast, macros: lx.macros, enums: p.enums };
  };

})(typeof window !== 'undefined' ? window : globalThis);
