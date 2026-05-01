/** @typedef {{ showImagePreview?: (src: string) => void; onMissing?: () => void }} OpenCvOptions */

function pickString(v) {
  if (v == null) return "";
  if (typeof v !== "string") return "";
  return v.trim();
}

function extensionLower(name) {
  const n = pickString(name);
  const dot = n.lastIndexOf(".");
  if (dot <= 0) return "";
  return n.slice(dot + 1).toLowerCase();
}

function mimeFromExtension(extNoDot) {
  const e = String(extNoDot || "").toLowerCase();
  if (e === "pdf") return "application/pdf";
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "gif") return "image/gif";
  if (e === "webp") return "image/webp";
  if (e === "bmp") return "image/bmp";
  if (e === "doc") return "application/msword";
  if (e === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "";
}

function isHttpUrl(raw) {
  return /^https?:\/\//i.test(String(raw || "").trim());
}

function parseDataUrl(raw) {
  const trimmed = String(raw || "").trim();
  const m = /^data:\s*([^;,]+);\s*base64\s*,([\s\S]*)$/i.exec(trimmed);
  if (!m) return null;
  return {
    mime: m[1].trim().split(";")[0].trim(),
    b64Payload: m[2].trim(),
  };
}

function looksLikeStandaloneBase64(s) {
  const t = String(s || "").replace(/\s+/g, "");
  if (!t || t.length < 24) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(t);
}

function base64DecodeToBlob(b64, mime) {
  const clean = String(b64 || "").replace(/\s/g, "");
  if (!clean.length) return null;
  try {
    const binStr =
      typeof atob === "function" ? atob(clean.slice(0, clean.length)) : "";
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new Blob([bytes], {
      type: mime || "application/octet-stream",
    });
  } catch {
    return null;
  }
}

function sniffMime(bytes) {
  if (!bytes || bytes.length < 4) return "";
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return "application/pdf";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return "image/png";
  }
  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38
  ) {
    return "image/gif";
  }
  return "";
}

function decodeLeadingBytesBase64(b64Clean, maxDecoded = 32) {
  const need = Math.min(
    Math.ceil(maxDecoded / 3) * 4,
    b64Clean.length - (b64Clean.length % 4)
  );
  const slice = need > 0 ? b64Clean.slice(0, need) : b64Clean;
  if (!slice.length) return null;
  try {
    const bin = typeof atob === "function" ? atob(slice) : "";
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function sanitizeDownloadName(fname, fallbackExt) {
  const base =
    fname && pickString(fname)
      ? fname
      : fallbackExt
        ? `resume.${fallbackExt}`
        : "resume.bin";
  return pickString(base).replace(/[^\w.-]+/g, "_").slice(0, 180) || "resume.bin";
}

function mimeToExt(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  if (m.includes("webp")) return "webp";
  if (m.includes("msword")) return "doc";
  if (m.includes("wordprocessing")) return "docx";
  return "bin";
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeDownloadName(filename, "");
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 90_000);
  }
}

/** Open PDF inline in new tab via full-page iframe (works when blob: URLs are scoped). */
function openPdfIframePage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      triggerDownload(blob, "resume.pdf");
      URL.revokeObjectURL(url);
      return;
    }
    const doc = w.document;
    doc.open();
    doc.write(
      "<!DOCTYPE html><html><head><meta charset='utf-8'/><title>CV</title><style>html,body{margin:0;height:100%;}</style></head><body></body></html>"
    );
    doc.close();
    const iframe = doc.createElement("iframe");
    iframe.src = url;
    iframe.title = "CV (PDF)";
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100vh";
    doc.body.appendChild(iframe);
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch {
    triggerDownload(blob, "resume.pdf");
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

function isPdfMime(m) {
  return /^application\/pdf$/i.test(String(m || ""));
}

function isImageMime(m) {
  return /^image\//i.test(String(m || ""));
}

function standaloneBase64ToBlob(cvText, fileNameHint) {
  const trimmedOuter = String(cvText || "").trim();
  const clean = trimmedOuter.replace(/\s/g, "");
  if (!clean || !looksLikeStandaloneBase64(trimmedOuter)) return null;

  const ext = extensionLower(fileNameHint);
  let mime = mimeFromExtension(ext);
  const lead = decodeLeadingBytesBase64(clean);
  const sniff = lead?.length ? sniffMime(lead) : "";
  if (sniff) mime = sniff;
  if (!mime) mime = "application/octet-stream";

  return base64DecodeToBlob(clean, mime);
}

/**
 * Opens a candidate CV safely. Handles `cv`/`cv_file`/`cvFile` and filename variants.
 */
export function openCv(application, options = {}) {
  try {
    const cv =
      pickString(application?.cv) ||
      pickString(application?.cv_file) ||
      pickString(application?.cvFile) ||
      "";
    const fileName =
      pickString(application?.cvFileName) ||
      pickString(application?.cv_file_name) ||
      pickString(application?.cvFilename) ||
      "";

    if (!cv) {
      const msg = "No CV uploaded";
      if (typeof options.onMissing === "function") options.onMissing();
      else if (typeof window !== "undefined") window.alert?.(msg);
      return;
    }

    if (isHttpUrl(cv)) {
      window.open(cv.trim(), "_blank", "noopener,noreferrer");
      return;
    }

    if (/^data:/i.test(cv.trim())) {
      const parsed = parseDataUrl(cv);
      if (!parsed?.b64Payload) return;
      const mimeHeader = parsed.mime || "application/octet-stream";
      const blob = base64DecodeToBlob(parsed.b64Payload, mimeHeader);
      if (!blob) return;

      const eff = blob.type || mimeHeader;

      if (isPdfMime(eff)) {
        openPdfIframePage(blob);
        return;
      }
      if (isImageMime(eff)) {
        const url = URL.createObjectURL(blob);
        if (typeof options.showImagePreview === "function") {
          options.showImagePreview(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
          setTimeout(() => URL.revokeObjectURL(url), 120_000);
        }
        return;
      }
      if (
        /word|msword|officedocument|spreadsheet/i.test(String(eff)) ||
        /\.docx?$/i.test(fileName)
      ) {
        triggerDownload(blob, sanitizeDownloadName(fileName, mimeToExt(eff)));
        return;
      }
      triggerDownload(blob, sanitizeDownloadName(fileName, mimeToExt(eff)));
      return;
    }

    const blob = standaloneBase64ToBlob(cv, fileName || "resume");
    if (!blob) return;

    const eff = blob.type;

    if (isPdfMime(eff)) {
      openPdfIframePage(blob);
      return;
    }
    if (isImageMime(eff)) {
      const url = URL.createObjectURL(blob);
      if (typeof options.showImagePreview === "function") {
        options.showImagePreview(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      }
      return;
    }
    if (/word|officedocument|msword/i.test(String(eff)) || /\.docx?$/i.test(fileName)) {
      triggerDownload(blob, sanitizeDownloadName(fileName, mimeToExt(eff)));
      return;
    }
    /** Unknown binary → download with hint name */
    triggerDownload(blob, sanitizeDownloadName(fileName, mimeToExt(eff)));
  } catch {
    /* intentionally silent — malformed attachment should not crash */
  }
}

export function hasCvAttachment(application) {
  try {
    return Boolean(
      pickString(application?.cv) ||
        pickString(application?.cv_file) ||
        pickString(application?.cvFile)
    );
  } catch {
    return false;
  }
}
