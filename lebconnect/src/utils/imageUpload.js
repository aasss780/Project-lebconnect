/**
 * Shrink oversized photos before PUT to avoid MySQL max_allowed_packet / timeouts.
 */

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = dataUrl;
  });
}

export async function fileToDataUrlViaReader(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * @param {File} file
 * @param {number} maxSide longest edge in px (default 1280)
 * @param {number} quality JPEG quality 0..1 when using JPEG output
 */
export async function fileToCompressedDataUrl(
  file,
  maxSide = 1280,
  quality = 0.82
) {
  const raw = await fileToDataUrlViaReader(file);
  let img;
  try {
    img = await loadImageElement(raw);
  } catch {
    return raw;
  }

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!(w && h)) return raw;
  if (w <= maxSide && h <= maxSide) return raw;

  let nw = w;
  let nh = h;
  if (w >= h) {
    nw = maxSide;
    nh = Math.max(1, Math.round((h * maxSide) / w));
  } else {
    nh = maxSide;
    nw = Math.max(1, Math.round((w * maxSide) / h));
  }

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, nw, nh);
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return raw;
  }
}

/** Re-encode an existing long data URL before PUT (e.g. from modal state). */
export async function compressDataUrlForUpload(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string" || !/^data:image\//i.test(dataUrl)) {
    return dataUrl;
  }
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], "upload.jpg", {
      type: blob.type || "image/jpeg",
    });
    return await fileToCompressedDataUrl(file);
  } catch {
    return dataUrl;
  }
}

