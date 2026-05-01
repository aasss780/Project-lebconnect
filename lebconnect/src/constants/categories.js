export const CANDIDATE_SPECIALIZATION_OPTIONS = [
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

export const COMPANY_INDUSTRY_OPTIONS = [
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

export const OTHER_LABEL = "Other";

export const MIN_CATEGORY_CUSTOM_LENGTH = 3;

export function inferCategorySelection(storedValue, optionListWithOther = []) {
  const s = String(storedValue ?? "").trim();
  if (optionListWithOther.includes(s)) {
    return { category: s, custom: "" };
  }
  return { category: OTHER_LABEL, custom: s };
}

export function composeCategoryErrors(
  category,
  custom,
  optionListWithOther = CANDIDATE_SPECIALIZATION_OPTIONS
) {
  const cat = String(category ?? "").trim();
  if (!cat) {
    return {
      category: "Please choose an option.",
      custom: "",
    };
  }
  if (!optionListWithOther.includes(cat)) {
    return { category: "Invalid selection.", custom: "" };
  }
  if (cat !== OTHER_LABEL) {
    return { category: "", custom: "" };
  }
  const t = String(custom ?? "").trim();
  if (!t) {
    return { category: "", custom: "Please enter a description." };
  }
  if (t.length < MIN_CATEGORY_CUSTOM_LENGTH) {
    return {
      category: "",
      custom: `Use at least ${MIN_CATEGORY_CUSTOM_LENGTH} characters.`,
    };
  }
  return { category: "", custom: "" };
}

export function composeIndustryErrors(category, custom) {
  return composeCategoryErrors(category, custom, COMPANY_INDUSTRY_OPTIONS);
}
