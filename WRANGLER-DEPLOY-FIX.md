# Wrangler Deploy Fix

The previous `wrangler.toml` contained this placeholder:

```toml
database_id = "REPLACE_WITH_CLOUDFLARE_D1_ID"
```

Cloudflare Pages reads `wrangler.toml` during deploy. Because that value is not a real D1 UUID, deployment fails with:

```text
Error 8000022: Invalid database UUID (REPLACE_WITH_CLOUDFLARE_D1_ID)
```

This patch removes the invalid placeholder binding from `wrangler.toml`.

Production bindings should stay configured in Cloudflare Dashboard:

- D1 binding name: `DB`
- R2 binding name: `MEDIA`

Use Pages settings for production bindings, then redeploy.
