import fs from "node:fs/promises";
import path from "node:path";
import { vocabLocalhost, vocabOriginal, vocabPhysical } from "./vocab.js";

const testDir = import.meta.dirname.replaceAll("\\", "/") + "/../test-data";
const testSrcDir = import.meta.dirname.replaceAll("\\", "/") + "/../csvw/tests";
const vocabSrc = import.meta.dirname.replaceAll("\\", "/") + "/csvw.jsonld";

async function copyAndReplace(src: string, dest: string) {
  const entries = await fs.readdir(src, { withFileTypes: true });

  await fs.mkdir(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyAndReplace(srcPath, destPath);
    } else {
      let content = await fs.readFile(srcPath, "utf8");
      content = content
        .replaceAll("http://www.w3.org/2013/csvw/tests", "file:/" + testDir)
        .replaceAll(vocabOriginal, vocabLocalhost);
      await fs.writeFile(destPath, content);
    }
  }
}

async function prepareTestData() {
  await copyAndReplace(testSrcDir, testDir);
  await fs.writeFile(
    vocabPhysical,
    (
      await fs.readFile(vocabSrc, "utf8")
    ).replaceAll(vocabOriginal, vocabLocalhost)
  );
}

await prepareTestData();
