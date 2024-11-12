import rdf from "rdf-ext";
import Parser from "rdf-parser-csvw";
import { dlToDict, strToStream } from "./utils.js";
import { JSDOM } from "jsdom";
import fs from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import DatasetExt from "rdf-ext/lib/Dataset.js";
import { it, describe } from "node:test";
import { equal, rejects } from "node:assert/strict";

enum SpecType {
  PASS,
  WARN,
  ERROR,
}

interface Spec {
  name: string;
  json: string;
  result: string;
  csv: string[];
  type: SpecType;
}

function getCSVJSON(info: Record<string, string>): {
  json: string;
  csv: string[];
} {
  let json: string, csv: string[];
  if (info["action"]?.endsWith(".csv")) {
    csv = info["action"].split(/\s+/);
  } else if (info["action"]?.endsWith(".json")) {
    json = info["action"];
  }
  if (info["implicit"]?.endsWith(".csv")) {
    csv = info["implicit"].split(/\s+/);
  } else if (info["implicit"]?.endsWith(".json")) {
    json = info["implicit"];
  }
  return { json: json!, csv: csv! };
}

async function crawlTests(): Promise<Spec[]> {
  const doc = await JSDOM.fromURL(
    "https://w3c.github.io/csvw/tests/reports/index.html"
  ).then((x) => x.window.document);
  const names = doc.querySelectorAll("#csvw-rdf-tests-1 > dl > dt");
  const infos = doc.querySelectorAll("#csvw-rdf-tests-1 > dl > dd");

  return Array.from(names).map((name, i) => {
    const info = dlToDict(infos[i].querySelector("dl"));
    const { json, csv } = getCSVJSON(info);

    return {
      name: name.textContent.trim(),
      json,
      result: info["result"],
      csv,
      type:
        info["type"] === "ToRdfTest"
          ? SpecType.PASS
          : info["type"] === "ToRdfTestWithWarnings"
          ? SpecType.WARN
          : SpecType.ERROR,
    };
  });
}

async function prepareFiles(spec: Spec) {
  const files = [
    spec.json &&
      ((rdf as any).io.dataset.fromURL(
        localURL(spec.json)
      ) as Promise<DatasetExt>),
    spec.result &&
      ((rdf as any).io.dataset.fromURL(
        localURL(spec.result)
      ) as Promise<DatasetExt>),
    spec.csv &&
      Promise.all(spec.csv.map((x) => fs.readFile(localURL(x), "utf-8"))),
  ] as const;
  await Promise.all(files);
  return {
    metadata: await files[0],
    expectedResult: await files[1],
    csv: await files[2],
  };
}

async function runTest(spec: Spec) {
  const { metadata, expectedResult, csv } = await prepareFiles(spec);
  if (csv?.length > 1) throw new Error("Multiple CSV files not supported");
  const parser = new Parser({
    metadata: metadata,
    baseIRI: baseIRI(spec.csv[0]),
  });

  if (spec.type === SpecType.ERROR) {
    rejects(() => rdf.dataset().import(parser.import(strToStream(csv[0]))));
  } else {
    const actual = await rdf
      .dataset()
      .import(parser.import(strToStream(csv[0])));
    equal(actual.toCanonical(), expectedResult.toCanonical());
  }
}

async function download(url: string) {
  fetch(url)
    .then((x) => x.text())
    .then((x) =>
      fs.writeFile(localURL(url), x, {
        flag: "w",
      })
    );
}

async function downloadAll(specs: Spec[]) {
  await Promise.all(
    specs.slice(0, 1).map(async (s) => {
      let tasks: Promise<void>[] = [];
      if (s.json) {
        tasks.push(download(s.json));
      }
      if (s.result) {
        tasks.push(download(s.result));
      }
      if (s.csv?.length) {
        tasks.push(...s.csv.map(download));
      }
      return Promise.all(tasks);
    })
  );
}

function localURL(url: string) {
  return fileURLToPath(import.meta.resolve("../test-data/" + basename(url)));
}
function baseIRI(url: string) {
  return url.replace(
    "http://www.w3.org/2013/csvw/tests/",
    "https://w3c.github.io/csvw/tests/"
  );
}

async function main() {
  const specs = await crawlTests();
  await downloadAll(specs);

  describe("CSVW tests", () => {
    for (const spec of specs) {
      it(spec.name, async () => {
        await runTest(spec);
      });
    }
  });
}

main();
