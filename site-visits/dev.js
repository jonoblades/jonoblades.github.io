import { spawn } from 'node:child_process';

const processes = [
  spawn('bundle', ['exec', 'jekyll', 'serve', '--host', 'localhost', '--livereload', '--config', '_config.yml,_config.local.yml'], { stdio: 'inherit' }),
  spawn('yarn', ['run', 'site-visits'], { stdio: 'inherit' })
];

function stop(exitCode) {
  for (const child of processes) {
    child.kill('SIGTERM');
  }
  process.exit(exitCode);
}

for (const child of processes) {
  child.on('exit', (exitCode) => stop(exitCode || 0));
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));