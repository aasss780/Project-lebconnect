"use strict";

function stripDataUrlBase64(input) {
  if (typeof input !== "string") return "";
  const t = input.trim();
  const m = t.match(/^data:[^;]+;base64,(.+)$/is);
  return (m ? m[1] : t).replace(/\s+/g, "");
}

function extensionFromFileName(fileName) {
  const base = String(fileName || "").toLowerCase().split(/[/\\]/).pop();
  const i = base.lastIndexOf(".");
  if (i <= 0) return "";
  return base.slice(i + 1);
}

/**
 * Extract plain text from a PDF stored as base64 (optionally wrapped in a data URL).
 * Uses pdf-parse v2 (`PDFParse` + `getText()`).
 * @returns {Promise<{ text: string, error?: string }>}
 */
async function extractPdfTextFromBase64(base64) {
  const raw = stripDataUrlBase64(base64);
  if (!raw) {
    return { text: "", error: "empty_cv" };
  }
  let buffer;
  try {
    buffer = Buffer.from(raw, "base64");
  } catch {
    return { text: "", error: "invalid_base64" };
  }
  if (!buffer.length) return { text: "", error: "empty_buffer" };

  let parser;
  try {
    const { PDFParse } = require("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    const text = String(data?.text || "")
      .replace(/\r/g, "")
      .replace(/\u0000/g, "")
      .trim();
    return { text };
  } catch (err) {
    console.error("[extractPdfTextFromBase64]", err.message || err);
    return {
      text: "",
      error: err.message ? String(err.message) : "pdf_parse_failed",
    };
  } finally {
    if (parser && typeof parser.destroy === "function") {
      try {
        await parser.destroy();
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = {
  stripDataUrlBase64,
  extensionFromFileName,
  extractPdfTextFromBase64,
};
