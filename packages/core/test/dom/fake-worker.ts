import { resolveObjectURL } from "node:buffer";
import vm from "node:vm";

type Handler = (event: { data: unknown }) => void;

const isHandler = (value: unknown): value is Handler =>
  typeof value === "function";

export class FakeWorker extends EventTarget {
  static globals: Record<string, unknown> = {};

  static moved: ((transfer: readonly unknown[]) => void) | null = null;

  static made: FakeWorker[] = [];

  static silent = false;

  terminated = false;

  private readonly ready: Promise<Handler | null>;

  constructor(url: string) {
    super();
    FakeWorker.made.push(this);
    const blob = resolveObjectURL(url);
    const context = vm.createContext({
      Blob,
      ...FakeWorker.globals,
      postMessage: (data: unknown, transfer: readonly unknown[] = []) => {
        FakeWorker.moved?.(transfer);
        this.dispatchEvent(new MessageEvent("message", { data }));
      },
    });
    this.ready = (async () => {
      const source = (await blob?.text()) ?? "";
      try {
        vm.runInContext(source, context);
      } catch {
        this.dispatchEvent(new Event("error"));
        return null;
      }
      const handler: unknown = context.onmessage;
      return isHandler(handler) ? handler : null;
    })();
  }

  postMessage(data: unknown): void {
    if (FakeWorker.silent) {
      structuredClone(data);
      return;
    }
    void this.deliver(data);
  }

  private async deliver(data: unknown): Promise<void> {
    const handler = await this.ready;
    if (!this.terminated) {
      handler?.({ data });
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}
