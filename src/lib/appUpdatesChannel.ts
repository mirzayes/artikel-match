const CHANNEL_NAME = 'app_updates';

let listenerChannel: BroadcastChannel | null = null;

/** Bütün açıq tab-larda `reload` mesajı gələndə səhifəni yeniləyir. */
export function initAppUpdatesBroadcast(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  if (listenerChannel) return;
  try {
    listenerChannel = new BroadcastChannel(CHANNEL_NAME);
    listenerChannel.onmessage = (event: MessageEvent) => {
      if (event.data === 'reload') {
        window.location.reload();
      }
    };
  } catch {
    /* ignore */
  }
}

/** Eyni origin-dəki bütün tab-lara yeniləmə siqnalı göndərir (bu tab da mesajı alıb reload edə bilər). */
export function broadcastReloadAllTabs(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage('reload');
    bc.close();
  } catch {
    /* ignore */
  }
}

export function closeAppUpdatesBroadcast(): void {
  listenerChannel?.close();
  listenerChannel = null;
}
