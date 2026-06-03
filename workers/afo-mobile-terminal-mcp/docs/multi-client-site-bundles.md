# Multi-client AFO Site Bundle validation

AFO Mobile Terminal can validate different Site Bundle records from GitHub by passing source parameters in the query string.

GitHub remains the source of truth. Cloudflare remains runtime only. This interface validates, plans preview work, and writes dry-run validation receipts. It does not publish client sites.

## Defaults

If omitted, these defaults are used:

```json
{
  "owner": "nothinginfinity",
  "repo": "afo-site-bundle-contract",
  "ref": "main",
  "bundle_path": "examples/example-business/afo.site.bundle.json",
  "schema_path": "schema/afo.site.bundle.schema.json",
  "worker_path": "examples/example-business/worker",
  "receipt_path": "receipts/example-business.validation.dry-run.json"
}
```

## Read-only validation examples

```text
GET /bundle/validate?owner=nothinginfinity&repo=afo-site-bundle-contract&ref=main&bundle_path=examples/example-business/afo.site.bundle.json
```

```text
GET /bundle/worker/validate?worker_path=examples/example-business/worker
```

```text
GET /bundle/preview-plan?worker_path=examples/example-business/worker
```

```text
GET /bundle/smoke-test-plan?bundle_path=examples/example-business/afo.site.bundle.json
```

Read-only validation commands can be run through GET.

## Guarded receipt writing

Receipt writing is a guarded dry-run action:

```text
GET /bundle/write-validation-receipt-action?confirm=dry-run-receipt&receipt_path=receipts/example-business.validation.dry-run.json
```

For another client bundle:

```text
GET /bundle/write-validation-receipt-action?confirm=dry-run-receipt&bundle_path=examples/sample-restaurant/afo.site.bundle.json&worker_path=examples/sample-restaurant/worker&receipt_path=receipts/sample-restaurant.validation.dry-run.json
```

The receipt writer preserves validation truth. It writes dry-run evidence whether validation passes or fails. `result.passed` is true only when validation actually passes.

## Source safety rules

Requests are blocked when source inputs are unsafe. The route returns `blocked: true` and `ok: false`.

Blocked examples include:

- empty `owner`, `repo`, or `ref`
- empty `worker_path`
- `bundle_path` or `schema_path` not ending with `.json`
- `receipt_path` outside `receipts/`
- paths containing `..`
- paths starting with `/`
- paths containing backslashes
- paths containing protocol text such as `http://` or `https://`

## Client layout

Each client should get its own bundle path and receipt path, for example:

```text
examples/client-name/afo.site.bundle.json
examples/client-name/worker
receipts/client-name.validation.dry-run.json
```

## Blocked commands

These remain blocked/no-op in this dry-run layer:

- `deploy_worker`
- `register_worker`
- `write_production_receipt`
