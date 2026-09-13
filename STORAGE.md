# Where StudyForge keeps your files

Supabase free storage is only 1 GB, so PDFs do **not** all live there.

| Content | Where it goes | Who can read it |
| --- | --- | --- |
| Your PDF notes + camera scans | **Your own Google Drive**, folder `StudyForge` (created on first upload) | only you |
| Same, if Drive is not connected | Private Supabase bucket `textbooks`, path `<your-user-id>/...` | only you |
| Shared textbooks | Public Supabase bucket `library`, path `books/...` | everyone (read-only) |
| Metadata (titles, sizes, page counts) | Postgres tables `documents` and `library_books` | RLS: own rows / public read |

## Why Google Drive for personal files

Google sign-in requests the `drive.file` scope, which only grants access to files
this app creates. Each user therefore spends **their own** 15 GB Drive quota and
your Supabase quota stays free. The OAuth access token is kept in
`localStorage` under `sf.gtoken` for 55 minutes; after that the app falls back to
Supabase until the next sign-in refreshes it.

If you prefer unlimited cheap storage later, swap `savePersonal()` in
`features.js` for Cloudflare R2 (10 GB free, S3 API) - only that one function
needs changing.

## Library uploads (admin only)

`public.admins` lists who may publish shared textbooks. Add someone with:

```sql
insert into public.admins (user_id) values ('<their-auth-uid>');
```

RLS policies on `library_books` and the `library` bucket call `public.is_admin()`,
so the browser cannot bypass them.

## Google Cloud checklist

1. OAuth consent screen -> Data access -> add scope
   `https://www.googleapis.com/auth/drive.file`.
2. Enable the **Google Drive API** for the project.
3. Sign out and sign in again once - Google only returns the Drive token after
   you approve the new scope.
