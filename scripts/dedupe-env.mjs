#!/usr/bin/env node
/**
 * .env: duplicate keys → keep last value only (Vite/dotenv convention).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const file = resolve(process.cwd(), process.argv[2] ?? '.env');

if (!existsSync(file)) {
  console.warn(`Keçildi (yoxdur): ${basename(file)}`);
  process.exit(0);
}

const raw = readFileSync(file, 'utf8');
const lines = raw.split(/\r?\n/);

/** @type {Map<string, number>} key → line index of last assignment */
const lastIdx = new Map();

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq <= 0) continue;
  const key = t.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
  lastIdx.set(key, i);
}

const out = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const t = line.trim();
  if (!t || t.startsWith('#')) {
    out.push(line);
    continue;
  }
  const eq = t.indexOf('=');
  if (eq <= 0) {
    out.push(line);
    continue;
  }
  const key = t.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    out.push(line);
    continue;
  }
  if (lastIdx.get(key) !== i) continue;
  out.push(`${key}=${t.slice(eq + 1)}`);
}

const text = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n');
writeFileSync(file, text, 'utf8');
console.log(`OK: ${basename(file)} (${lastIdx.size} açar)`);
