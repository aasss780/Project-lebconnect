/** Shared company job create/edit payload helpers (Feed + My Jobs use the same API shape). */

export function normalizeJobRequirements(requirements) {
  if (Array.isArray(requirements))
    return requirements.map((s) => String(s).trim()).filter(Boolean);
  if (typeof requirements === "string") {
    return requirements
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function buildCreateJobPayload({
  title,
  description,
  location = "",
  type = "",
  salary = "",
  requirements = [],
}) {
  return {
    title: String(title ?? "").trim(),
    description: String(description ?? "").trim(),
    location: String(location ?? "").trim(),
    type: String(type ?? "").trim(),
    salary: String(salary ?? "").trim(),
    requirements: normalizeJobRequirements(requirements),
  };
}

/** POST /api/jobs — returns parsed API response. */
export async function createCompanyJob(api, payload) {
  const { data } = await api.post("/api/jobs", payload);
  return data;
}

export function jobIdFromCreateResponse(data) {
  return (
    data?.job?.id ??
    data?.job?._id ??
    data?.id ??
    data?._id ??
    null
  );
}

/** Optional feed announcement linked to jobId. */
export async function announceJobOnFeed(api, { jobId, title, image }) {
  const content = `We are hiring: ${String(title).trim()}`;
  await api.post("/api/posts", {
    content,
    ...(jobId != null && Number.isFinite(Number(jobId)) ? { jobId: Number(jobId) } : {}),
    ...(image ? { image } : {}),
  });
}
