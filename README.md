# SEO Dashboard (static, self-hosted)

Plain HTML, CSS and JavaScript. No database, no build step, no server code.

```
index.html          dashboard (month picker, trends, keywords, leads, history)
admin.html          monthly entry form, produces an updated months.json
app.js, admin.js    page scripts
style.css           shared styles (light and dark)
data/months.json    every month's figures. This is your history.
nginx.conf.example  example server block with password protection
```

## Try it locally

    cd seo-dashboard
    python3 -m http.server 8080

Open http://localhost:8080. Opening index.html by double-click will not work, because browsers block loading the data file from disk.

## Deploy

Copy the whole folder to any web server (Nginx, Apache, cPanel public_html, an S3 bucket). Fonts load from Google Fonts; everything else is local.

Protect it. The data is commercial, and the files are marked noindex but not private. See `nginx.conf.example` for basic auth, or use your host's password-protect-directory feature.

## Monthly routine (about 5 minutes)

1. Open `admin.html`, choose **New month**. Last month's keywords and page types are pre-filled.
2. Type in the month's figures and the keyword positions. Warnings appear if brand + non-brand clicks don't equal total clicks, or if page leads don't add up to the total.
3. Press **Save month**, then **Download months.json**.
4. Upload it over `data/months.json` on the server.
5. Open `index.html`. The new month is selected, compared with the one before, and added to the trend charts and history table.

To fix an old month, pick it in the "Month to edit" list on the entry page and save again.

## Keep backups

`data/months.json` is the only file holding your history. Before each upload, keep the old copy (for example `months-2026-10.json`) somewhere safe.

## Notes

- Leave any figure blank if you don't have it. The dashboard shows "—" and skips it in comparisons.
- September 2026 was entered from the report with only the figures that report contained. Impressions, CTR, average position, health score, devices and AI referrals for September are blank.
- The September ranking snapshot is the 1 October check, which is what the October report compared against.
- The entry page keeps a working copy in your browser until you download. If it ever shows an old working copy, use "Discard it and use the server file".
- To rename the site shown in the header, change `site.name` in `data/months.json`.
