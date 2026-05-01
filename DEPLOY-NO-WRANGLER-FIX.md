# AZURA Cloudflare Pages deploy fix

This package intentionally removes `wrangler.toml`.

Reason: Cloudflare Pages was reading an older `wrangler.toml` with:

```toml
database_id = "REPLACE_WITH_CLOUDFLARE_D1_ID"
```

That causes deploy failure:

```text
Invalid database UUID (REPLACE_WITH_CLOUDFLARE_D1_ID)
```

Without `wrangler.toml`, Cloudflare Pages uses the dashboard production bindings.

Required dashboard bindings:

- D1 database binding name: `DB`, value: `azura_db`
- R2 bucket binding name: `MEDIA`, value: `azura-media`

Build settings:

- Framework preset: None
- Build command: empty
- Build output directory: `.`
- Root directory: empty

After pushing this package, redeploy from Cloudflare Pages.
