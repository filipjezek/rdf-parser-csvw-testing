import { Readable } from "node:stream";

export function strToStream(str: string) {
  const stream = new Readable();
  stream.push(str);
  stream.push(null);
  return stream;
}

export function dlToDict(dl: HTMLDListElement) {
  const dict: Record<string, string> = {};
  for (const child of dl.querySelectorAll("dt")) {
    const key = child.textContent.trim().toLowerCase();
    const value = child.nextElementSibling?.textContent.trim();
    if (value) {
      dict[key] = value;
    }
  }
  return dict;
}
