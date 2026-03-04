# calpolyplace

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

Deploying to GCP:

```bash
gcloud run deploy calpolyplace --source . --region=us-west1 --allow-unauthenticated
```
