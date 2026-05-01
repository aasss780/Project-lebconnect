/** Snippet for SELECT … FROM users (public profile fields). */
const USER_PUBLIC_COLUMNS = `
  id, email, role, full_name, specialization, normalized_specialization, location,
  bio, skills, education, experience, profile_image, company_name, industry,
  normalized_industry, company_size, website, logo, cover_image,
  created_at, updated_at`;

module.exports = { USER_PUBLIC_COLUMNS };
