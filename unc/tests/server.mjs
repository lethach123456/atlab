import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, chmod, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(os.tmpdir(), 'unc-launcher-checks-'));
let checks = 0;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(condition, description, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await pause(30);
  }
  throw new Error(`Timed out: ${description}`);
}
function verify(condition, description) {
  assert.ok(condition, description);
  checks++;
}

const fakePhp = path.join(temporary, 'php');
await writeFile(fakePhp, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const kind = args.includes('-S') ? 'server' : 'worker';
function log(event) { fs.appendFileSync(process.env.LAUNCHER_LOG, JSON.stringify({event,kind,pid:process.pid,args,time:Date.now()})+'\\n'); }
log('start');
process.on('SIGTERM', () => { log('stop'); process.exit(0); });
if (kind === 'server' && process.env.FAKE_SERVER_EXIT === '1') setTimeout(() => process.exit(7), 250);
if (kind === 'worker' && process.env.FAKE_WORKER_EXIT !== undefined) {
  setTimeout(() => { log('intentional-exit'); process.exit(Number(process.env.FAKE_WORKER_EXIT)); },150);
}
if (kind === 'worker' && process.env.FAKE_WORKER_CRASH === '1') {
  const marker = process.env.LAUNCHER_LOG + '.crashed';
  if (!fs.existsSync(marker)) { fs.writeFileSync(marker,'1'); setTimeout(() => { log('crash'); process.exit(4); },150); }
}
setInterval(() => {},1000);
`);
await chmod(fakePhp, 0o700);

async function launch(name, extraEnvironment = {}) {
  const logFile = path.join(temporary, `${name}.log`);
  await writeFile(logFile, '');
  const child = spawn(process.execPath, [`${root}server.mjs`], {
    cwd: root,
    env: { ...process.env, PHP_BINARY: fakePhp, PORT: '55273', LAUNCHER_LOG: logFile, ...extraEnvironment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise((resolve) => child.once('close', (code, signal) => resolve({code,signal})));
  const events = async () => (await readFile(logFile,'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return {child,exited,events,output:()=>output};
}
async function stopAndCheck(run) {
  run.child.kill('SIGTERM');
  const result = await Promise.race([run.exited, pause(4000).then(() => { throw new Error('Launcher did not terminate'); })]);
  verify(result.code === 0, 'launcher exits cleanly on SIGTERM');
  const events = await run.events();
  const started = events.filter((event) => event.event === 'start');
  for (const event of started) {
    let running = true;
    try { process.kill(event.pid, 0); } catch { running = false; }
    verify(!running, `${event.kind} child is not left running`);
  }
  const count = events.length;
  await pause(100);
  verify((await run.events()).length === count, 'no worker restarts after launcher shutdown');
}

const runs = [];
try {
  const normal = await launch('normal');
  runs.push(normal);
  await waitFor(async () => (await normal.events()).filter((event) => event.event === 'start').length === 2, 'HTTP server and refresh worker start');
  const started = (await normal.events()).filter((event) => event.event === 'start');
  const server = started.find((event) => event.kind === 'server');
  const worker = started.find((event) => event.kind === 'worker');
  verify(server.args.includes('127.0.0.1:55273') && server.args.includes(`${root}router.php`), 'HTTP process preserves PORT and router');
  verify(worker.args[0] === `${root}backend/refresh.php` && worker.args[1] === '--loop', 'worker starts in recurring mode');
  await stopAndCheck(normal);

  const crashedServer = await launch('server-exit', {FAKE_SERVER_EXIT:'1'});
  runs.push(crashedServer);
  const serverExit = await Promise.race([crashedServer.exited,pause(4000).then(() => { throw new Error('Server exit did not stop launcher'); })]);
  verify(serverExit.code === 7, 'launcher preserves an unexpected HTTP process exit code');
  const serverEvents = await crashedServer.events();
  verify(serverEvents.some((event) => event.kind === 'worker' && event.event === 'stop'), 'HTTP process exit stops the refresh worker');

  const crashedWorker = await launch('worker-exit', {FAKE_WORKER_CRASH:'1'});
  runs.push(crashedWorker);
  await waitFor(async () => (await crashedWorker.events()).filter((event) => event.kind === 'worker' && event.event === 'start').length === 2, 'worker restarts after unexpected exit');
  const workerEvents = await crashedWorker.events();
  const firstCrash = workerEvents.find((event) => event.kind === 'worker' && event.event === 'crash');
  const nextStart = workerEvents.filter((event) => event.kind === 'worker' && event.event === 'start')[1];
  verify(nextStart.time - firstCrash.time >= 4900, 'worker restart waits five seconds');
  await stopAndCheck(crashedWorker);

  const intentionalWorkers = await Promise.all([
    launch('disabled-worker', {FAKE_WORKER_EXIT:'0'}),
    launch('duplicate-worker', {FAKE_WORKER_EXIT:'2'}),
  ]);
  runs.push(...intentionalWorkers);
  await Promise.all(intentionalWorkers.map((run) => waitFor(async () => (await run.events()).some((event) => event.event === 'intentional-exit'), 'intentional worker exit')));
  await pause(5200);
  for (const run of intentionalWorkers) {
    verify((await run.events()).filter((event) => event.kind === 'worker' && event.event === 'start').length === 1, 'disabled or duplicate worker does not enter a restart loop');
    await stopAndCheck(run);
  }

  const missingPhp = await launch('missing-php', {PHP_BINARY:path.join(temporary,'missing-executable')});
  runs.push(missingPhp);
  const launchFailure = await Promise.race([missingPhp.exited,pause(4000).then(() => { throw new Error('Missing PHP did not stop launcher'); })]);
  verify(launchFailure.code === 1 && (await missingPhp.events()).length === 0, 'PHP launch failure stops without starting a worker');

  console.log(`Launcher checks passed: ${checks}`);
} finally {
  for (const run of runs) run.child.kill('SIGTERM');
  await Promise.allSettled(runs.map((run) => run.exited));
  await rm(temporary, {recursive:true,force:true});
}
