# Preview deploy operational notes

AFO Mobile Terminal preview deployment is intentionally separate from production deployment.

Allowed preview target:

```text
sample-restaurant-afo workers.dev
```

Required guard:

```text
confirm=preview-deploy
```

Production commands remain blocked/no-op:

- `deploy_worker`
- `register_worker`
- `write_production_receipt`

Preview deployment receipts must record:

- preview URL
- smoke-test results
- `preview_deploy: true`
- `production_deploy: false`
- `custom_domain_added: false`
- `production_route_added: false`
- `deployment_confirmed_changed: false`

No client custom domains or production routes are created by this preview layer.
