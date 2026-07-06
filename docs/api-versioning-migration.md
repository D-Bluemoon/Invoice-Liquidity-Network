# API Versioning Migration Guide

## Overview

The ILN Indexer REST API now uses URL-based versioning. All endpoints are available under `/v1/`, and the previous unversioned URLs remain functional with deprecation headers until **1 January 2026**.

---

## What Changed

All REST routes are now prefixed with `/v1/`:

| Before | After |
|--------|-------|
| `GET /health` | `GET /v1/health` |
| `GET /invoices` | `GET /v1/invoices` |
| `GET /invoice/:id` | `GET /v1/invoice/:id` |
| `GET /stats` | `GET /v1/stats` |
| `GET /lps/top` | `GET /v1/lps/top` |
| `GET /lps/:address/stats` | `GET /v1/lps/:address/stats` |
| `GET /freelancers/:address/stats` | `GET /v1/freelancers/:address/stats` |
| `GET /history/:address` | `GET /v1/history/:address` |

Response bodies are identical between versioned and unversioned routes.

---

## Backward Compatibility

The old unversioned routes (`/invoices`, `/health`, etc.) continue to work but will include two additional response headers:

```
Deprecation: true
Sunset: Sat, 01 Jan 2026 00:00:00 GMT
```

After the sunset date these routes will be removed. Migrate to `/v1/` before then.

---

## Detecting the Served Version

All `/v1/` responses include:

```
API-Version: 1
```

You can inspect this header to confirm which version is serving a response.

---

## Version Negotiation

Two request-side mechanisms let callers indicate a preferred version without changing the URL:

### Accept header

```bash
curl -H "Accept: application/vnd.iln.v1+json" https://api.example.com/invoices
```

### API-Version header

```bash
curl -H "API-Version: 1" https://api.example.com/invoices
```

When either header is present, the response will include `API-Version: 1`.

---

## Migration Steps

1. Update base URL from `https://api.example.com` to `https://api.example.com/v1`:

   ```diff
   - const BASE = 'https://api.example.com';
   + const BASE = 'https://api.example.com/v1';
   ```

2. No other changes are needed — request parameters and response shapes are unchanged.

3. Verify by checking the `API-Version: 1` header in responses.

---

## curl Examples

**Before:**
```bash
curl https://api.example.com/invoices?status=Pending
curl https://api.example.com/invoice/42
curl https://api.example.com/stats
```

**After:**
```bash
curl https://api.example.com/v1/invoices?status=Pending
curl https://api.example.com/v1/invoice/42
curl https://api.example.com/v1/stats
```
