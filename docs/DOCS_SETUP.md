# Invoice Liquidity Network Docs

Documentation site for the Invoice Liquidity Network built with [Nextra](https://nextra.site) and [Algolia DocSearch](https://docsearch.algolia.com).

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

The docs site will be available at `http://localhost:3000`.

## Algolia DocSearch Setup

This documentation site uses Algolia DocSearch for fast, full-text search across all pages.

### Applying for DocSearch

1. Visit [https://docsearch.algolia.com/](https://docsearch.algolia.com/)
2. Fill out the application form with your documentation site URL (`https://docs.iln.finance`)
3. Algolia will review and approve your application (usually within 48 hours)
4. You'll receive API credentials: `appId` and `apiKey`

### Configuration

Once approved, follow these steps:

1. **Add environment variables** to `.env.local`:
   ```
   NEXT_PUBLIC_ALGOLIA_APP_ID=<your_app_id>
   NEXT_PUBLIC_ALGOLIA_API_KEY=<your_search_api_key>
   NEXT_PUBLIC_ALGOLIA_INDEX_NAME=iln-docs
   ```

2. **Deploy your docs site** so Algolia can crawl it

3. **Configure Algolia Crawler**:
   - Go to your Algolia Dashboard
   - Select "Crawlers"
   - Create a new crawler with the configuration from `algolia-crawler-config.json`
   - Start the crawler to index your site

### Using the Search

- Click the search button in the navigation bar
- Use keyboard shortcut: **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux)
- Press **Escape** to close the search modal

### Search Features

The search includes:
- All documentation pages
- Auto-generated API reference
- Headings and content sections
- Code examples

## Project Structure

```
docs/
├── pages/              # Next.js pages
├── components/         # React components
├── public/            # Static assets
├── analytics.md       # Documentation files (markdown)
├── theme.config.jsx   # Nextra theme configuration
├── next.config.js     # Next.js configuration
└── algolia-crawler-config.json  # Algolia crawler settings
```

## Building and Deploying

The docs site is built with `next build` and can be deployed to:
- [Vercel](https://vercel.com) (recommended for Next.js)
- [Netlify](https://netlify.com)
- Any Node.js hosting provider

For the in-repo docs, `cd packages/docs && npm ci && npm run build` produces
the static bundle that `docs-deploy.yml` uploads to GitHub Pages.

### CI / Deploy Flow

`docs-deploy.yml` runs both on **push to `main`** and on **pull_request**.
The matrix below shows what each trigger causes:

| Trigger | Files changed | `build` job | `deploy` job |
|---------|---------------|-------------|--------------|
| `push` on `main` | `packages/docs/**` or `docs/**` or workflow file    | ✅ Runs | ✅ Runs (publishes to Pages) |
| `pull_request` | `packages/docs/**` or `docs/**` or workflow file       | ✅ Runs | ❌ Skipped (`if:` gates it) |
| `workflow_dispatch` | — (manual) | ✅ Runs | ✅ Runs (manual publish) |

PR failures in the `build` job therefore **block merging** because they
report a non-zero exit. This is what avoids the historical issue where a
broken docs change could pass PR review, reach `main`, and only surface as
a Pages deploy failure.

### Algolia Crawler

After deployment, the Algolia crawler will:
1. Visit your site at `https://docs.iln.finance`
2. Crawl all linked pages
3. Extract content (title, headings, text)
4. Index into Algolia for searchability

## Documentation

For Nextra documentation, visit [nextra.site](https://nextra.site)
For Algolia DocSearch, visit [docsearch.algolia.com](https://docsearch.algolia.com)
