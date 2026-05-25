import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const dataDir = path.join(publicDir, 'data');

await fs.mkdir(dataDir, { recursive: true });

const emptyLatest = {
  meta: {
    project: '全网文娱榜',
    generatedAt: null,
    generatedAtCN: '尚未更新',
    sourceCount: 0,
    successCount: 0,
    failCount: 0,
    itemCount: 0
  },
  sources: [],
  rankings: {
    overall: [],
    platforms: {},
    categories: {}
  },
  raw: {}
};

async function ensureJson(file, data) {
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  }
}

await ensureJson(path.join(dataDir, 'latest.json'), emptyLatest);

console.log('Static shell is ready.');
