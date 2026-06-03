# AFO Site Bundle dry-run commands

AFO Mobile Terminal exposes preview-safe commands for validating an AFO Site Bundle from GitHub and writing dry-run evidence receipts.

## Guarded receipt writing

Real HTTP clients may use:

```text
POST /bundle/write-validation-receipt
```

Agent/mobile clients that cannot reliably send POST may use:

```text
GET /bundle/write-validation-receipt-action?confirm=dry-run-receipt
```

The GET action is blocked unless the exact confirmation query parameter is present.

Dry-run validation receipts are evidence receipts. They should be written whether validation passes or fails. The receipt must preserve the truth of validation:

- `result.passed` is `true` only when validation passes.
- `result.errors` lists failed validation checks.
- `checks` contains the full validation check list.
- `write_back.status` is `written_validation_passed` when validation passes.
- `write_back.status` is `written_validation_failed` when validation fails.

Receipts remain dry-run only and include:

- `dry_run: true`
- `deployed: false`
- `production_deploy_attempted: false`
- `runtime_publish_attempted: false`
- source repo info
- preview plan
- smoke-test plan
- generated timestamp
- actor
- invocation method

## `/cmd` guard

Read-only commands remain GET-accessible:

```text
/cmd/validate_bundle
/cmd/validate_worker
/cmd/preview_plan
/cmd/smoke_test_plan
```

The write command requires confirmation:

```text
/cmd/write_validation_receipt?confirm=dry-run-receipt
```

Without confirmation, it returns a blocked response and writes nothing.

## Blocked commands

These commands remain blocked/no-op in this dry-run layer:

- `deploy_worker`
- `register_worker`
- `write_production_receipt`

They return blocked responses and take no production action.
