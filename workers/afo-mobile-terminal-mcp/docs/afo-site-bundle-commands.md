# AFO Site Bundle dry-run and preview commands

AFO Mobile Terminal exposes preview-safe commands for validating AFO Site Bundle records from GitHub, writing dry-run evidence receipts, and triggering a guarded preview-only Worker deployment.

## Validation commands

- `validate_bundle`
- `validate_worker`
- `preview_plan`
- `smoke_test_plan`
- `write_validation_receipt`

Read-only commands may be called through GET routes. Receipt writing requires the dry-run confirmation guard:

```text
GET /bundle/write-validation-receipt-action?confirm=dry-run-receipt
```

## Preview deployment command

`deploy_preview_worker` is a guarded preview-only command.

HTTP route:

```text
GET /bundle/deploy-preview-worker-action?confirm=preview-deploy
```

Sample restaurant example:

```text
GET /bundle/deploy-preview-worker-action?confirm=preview-deploy&bundle_path=examples/sample-restaurant/afo.site.bundle.json&worker_path=examples/sample-restaurant/worker&receipt_path=receipts/sample-restaurant.preview-deploy.json
```

The command is allowed only for preview deployment to the Worker `workers.dev` runtime. It must not attach a custom domain, must not create production routes, must not add account identifiers, must not add protected runtime values, and must not set `deployment.confirmed` to `true`.

For the sample restaurant flow, the expected Worker name is:

```text
sample-restaurant-afo
```

Expected preview receipt path:

```text
receipts/sample-restaurant.preview-deploy.json
```

Preview receipts include:

- `receipt_type: preview_deploy`
- `dry_run: false`
- `preview_deploy: true`
- `production_deploy: false`
- `deployed: true`
- `production_deploy_attempted: false`
- `runtime_publish_attempted: true`
- `custom_domain_added: false`
- `production_route_added: false`
- `deployment_confirmed_changed: false`
- source repo info
- bundle path
- Worker path
- preview URL
- smoke-test results
- timestamp
- actor
- Cloudflare Worker name
- deploy receipt/id if available

## Source parameters

All safe commands accept optional source parameters:

- `owner`
- `repo`
- `ref`
- `bundle_path`
- `schema_path`
- `worker_path`
- `receipt_path`

Unsafe source input is blocked before GitHub reads or writes.

## Blocked production commands

These commands remain blocked/no-op:

- `deploy_worker`
- `register_worker`
- `write_production_receipt`

Production deployment, production registration, custom domains, and production receipts are not part of this layer.
