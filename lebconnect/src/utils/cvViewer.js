/** Open an uploaded CV stored as a data URL or raw base64 string. */

function guessMime(fileName) {
  const f = String(fileName || "").toLowerCase();
  if (f.endsWith(".pdf")) return "application/pdf";
  if (f.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (f.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

function base64ToBlob(b64, mime) {
  const raw = atob(b64);
  const u8 = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) u8[i] = raw.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

/**
 * @returns {boolean} true if handled
 */
export function openUploadedCv(candidateCv, candidateCvFileName) {
  const s = typeof candidateCv === "string" ? candidateCv.trim() : "";
  if (!s) return false;
  const name = String(candidateCvFileName || "cv").trim() || "cv";
  let mime = guessMime(name);
  let b64Payload = s.replace(/\s+/g, "");

  const dm = s.match(/^data:([^;,]+)?;base64,(.+)$/is);
  if (dm) {
    if (dm[1]) mime = dm[1];
    b64Payload = dm[2].replace(/\s+/g, "");
  }

  try {
    const blob = base64ToBlob(b64Payload, mime);
    const url = URL.createObjectURL(blob);
    const pdfish =
      mime === "application/pdf" || /\.pdf$/i.test(name) || /^application\/pdf/i.test(mime);

    if (pdfish) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = name.split(/[/\\]/).pop() || name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    setTimeout(() => URL.revokeObjectURL(url), 90_000);
    return true;
  } catch (e) {
    console.error("[openUploadedCv]", e);
    return false;
  }
}
