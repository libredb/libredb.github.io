/**
 * The /playground database worker. Sole owner of the OPFS sync-access handle.
 * Durable when OPFS is available; otherwise transparently in-memory. Never
 * throws across postMessage — every failure becomes a structured response.
 */
import { open, opfsFileSystem, type Database, type SyncAccessHandle } from '@libredb/libredb/browser';
import { seed, isSeeded, execute } from './engine';
import { parseCommand } from './protocol';
import type { WorkerRequest, WorkerResponse, Mode } from './protocol';

// `createSyncAccessHandle` is a dedicated-Worker-only API absent from TS's DOM lib.
// Declare it against the package's own (structurally compatible) SyncAccessHandle.
declare global {
  interface FileSystemFileHandle {
    createSyncAccessHandle(): Promise<SyncAccessHandle>;
  }
}

const FILE = 'playground.libredb';

let db: Database;
let mode: Mode = 'memory';
let handle: SyncAccessHandle | undefined;

/** Acquire the OPFS handle (Worker-only, secure context, exclusive lock) or fall back to in-memory. */
async function boot(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle(FILE, { create: true });
    handle = await file.createSyncAccessHandle();
    db = open({ path: FILE, fs: opfsFileSystem(handle) });
    mode = 'opfs';
  } catch {
    handle = undefined;
    db = open();
    mode = 'memory';
  }
  if (!isSeeded(db)) seed(db);
}

/** Wipe the durable file (or the in-memory db) and reseed. */
async function reset(): Promise<void> {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  if (mode === 'opfs') {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(FILE).catch(() => {});
    } catch {
      /* ignore */
    }
  }
  await boot();
}

const reply = (msg: WorkerResponse) => self.postMessage(msg);

// Serialize ALL message handling onto one promise chain (starting with boot), so
// only one op ever touches `db` at a time — a `run` can't land mid-`reset`, and
// `close` can't race an in-flight op. Single-threaded JS + this chain = strict order.
let chain: Promise<void> = boot();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  chain = chain
    .then(() => handleMessage(msg))
    .catch((e) => {
      reply({ id: msg.id, kind: 'result', result: { kind: 'error', error: (e as Error).message } });
    });
};

async function handleMessage(msg: WorkerRequest): Promise<void> {
  switch (msg.op) {
    case 'ready':
      reply({ id: msg.id, kind: 'ready', mode });
      return;
    case 'run': {
      const cmd = parseCommand(msg.text);
      // `stats` needs the on-disk size; getSize() only when relevant (and durable).
      const fileSize = cmd.op === 'stats' && mode === 'opfs' && handle ? handle.getSize() : undefined;
      reply({ id: msg.id, kind: 'result', result: execute(db, cmd, fileSize) });
      return;
    }
    case 'reset':
      await reset();
      reply({
        id: msg.id,
        kind: 'result',
        result: { kind: 'message', message: 'Sandbox reset to sample data.' },
      });
      return;
    case 'close':
      try {
        db.close(); // flush WAL + release the exclusive OPFS sync-access handle
      } catch {
        /* already closed */
      }
      reply({ id: msg.id, kind: 'closed' });
      // Self-terminate so the handle is released without the client racing us
      // via worker.terminate() before this handler runs.
      self.close();
      return;
  }
}
