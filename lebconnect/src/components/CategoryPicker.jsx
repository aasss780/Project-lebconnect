import {
  COMPANY_INDUSTRY_OPTIONS,
  CANDIDATE_SPECIALIZATION_OPTIONS,
  OTHER_LABEL,
} from "../constants/categories";
import "./CategoryPicker.css";

const FIELD_CLASS = "category-picker-field";

/** @typedef {"candidate" | "company"} Variant */

/**
 * Dropdown + optional custom text for specialization or industry forms.
 *
 * @param {{
 *   variant: Variant,
 *   idPrefix: string,
 *   category: string,
 *   custom: string,
 *   categoryError?: string,
 *   customError?: string,
 *   onCategoryChange: (v: string) => void,
 *   onCustomChange: (v: string) => void,
 * }} props
 */
export default function CategoryPicker({
  variant,
  idPrefix,
  category,
  custom,
  categoryError,
  customError,
  onCategoryChange,
  onCustomChange,
}) {
  const options =
    variant === "company"
      ? COMPANY_INDUSTRY_OPTIONS
      : CANDIDATE_SPECIALIZATION_OPTIONS;
  const label = variant === "company" ? "Industry" : "Specialization";
  const customHint =
    variant === "company"
      ? "Describe your industry"
      : "Describe your specialization";

  const selectClass = [
    "lc-category-select",
    !category ? "lc-category-select--placeholder" : "",
    categoryError ? "lc-input-has-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const textClass = ["lc-category-text", customError ? "lc-input-has-error" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={FIELD_CLASS}>
      <label htmlFor={`${idPrefix}-cat`}>{label}</label>
      <div className="lc-category-select-wrap">
        <select
          id={`${idPrefix}-cat`}
          className={selectClass}
          value={category || ""}
          onChange={(e) => onCategoryChange(e.target.value)}
          required
        >
          <option value="" disabled>
            Select…
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {categoryError ? (
        <p className="lc-inline-error" role="alert">
          {categoryError}
        </p>
      ) : null}

      {category === OTHER_LABEL ? (
        <div className="category-picker-other">
          <label htmlFor={`${idPrefix}-cust`}>{customHint}</label>
          <input
            id={`${idPrefix}-cust`}
            type="text"
            className={textClass}
            value={custom}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="Type here…"
            autoComplete="off"
          />
          {customError ? (
            <p className="lc-inline-error" role="alert">
              {customError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
