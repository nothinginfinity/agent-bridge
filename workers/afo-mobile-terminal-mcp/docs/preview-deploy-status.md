# Preview deploy status

Status: partial.

Done:

- Sample Restaurant bundle exists in the contract repo.
- Dry-run validation receipt is working for Sample Restaurant.
- A transport app mirror was added for `sample-restaurant-afo`.
- Production-oriented commands remain blocked.

Pending:

- Add the live Mobile Terminal route for `deploy_preview_worker`.
- Verify no-confirm preview action blocks.
- Run confirmed preview deploy to workers.dev only.
- Smoke-test the preview URL.
- Write `receipts/sample-restaurant.preview-deploy.json`.

Safety notes:

- No client custom domain should be attached.
- No production route should be created.
- No account-scoped identifiers or protected runtime values should be added.
- `deployment.confirmed` must remain false.
