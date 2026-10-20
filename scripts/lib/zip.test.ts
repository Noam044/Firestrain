import { test } from "node:test";
import assert from "node:assert/strict";
import { readZipEntry } from "./zip.ts";

// Archive written by Python's zipfile: one stored entry, one deflated entry.
const ARCHIVE = Buffer.from(
  "UEsDBBQAAAAAAAAAIQC1Aa8PCwAAAAsAAAAFAAAAYS50eHRzdG9yZWQgdGV4dFBLAwQUAAAACABXYlRdwBF/dhsAAABCAAAADQAAAEluY2VuZGllcy5jc3ZzzMs7vDLV2q809/DKonwuIwMjU2tDLkcSRAFQSwECFAMUAAAAAAAAACEAtQGvDwsAAAALAAAABQAAAAAAAAAAAAAAgAEAAAAAYS50eHRQSwECFAMUAAAACABXYlRdwBF/dhsAAABCAAAADQAAAAAAAAAAAAAAgAEuAAAASW5jZW5kaWVzLmNzdlBLBQYAAAAAAgACAG4AAAB0AAAAAAA=",
  "base64",
);

test("readZipEntry reads stored and deflated entries", () => {
  assert.equal(readZipEntry(ARCHIVE, "a.txt").toString("utf8"), "stored text");
  assert.equal(readZipEntry(ARCHIVE, "Incendies.csv").toString("utf8"), "Année;Numéro\n2025;1\n".repeat(3));
});

test("readZipEntry reports missing entries and non-ZIP input", () => {
  assert.throws(() => readZipEntry(ARCHIVE, "absent.csv"), /not found/);
  assert.throws(() => readZipEntry(Buffer.from("not a zip at all, definitely not"), "a.txt"), /not a ZIP/);
});
