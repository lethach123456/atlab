import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 5173);
const php = process.env.PHP_BINARY || 'php';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

const children = new Set();
let stopping = false;
let serverAlive = false;
let restartTimer;
let shutdownTimer;

function track(child) {
  children.add(child);
  child.once('close', () => {
    children.delete(child);
    if (stopping && children.size === 0) clearTimeout(shutdownTimer);
  });
  return child;
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  serverAlive = false;
  process.exitCode = exitCode;
  clearTimeout(restartTimer);
  for (const child of children) child.kill('SIGTERM');
  if (children.size > 0) {
    shutdownTimer = setTimeout(() => {
      for (const child of children) child.kill('SIGKILL');
    }, 2000);
    shutdownTimer.unref();
  }
}


const server = track(spawn(php, [
  '-S', `127.0.0.1:${port}`, '-t', root, `${root}router.php`,
], { cwd: root, stdio: 'inherit', env: process.env }));

server.on('error', () => {
  console.error('Không khởi động được PHP. Kiểm tra PHP trong PATH hoặc thiết lập PHP_BINARY.');
  stop(1);
});
server.once('close', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
server.on('spawn', () => {
  serverAlive = true;
  console.log(`Local: http://localhost:${port}/kiem-tra-chung-nhan-xuat-xu`);
});
