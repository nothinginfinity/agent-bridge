import assert from "node:assert/strict";
import { mapBusinessDataToSiteContent } from "../src/mapper.js";

const rows = mapBusinessDataToSiteContent({
  business: {
    name: "CCS Services Group",
    phone: "(555) 111-2222",
    address: "Los Angeles, CA",
    services: ["Kitchen Remodels", "ADUs"],
    hours: "Mon-Fri 8-5",
    description: "General contractor",
    colors: { primary: "#111111", accent: "#ffcc00" }
  }
});

const byKey = Object.fromEntries(rows.map(row => [row.key, row]));
assert.equal(byKey.company_name.value, "CCS Services Group");
assert.equal(byKey.phone.value, "(555) 111-2222");
assert.equal(byKey.services.type, "json");
assert.ok(byKey.business_profile.value.includes("Kitchen Remodels"));
console.log(JSON.stringify({ ok: true, row_count: rows.length, keys: rows.map(row => row.key) }, null, 2));
