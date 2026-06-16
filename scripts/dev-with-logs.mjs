import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {appendFile, mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const logsDir = join(rootDir, 'logs');
const nextBin = join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const args = ['dev', ...process.argv.slice(2)];

await mkdir(logsDir, {recursive: true});

const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: rootDir,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe']
});

pipeStream(child.stdout, 'server.stdout');
pipeStream(child.stderr, 'server.stderr');

child.on('exit', async (code, signal) => {
  await writeLog({
    type: 'server.exit',
    message: `Next dev exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`
  });
  process.exit(code ?? 0);
});

child.on('error', async (error) => {
  await writeLog({
    type: 'server.error',
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});

function pipeStream(stream, type) {
  const reader = createInterface({input: stream});

  reader.on('line', (line) => {
    const target = type === 'server.stderr' ? process.stderr : process.stdout;
    target.write(`${line}\n`);

    writeLog({
      type,
      message: line
    }).catch(() => {});
  });
}

async function writeLog(entry) {
  const logLine =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry
    }) + '\n';

  await appendFile(join(logsDir, `${formatJerusalemDate(new Date())}.log`), logLine, 'utf8');
}

function formatJerusalemDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}
