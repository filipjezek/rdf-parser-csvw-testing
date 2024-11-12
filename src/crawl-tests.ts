import fs from "node:fs/promises";
import { JSDOM } from "jsdom";
import { dlToDict } from "./utils.js";
import { Spec, SpecType } from "./spec.js";

async function crawlTests(): Promise<Spec[]> {
  const doc = await JSDOM.fromURL(
    "https://w3c.github.io/csvw/tests/reports/index.html"
  ).then((x) => x.window.document);
  const names = doc.querySelectorAll("#csvw-rdf-tests-1 > dl > dt");
  const infos = doc.querySelectorAll("#csvw-rdf-tests-1 > dl > dd");

  return Array.from(names).map((name, i) => {
    const info = dlToDict(infos[i].querySelector("dl"));

    return {
      name: name.textContent.trim(),
      action: info["action"],
      result: info["result"],
      implicit: info["implicit"]?.split(/\s+/) ?? [],
      type:
        info["type"] === "ToRdfTest"
          ? SpecType.PASS
          : info["type"] === "ToRdfTestWithWarnings"
          ? SpecType.WARN
          : SpecType.ERROR,
      noProvenance: info["options"]?.includes("noProv: true"),
    };
  });
}

async function main() {
  await fs.writeFile(
    import.meta.dirname + "/cases.json",
    JSON.stringify(await crawlTests(), null, 2),
    { flag: "w" }
  );
}

main();
