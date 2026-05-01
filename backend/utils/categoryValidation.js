/**
 * Allowed specialization / industry labels and resolution for stored display + normalized columns.
 */

const MIN_CUSTOM_LENGTH = 3;

const CANDIDATE_SPECIALIZATION_LABELS = [
  "Technology",
  "Marketing",
  "Finance",
  "Design",
  "Business",
  "Human Resources",
  "Education",
  "Healthcare",
  "Engineering",
  "Sales",
  "Customer Support",
  "Media",
  "Legal",
  "Other",
];

const COMPANY_INDUSTRY_LABELS = [
  "Technology",
  "Marketing",
  "Finance",
  "Healthcare",
  "Education",
  "Retail",
  "Manufacturing",
  "Construction",
  "Media",
  "Telecommunications",
  "Hospitality",
  "Real Estate",
  "Legal",
  "Transportation",
  "Other",
];

const SPEC_LABEL_TO_NORMALIZED = {
  Technology: "technology",
  Marketing: "marketing",
  Finance: "finance",
  Design: "design",
  Business: "business",
  "Human Resources": "human_resources",
  Education: "education",
  Healthcare: "healthcare",
  Engineering: "engineering",
  Sales: "sales",
  "Customer Support": "customer_support",
  Media: "media",
  Legal: "legal",
};

const INDUSTRY_LABEL_TO_NORMALIZED = {
  Technology: "technology",
  Marketing: "marketing",
  Finance: "finance",
  Healthcare: "healthcare",
  Education: "education",
  Retail: "retail",
  Manufacturing: "manufacturing",
  Construction: "construction",
  Media: "media",
  Telecommunications: "telecommunications",
  Hospitality: "hospitality",
  "Real Estate": "real_estate",
  Legal: "legal",
  Transportation: "transportation",
};

function slugCustom(text) {
  const s = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 128);
  return s || "";
}

function resolveCandidateSpecialization(categoryRaw, otherRaw) {
  const category = String(categoryRaw ?? "").trim();
  const other = String(otherRaw ?? "").trim();

  if (!category) {
    return { error: "Please select a specialization." };
  }

  if (!CANDIDATE_SPECIALIZATION_LABELS.includes(category)) {
    return { error: "Invalid specialization selection." };
  }

  if (category === "Other") {
    if (!other) {
      return { error: "Please describe your specialization." };
    }
    if (other.length < MIN_CUSTOM_LENGTH) {
      return {
        error: `Custom specialization must be at least ${MIN_CUSTOM_LENGTH} characters.`,
      };
    }
    const normalized = slugCustom(other);
    return { specialization: other, normalized: normalized || slugCustom(other + "_custom") };
  }

  const normalized = SPEC_LABEL_TO_NORMALIZED[category];
  return { specialization: category, normalized: normalized || slugCustom(category) };
}

function resolveCompanyIndustry(categoryRaw, otherRaw) {
  const category = String(categoryRaw ?? "").trim();
  const other = String(otherRaw ?? "").trim();

  if (!category) {
    return { error: "Please select an industry." };
  }

  if (!COMPANY_INDUSTRY_LABELS.includes(category)) {
    return { error: "Invalid industry selection." };
  }

  if (category === "Other") {
    if (!other) {
      return { error: "Please specify your industry." };
    }
    if (other.length < MIN_CUSTOM_LENGTH) {
      return {
        error: `Custom industry must be at least ${MIN_CUSTOM_LENGTH} characters.`,
      };
    }
    const normalized = slugCustom(other);
    return { industry: other, normalized: normalized || slugCustom(other + "_custom") };
  }

  const normalized = INDUSTRY_LABEL_TO_NORMALIZED[category];
  return { industry: category, normalized: normalized || slugCustom(category) };
}

/** For job post: profile must contain a preset label or a sufficiently long custom (Other) value. */
function industryDisplayLooksValid(display) {
  const s = String(display ?? "").trim();
  if (!s) return false;
  const presetsNoOther = COMPANY_INDUSTRY_LABELS.filter((x) => x !== "Other");
  if (presetsNoOther.includes(s)) return true;
  return s.length >= MIN_CUSTOM_LENGTH;
}

module.exports = {
  MIN_CUSTOM_LENGTH,
  CANDIDATE_SPECIALIZATION_LABELS,
  COMPANY_INDUSTRY_LABELS,
  resolveCandidateSpecialization,
  resolveCompanyIndustry,
  industryDisplayLooksValid,
};
