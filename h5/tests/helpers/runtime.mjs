import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const flush = () => new Promise((resolve) => setImmediate(resolve));
export const plain = (value) => JSON.parse(JSON.stringify(value));
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    getStorageSync: (key) => values.get(key) ?? '',
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: (key) => values.delete(key),
  };
}

export class Clock {
  now = 1800000000000;
  timers = new Map();
  next = 0;
  setTimeout = (fn, delay = 0) => {
    const id = ++this.next;
    this.timers.set(id, { fn, at: this.now + Number(delay) });
    return id;
  };
  clearTimeout = (id) => this.timers.delete(id);
  async advance(ms) {
    const until = this.now + ms;
    let iterations = 0;
    for (;;) {
      const next = [...this.timers].filter(([, timer]) => timer.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      if (++iterations > 500) throw new Error('Timer loop did not settle');
      this.now = next[1].at;
      this.timers.delete(next[0]);
      next[1].fn();
      await flush();
    }
    this.now = until;
    await flush();
  }
  globals() {
    const clock = this;
    return {
      setTimeout: this.setTimeout, clearTimeout: this.clearTimeout,
      Date: class extends Date {
        constructor(...args) { super(...(args.length ? args : [clock.now])); }
        static now() { return clock.now; }
      },
    };
  }
}

// 执行实际模块；只替换平台依赖和定时器，不复制待测业务实现。
function preprocess(source, platform) {
  const platforms = new Set([platform, ...(platform.startsWith('MP-') ? ['MP'] : [])]);
  const stack = [true];
  return source.split(/\r?\n/).filter((line) => {
    const directive = line.match(/^\s*\/\/\s*#(ifdef|ifndef|endif)\s*(.*?)\s*$/);
    if (directive) {
      if (directive[1] === 'endif') stack.pop();
      else {
        const matched = directive[2].split(/\s*\|\|\s*/).some((name) => platforms.has(name));
        stack.push(stack.at(-1) && (directive[1] === 'ifdef' ? matched : !matched));
      }
      return false;
    }
    return stack.at(-1);
  }).join('\n');
}

export async function loadModule(file, { mocks = {}, globals = {}, platform = 'H5', expose = [] } = {}) {
  let source = await readFile(resolve(root, file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1];
  source = preprocess(source, platform);
  if (expose.length) source += '\nexport { ' + expose.join(', ') + ' };\n';
  const context = vm.createContext({ console, URL, URLSearchParams, setTimeout, clearTimeout, ...globals });
  const module = new vm.SourceTextModule(source, { context, identifier: file });
  await module.link((specifier) => {
    if (!Object.hasOwn(mocks, specifier)) throw new Error('Missing test dependency: ' + specifier);
    const values = mocks[specifier];
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

export function pageRuntime() {
  const hooks = {};
  return {
    hooks,
    vue: { reactive: (value) => value, ref: (value) => ({ value }), computed: (get) => ({ get value() { return get(); } }) },
    lifecycle: Object.fromEntries(['onLoad', 'onShow', 'onHide', 'onUnload'].map((name) =>
      [name, (callback) => { hooks[name] = callback; }])),
  };
}
