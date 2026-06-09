export function normalizeString(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).map(normalizeString).filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/\s+/g, " ").trim();
}

export function pickFirst(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

export function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(normalizeString).filter(Boolean);
  if (typeof value === "string") return value.split(/\n|,|•|;/).map(normalizeString).filter(Boolean);
  if (typeof value === "object") return Object.values(value).map(normalizeString).filter(Boolean);
  return [normalizeString(value)].filter(Boolean);
}

export function mapBusinessDataToSiteContent(input = {}) {
  const business = input.business || input.biz || input.data || input.normalized || input;
  const colors   = business.colors || business.brand_colors || {};
  const services = asArray(business.services || business.service_list || business.offerings);
  const hours    = business.hours || business.business_hours || business.opening_hours || "";
  const address  = pickFirst(business, ["address", "street_address", "location", "full_address"]);
  const phone    = pickFirst(business, ["phone", "telephone", "phone_number", "primary_phone"]);
  const companyName  = pickFirst(business, ["company_name", "business_name", "name", "title"]);
  const about        = pickFirst(business, ["about", "description", "summary", "bio", "overview"]);
  const website      = pickFirst(business, ["website", "url", "source_url", "homepage"]);
  const email        = pickFirst(business, ["email", "contact_email"]);
  const primaryColor   = normalizeString(colors.primary   || business.primary_color   || "");
  const secondaryColor = normalizeString(colors.secondary || business.secondary_color || "");
  const accentColor    = normalizeString(colors.accent    || business.accent_color    || "");
  const rows = [];
  const push = (key, value, type = "text") => {
    const normalized = type === "json" ? JSON.stringify(value ?? null) : normalizeString(value);
    if (normalized && normalized !== "null" && normalized !== "[]" && normalized !== "{}") rows.push({ key, value: normalized, type });
  };
  push("company_name",    companyName);
  push("phone",           phone);
  push("email",           email);
  push("address",         address);
  push("website",         website);
  push("about",           about);
  push("services",        services,                                 "json");
  push("hours",           hours, typeof hours === "object" ? "json" : "text");
  push("primary_color",   primaryColor);
  push("secondary_color", secondaryColor);
  push("accent_color",    accentColor);
  push("business_profile", { companyName, phone, email, address, website, about, services, hours, colors }, "json");
  return rows;
}
