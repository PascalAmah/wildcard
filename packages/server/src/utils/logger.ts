const PREFIX = "[wildcard-server]";

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(msg: string, ...args: unknown[]): void {
    console.log(`${timestamp()} ${PREFIX} INFO  ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    console.warn(`${timestamp()} ${PREFIX} WARN  ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]): void {
    console.error(`${timestamp()} ${PREFIX} ERROR ${msg}`, ...args);
  },
};
