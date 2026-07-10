/// <reference types="vite/client" />

// Web Serial API 类型声明（仅 Chrome/Edge 支持）
interface SerialPort {
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: 'none' | 'even' | 'odd'; flowControl?: 'none' | 'hardware' }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; usbProductId?: number; };
}

interface Serial {
  requestPort(options?: { filters: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: (ev: Event) => void): void;
}

interface Navigator {
  serial?: Serial;
}
