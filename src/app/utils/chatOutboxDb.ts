/**
 * Local IndexedDB queue for messages that could not be sent (offline / network error).
 * Flushed automatically when the browser goes online and `flushChatOutbox` succeeds.
 */

import type { ChatMessageRow } from "./chatMessages";

export type ChatOutboxRecord = {
  localId: string;
  conversationId: string;
  senderId: string;
  text: string;
  replyToId: string | null;
  productId: number | null;
  createdAt: string;
  retryCount: number;
  imageBlob: Blob | null;
  /** Set when upload succeeded but insert failed */
  imageUrlRemote: string | null;
  voiceBlob: Blob | null;
  voiceMime: string | null;
  mediaUrlRemote: string | null;
};

const DB_NAME = "greenhub-chat-outbox";
const DB_VERSION = 1;
const STORE = "pending";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
  });
}

export async function outboxPut(record: ChatOutboxRecord): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await reqToPromise(tx.objectStore(STORE).put(record));
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function outboxDelete(localId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await reqToPromise(tx.objectStore(STORE).delete(localId));
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function outboxListConversation(conversationId: string): Promise<ChatOutboxRecord[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const all = await reqToPromise(store.getAll() as IDBRequest<ChatOutboxRecord[]>);
    return (all ?? []).filter((r) => r.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

export async function outboxListAll(): Promise<ChatOutboxRecord[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    return (await reqToPromise(tx.objectStore(STORE).getAll() as IDBRequest<ChatOutboxRecord[]>)) ?? [];
  } finally {
    db.close();
  }
}

/** True when the failure is likely network-related and we should keep the optimistic row + outbox. */
export function shouldQueueSendFailure(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|networkerror|load failed|timeout|ECONNRESET|ENOTFOUND|offline/i.test(msg)) return true;
  return false;
}

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/** Rehydrate UI row from a stored outbox record (object URLs for local blobs). */
export function outboxRecordToChatRow(r: ChatOutboxRecord): ChatMessageRow {
  let image_url: string | null = null;
  let media_url: string | null = null;
  if (r.imageBlob) image_url = URL.createObjectURL(r.imageBlob);
  else image_url = r.imageUrlRemote;
  if (r.voiceBlob) {
    media_url = URL.createObjectURL(r.voiceBlob);
  } else {
    media_url = r.mediaUrlRemote;
  }
  return {
    id: r.localId,
    sender_id: r.senderId,
    message: r.text,
    created_at: r.createdAt,
    status: "sent",
    delivered_at: null,
    read_at: null,
    reply_to_id: r.replyToId,
    reply_preview: null,
    image_url,
    media_url,
    edited: false,
    product_id: r.productId,
    client_sending: true,
    client_pending_local: true,
  };
}
