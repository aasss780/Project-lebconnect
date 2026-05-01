/**
 * Map free-text specialization/industry into a small set of buckets.
 * Unknown inputs become lowercase trimmed strings (fallback category).
 */

const TECH_PATTERNS = [
  /computer\s*science/i,
  /\bcs\b/i,
  /software\s*engineering/i,
  /\bsoftware\s*engineer/i,
  /\bdeveloper\b/i,
  /\bdevops\b/i,
  /\bprogramming\b/i,
  /\bprogrammer\b/i,
  /\bfrontend\b/i,
  /\bfront[\s-]*end\b/i,
  /\bbackend\b/i,
  /\bback[\s-]*end\b/i,
  /\bweb\s*developer\b/i,
  /\bfull\s*stack\b/i,
  /\bfullstack\b/i,
];

const MARKETING_PATTERNS = [
  /\bmarketing\b/i,
  /\bdigital\s*marketing\b/i,
  /\bcontent\b/i,
];

const FINANCE_PATTERNS = [/finance/i, /\baccounting\b/i, /\bbanking\b/i];

const DESIGN_PATTERNS = [
  /\bdesign\b/i,
  /\bui\b/i,
  /\bux\b/i,
  /\buix\b/i,
  /\bgraphic\s*design\b/i,
];

const HR_PATTERNS = [/\bhr\b/i, /\bhuman\s*resources\b/i];

const BUSINESS_PATTERNS = [/\bbusiness\b/i, /\bmanagement\b/i];

function firstMatch(patterns, s) {
  return patterns.some((p) => p.test(s));
}

function normalizeCategory(input) {
  if (input == null) return "";
  const raw = String(input).trim();
  if (!raw) return "";
  const s = raw.toLowerCase();

  if (firstMatch(TECH_PATTERNS, s)) return "technology";
  if (firstMatch(MARKETING_PATTERNS, s)) return "marketing";
  if (firstMatch(FINANCE_PATTERNS, s)) return "finance";
  if (firstMatch(DESIGN_PATTERNS, s)) return "design";
  if (firstMatch(HR_PATTERNS, s)) return "hr";
  if (firstMatch(BUSINESS_PATTERNS, s)) return "business";

  return s.replace(/\s+/g, " ").trim();
}

function normalizeSpecialization(specialization) {
  return normalizeCategory(specialization);
}

function normalizeIndustry(industry) {
  return normalizeCategory(industry);
}

module.exports = {
  normalizeCategory,
  normalizeSpecialization,
  normalizeIndustry,
};
