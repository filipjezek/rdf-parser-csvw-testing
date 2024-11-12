import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { it, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { basename } from "node:path";
import rdf from "rdf-ext";
import Parser from "rdf-parser-csvw";
import { strToStream } from "./utils.js";
import DatasetExt from "rdf-ext/lib/Dataset.js";
import { vocabLocalhost, vocabOriginal } from "./vocab.js";
import { closeServer, startServer } from "./server.js";
import { Spec, SpecType } from "./spec.js";

async function getTestCases(): Promise<Spec[]> {
  return JSON.parse(
    await fs.readFile(import.meta.dirname + "/cases.json", "utf-8")
  );
}

function removeQueryOrFragment(url: string) {
  let i = url.indexOf("#");
  let j = url.indexOf("?");
  if (i === -1) i = url.length;
  if (j === -1) j = url.length;
  return url.slice(0, Math.min(i, j));
}

async function loadLD(url: string) {
  return (rdf as any).io.dataset.fromURL(
    "file:/" + localURL(url)
  ) as Promise<DatasetExt>;
}

async function loadCSV(url: string) {
  return fs.readFile(localURL(url), "utf-8");
}

async function replaceVocab(dataset: DatasetExt): Promise<DatasetExt> {
  const strOutput = dataset
    .toString()
    .replaceAll(vocabOriginal, vocabLocalhost);
  return (rdf as any).io.dataset.fromText("text/turtle", strOutput);
}

async function runTest(spec: Spec) {
  let metadata: DatasetExt;
  const expectedResult = spec.result && (await loadLD(spec.result));
  let csv: string;
  let base: string;

  const implicitCSVs = spec.implicit.filter((x) =>
    new URL(x).pathname.endsWith(".csv")
  );
  const implicitJSONs = spec.implicit.filter((x) =>
    new URL(x).pathname.endsWith(".json")
  );

  if (new URL(spec.action).pathname.endsWith(".csv")) {
    csv = await loadCSV(spec.action);
    base = baseIRI(spec.action);
    const defaultJSON = spec.action.replace(".csv", "-metadata.json");
    if (implicitJSONs.length === 1) {
      metadata = await loadLD(implicitJSONs[0]);
    } else if (implicitJSONs.includes(defaultJSON)) {
      metadata = await loadLD(defaultJSON);
    }
  } else {
    if (implicitCSVs.length > 1)
      throw new Error("Multiple CSV files not supported");
    metadata = await loadLD(spec.action);
    if (implicitCSVs.length === 1) {
      csv = await loadCSV(implicitCSVs[0]);
      base = baseIRI(implicitCSVs[0]);
    }
  }

  const parser = new Parser({
    metadata: metadata,
    baseIRI: base,
  });

  let actual = await replaceVocab(
    await rdf.dataset().import(parser.import(strToStream(csv)))
  );
  if (spec.noProvenance) {
    // actual = actual.filter((q) => {
    //   console.log(q);
    //   return (
    //     !(
    //       q.subject.termType === "NamedNode" &&
    //       q.subject.value.startsWith(vocabLocalhost)
    //     ) &&
    //     !(
    //       q.object.termType === "NamedNode" &&
    //       q.object.value.startsWith(vocabLocalhost)
    //     ) &&
    //     !(
    //       q.predicate.termType === "NamedNode" &&
    //       q.predicate.value.startsWith(vocabLocalhost)
    //     )
    //   );
    // });
  }
  if (spec.type !== SpecType.ERROR) {
    assert.equal(actual.toCanonical(), expectedResult.toCanonical());
  }
}

function localURL(url: string) {
  return fileURLToPath(
    import.meta.resolve(
      "../test-data/" +
        removeQueryOrFragment(
          url.slice("http://www.w3.org/2013/csvw/tests/".length)
        )
    )
  );
}
function baseIRI(url: string) {
  return basename(url);
}

async function main() {
  const specs = (await getTestCases()).slice(0);

  describe("CSVW tests", () => {
    before(() => {
      console.log("Starting CSVW tests");
      startServer();
    });

    for (const spec of specs) {
      it(spec.name, async () => {
        if (spec.type === SpecType.ERROR) {
          await assert.rejects(() => runTest(spec));
        } else {
          await runTest(spec);
        }
      });
    }

    after(() => {
      console.log("CSVW tests completed");
      closeServer();
    });
  });
}

main();
