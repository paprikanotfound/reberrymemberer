# sv
...//untogether.now

## start

git init
git remote add origin https://github.com/paprikanotfound/untogethernow
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main

## D1 migrations

```
npx wrangler d1 migrations create untogether-db <message>
npx wrangler d1 migrations list untogether-db
npx wrangler d1 migrations apply untogether-db --local
npx wrangler d1 execute untogether-db --local --file=./local.queries.sql
```

## Workers secrets
[Secrets on deployed Workers](https://developers.cloudflare.com/workers/configuration/secrets/#adding-secrets-to-your-project)

```
npx wrangler pages secret put <KEY>
npx wrangler pages versions secret put <KEY>
```