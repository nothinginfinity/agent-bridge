# Cloudflare Multipart Form MCP

**status:** proposed
**priority:** high
**created:** 2026-05-24
**from:** ChatGPT
**project:** Cloudflare SuperDev / AFO Toolsmith / Workcells

---

## 1. Problem

Several Cloudflare Worker settings endpoints reject JSON payloads and require `multipart/form-data`.

Observed blocker:

```txt
Content-Type must be one of: multipart/form-data
```

This blocked attempts to update Worker settings/bindings from `mcp-prax` because the current raw Cloudflare API helper sends JSON only.

The most important target use case is updating Worker bindings/settings after a Worker deploy, especially preserving or restoring bindings like:

- D1 database bindings
- Workers AI binding
- Vectorize binding
- plain text vars
- service bindings
- KV/R2 bindings

This is foundational for reliable Cloudflare development workcells.

---

## 2. Needed MCP Tool

Create an MCP tool that can call Cloudflare endpoints using `multipart/form-data`.

Suggested worker/tool name:

```txt
cloudflare-multipart-mcp
```

Suggested main tool:

```txt
cf_api_multipart_request
```

---

## 3. Tool Description for AFO Toolsmith

A Cloudflare API helper that sends `multipart/form-data` requests. It lets agents update Worker settings and binding metadata for endpoints that reject JSON-only requests. It should support safe, structured multipart fields and file/text parts without exposing secrets in responses.

---

## 4. Tool Schema

```json
{
  "name": "cf_api_multipart_request",
  "description": "Send a Cloudflare API request using multipart/form-data for endpoints that reject JSON payloads, such as Worker settings/bindings updates.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "method": {
        "type": "string",
        "enum": ["POST", "PUT", "PATCH"]
      },
      "scope": {
        "type": "string",
        "enum": ["account", "zone"],
        "default": "account"
      },
      "path": {
        "type": "string",
        "description": "Path under /client/v4/accounts/{ACCOUNT_ID} or /client/v4/zones/{ZONE_ID}. Must start with /."
      },
      "fields": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "value": { "type": "string" },
            "content_type": { "type": "string" }
          },
          "required": ["name", "value"]
        }
      },
      "json_fields": {
        "type": "array",
        "description": "Fields whose value should be JSON.stringify(value).",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "value": {}
          },
          "required": ["name", "value"]
        }
      },
      "redact_response_keys": {
        "type": "array",
        "items": { "type": "string" },
        "default": ["text", "value", "secret", "token"]
      },
      "dry_run": {
        "type": "boolean",
        "default": false
      }
    },
    "required": ["method", "path"]
  }
}
```

---

## 5. Convenience Tool: Update Worker Settings Multipart

Suggested second tool:

```txt
update_worker_settings_multipart
```

Purpose: safer wrapper around the common Cloudflare Worker settings case.

Schema:

```json
{
  "name": "update_worker_settings_multipart",
  "description": "Update Cloudflare Worker settings/bindings using the multipart/form-data settings endpoint.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "script_name": { "type": "string" },
      "settings": {
        "type": "object",
        "description": "Cloudflare Worker settings object. Do not include plaintext secret values."
      },
      "dry_run": { "type": "boolean", "default": false }
    },
    "required": ["script_name", "settings"]
  }
}
```

Internally this should call:

```txt
PATCH /client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{script_name}/settings
Content-Type: multipart/form-data
```

With multipart field:

```txt
settings = JSON.stringify(settings)
```

---

## 6. Example: Vector Lab Bindings

Example call to bind `vector-lab-mcp` safely:

```json
{
  "script_name": "vector-lab-mcp",
  "settings": {
    "bindings": [
      {
        "type": "d1",
        "name": "DB",
        "id": "7a675862-1284-45a6-941a-3bcef0e540ef"
      },
      {
        "type": "ai",
        "name": "AI"
      },
      {
        "type": "vectorize",
        "name": "VECTORIZE",
        "index_name": "afo-messages"
      },
      {
        "type": "plain_text",
        "name": "DEFAULT_VECTORIZE_INDEX",
        "text": "afo-messages"
      }
    ]
  },
  "dry_run": false
}
```

---

## 7. Safety Rules

1. Never return secret values in responses.
2. Never accept or log plaintext secret values through this tool unless Jared explicitly creates a dedicated secure secret flow.
3. Redact likely secret-bearing keys from Cloudflare responses.
4. Require exact `script_name`; no wildcard operations.
5. No DELETE support in the generic multipart tool by default.
6. Default to `dry_run: true` during testing if implemented in Toolsmith UI.
7. The wrapper should show a before/after manifest using binding names/types only.
8. If the tool sees secret bindings, return only name/type, never value.

---

## 8. Worker Implementation Sketch

```js
async function cfMultipart(env, scope, path, method, fields, jsonFields) {
  const base = scope === 'zone'
    ? `https://api.cloudflare.com/client/v4/zones/${env.ZONE_ID}`
    : `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}`;

  const form = new FormData();

  for (const field of fields || []) {
    form.append(field.name, field.value);
  }

  for (const field of jsonFields || []) {
    form.append(field.name, JSON.stringify(field.value));
  }

  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`
      // Do NOT set Content-Type manually. Let fetch/FormData set boundary.
    },
    body: form
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  return redactCloudflareResponse({ ok: res.ok, status: res.status, data });
}
```

Important implementation note:

```txt
Do not manually set Content-Type for FormData.
```

The runtime must set the multipart boundary automatically.

---

## 9. Bindings Needed

For `cloudflare-multipart-mcp`:

```txt
CF_API_TOKEN  secret
ACCOUNT_ID    plain var
ZONE_ID       plain var, optional for zone-scoped endpoints
```

Minimum token scopes for Worker settings updates:

```txt
Account → Workers Scripts → Read
Account → Workers Scripts → Edit
```

Optional:

```txt
Zone → Workers Routes → Read/Edit
Zone → DNS → Read/Edit
```

---

## 10. Why This Matters

This tool closes the exact gap discovered during the Vector Lab / Toolsmith Admin / Cloudflare SuperDev build:

- JSON raw API helper worked for many endpoints.
- Worker settings/bindings failed because the endpoint requires multipart.
- Manual binding updates were needed from Jared's iPhone.
- A multipart MCP tool would let agents safely repair bindings after deploys.

This is a perfect example of Toolsmith's core value:

```txt
Agent hits missing capability → agent emits tool request → Jared builds MCP → capability becomes part of future workcells.
```

---

## 11. Recommended Belt Placement

Include this in:

- Claude Builder Workcell
- Cloudflare Build Belt
- Full Project Ops Belt

Do not include it in read-only belts.

Risk profile:

```txt
dev-only / high-power
```

---
