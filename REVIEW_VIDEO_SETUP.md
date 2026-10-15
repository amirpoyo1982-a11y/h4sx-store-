# Video feedback and clipboard images

Clipboard image paste works immediately on Store, Review, and the 10-minute customer editor. Click **Paste gambar clipboard**, or focus the paste box and press Ctrl+V. Camera/gallery controls remain available. Clipboard permission failures give a Ctrl+V alternative.

Video upload is intentionally disabled until `REVIEW_VIDEO_BUCKET` is configured. It accepts MP4/WebM up to 20MB. A selected video is kept in browser memory; refresh requires selecting it again. Video upload starts when submitting/saving a valid review. Image and video may be attached together. No automatic video playback.

## Enable Firebase Storage yourself

1. Open project **h4sx-6712c → Storage**, upgrade/confirm Blaze billing if required, and create the bucket in the desired region. Billing is not enabled by this code. Firebase documentation: https://firebase.google.com/docs/storage/web/start
2. For a new bucket dedicated to review uploads, publish **review-video-storage.rules** in Firebase Console Storage Rules (deny all direct client reads/writes). Do not use test-mode public rules. If reusing a bucket with other features, preserve those rules and explicitly protect both video prefixes instead. Keep the bucket private: enable **public access prevention** and uniform bucket-level access. Do not grant `allUsers` access. Signed POST/GET requests are issued only by this backend.
3. Grant the existing Vercel Firebase service account **Storage Object Admin** on this bucket only. Continue using the existing `FIREBASE_SERVICE_ACCOUNT_JSON`; do not put credentials into frontend code or chat.
4. Set bucket CORS using `review-video-cors.json` from authenticated Google Cloud Shell (replace the bucket name):

   ```sh
   gcloud storage buckets update gs://YOUR_BUCKET_NAME --cors-file=review-video-cors.json
   ```

   The signed POST policy restricts the exact object path, MIME type, byte size and a two-minute upload window. No public-read ACL is used. Reference: https://googleapis.dev/nodejs/storage/latest/File.html#generateSignedPostPolicyV4
5. In Vercel **H4SX Store → Settings → Environment Variables → Production**, add `REVIEW_VIDEO_BUCKET` with the actual bucket name, e.g. `h4sx-6712c.firebasestorage.app` (use the name shown in Console, not an assumed name). Redeploy. `GET /api/review-video?action=status` should return `configured:true`.
6. Keep the existing authenticated cron auto-approval job enabled. It also cleans abandoned/replaced/deleted video uploads after 24 hours, at most 20 records per run. It preserves videos still referenced by pending, rejected, trashed, or published reviews. Add a bucket lifecycle rule **only** for prefix `review-video-staging/`, delete objects after one day. Do not add an age-deletion rule for `review-videos/`, or replace existing unrelated lifecycle rules.

## Rules and privacy

Firebase Storage rules for these private folders can deny all client access; Admin SDK signed policies bypass client rules intentionally:

```
match /review-video-staging/{file} { allow read, write: if false; }
match /review-videos/{file} { allow read, write: if false; }
```

Firestore collections `review_video_uploads` and `review_video_limits` must have **no client read/write access**. The current catch-all deny rules already protect these unmatched collections. Do not add broad public read rules. Never replace your full rules with only these snippets.

Pending videos are visible only through an authenticated admin request. Public playback checks the review status before issuing a five-minute signed URL. Hide/reject/trash/delete stops new playback URLs immediately; an already-issued URL may remain usable for up to five minutes. Staging uploads cannot overwrite the verified copy used by a review.

## Check after setup

- Invalid/reused code outside the original 10-minute edit session must fail before upload.
- Submit a test video with a valid test code. It should be private in the waiting queue; use **Video** in moderation to preview before approval.
- Approve it and click **Lihat video** in Review or the Store popup.
- Hide the test review and confirm a fresh unauthenticated playback request is denied.
- Image paste, image gallery and camera should still work without a video.
- MP4 is a container: codecs must also be supported by the visitor browser. No server-side transcoding is performed.

Actual cloud upload/playback cannot be verified until the bucket, IAM and CORS are configured. Local automated tests use isolated mock Storage and Firestore, without changing customer data.
