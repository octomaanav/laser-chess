// Thin WebSocket wrapper with auto-reconnect. Browser-only.
type Handler<T> = (arg: T) => void;

export class Net<Msg = unknown> {
  private ws: WebSocket | null = null;
  private handlers: { open: Handler<void>[]; message: Handler<Msg>[]; close: Handler<void>[] } = {
    open: [],
    message: [],
    close: [],
  };
  private _backoff = 500;
  private _closed = false;

  on(type: 'open' | 'close', fn: Handler<void>): this;
  on(type: 'message', fn: Handler<Msg>): this;
  on(type: 'open' | 'message' | 'close', fn: Handler<never>): this {
    (this.handlers[type] as Handler<never>[]).push(fn);
    return this;
  }
  private _emit(type: 'open' | 'close'): void;
  private _emit(type: 'message', arg: Msg): void;
  private _emit(type: 'open' | 'message' | 'close', arg?: Msg): void {
    for (const fn of this.handlers[type] as Handler<Msg | void>[]) fn(arg as Msg);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connect() {
    this._closed = false;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this._backoff = 500;
      this._emit('open');
    };
    ws.onmessage = (e) => {
      let msg: Msg;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }
      this._emit('message', msg);
    };
    ws.onclose = () => {
      this._emit('close');
      if (this._closed) return;
      setTimeout(() => this.connect(), this._backoff);
      this._backoff = Math.min(this._backoff * 1.7, 8000);
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }

  send(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  close() {
    this._closed = true;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }
}
