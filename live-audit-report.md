# Megsy AI — Practical Live Audit

**Date:** 2026-09-17 02:39–02:45 (+03:00)  
**Environment:** Published site at `https://megsyai.com`  
**Account:** Test account supplied by the owner  
**Payment policy:** No payment was submitted and no card data was entered.

## Executive summary

The supplied test account logged in successfully, and ordinary chat, Website/Coder mode, Slides mode, Research mode, pricing, settings, usage, and referrals were reachable. Two long-running AI operations did not reach a terminal result during repeated observation: image generation remained at **“Creating your image”**, and Deep Research remained at **“Thinking…”**. The pricing-to-checkout experience also contains a material offer mismatch: the pricing page presents a `$7 / month` offer while the Dodo checkout displayed **EGP 380.03 / month**, a **3 day paid trial**, and an initial **EGP 54.29** charge.

## Confirmed findings

| ID       | Severity | Area                         | Evidence                                                                                                                                                                                                                                | Reproduction                                                                          | Impact                                                                                                                                            | Recommended fix                                                                                                                                                                                                    |
| -------- | -------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LIVE-001 | High     | Image generation             | After submitting `A simple red apple on a white table, studio lighting`, the UI showed `Creating your image` and still showed `Stop generation` after multiple page views over roughly 20 seconds. No image or error was shown.         | Sign in → Chat → Images → submit prompt → wait and refresh/view state.                | User cannot tell whether the request is progressing, failed, or consuming credits; a paid/limited operation can appear stuck indefinitely.        | Add a server/client deadline and explicit failed/stale state. Persist job status and show `Retry`/`Cancel`; reconcile stale running jobs on reload and avoid leaving the composer in a running state indefinitely. |
| LIVE-002 | High     | Deep Research                | After submitting `What are the three most important AI trends in 2025? Cite reliable sources.`, the UI remained at `Thinking…` on repeated checks and exposed only `Stop generation`; no progress, sources, timeout, or error appeared. | Sign in → Chat → Research → submit query → wait and observe.                          | Long-running research appears frozen and gives no confidence that sources are being collected; users may retry and create duplicate work/charges. | Expose stages/progress, set a visible maximum runtime, persist/resume job state, and transition to a retryable error when the worker stops reporting progress.                                                     |
| LIVE-003 | High     | Pricing / checkout           | Pricing page showed `Megsy Pro — $7 / month` and `First month · $20 / month`. The Dodo page showed `EGP 380.03 / Month`, `Total (after trial) EGP 380.03`, `3 day paid trial`, and `EGP 54.29`.                                         | Sign in → Pricing → Get started → inspect checkout; do not click Pay now.             | Direct revenue/trust risk: the amount, currency, and trial terms are not aligned between marketing and payment confirmation.                      | Use one server-side catalog response to render the exact amount, currency, billing interval, and trial copy on pricing; add an automated assertion that displayed offer metadata equals checkout metadata.         |
| LIVE-004 | Medium   | Website/Coder output quality | Website mode returned CSS containing `background: url('[images.unsplash.com](https://images.unsplash.com/...)')`, which is Markdown-link syntax embedded inside CSS and is not a valid image URL.                                       | Chat → Website → ask for a static landing page with an image → inspect generated CSS. | Generated website may render without its hero image; users must manually repair generated code.                                                   | Sanitize/normalize Markdown links before inserting URLs into code blocks, or instruct the code-generation postprocessor to emit raw URLs in CSS.                                                                   |
| LIVE-005 | Medium   | Usage/account presentation   | The test account’s Usage page displayed `1,000,000,000` available credits and `30` daily credits.                                                                                                                                       | Sign in → Usage.                                                                      | If this is not intentionally isolated test data, it can mislead users and invalidate billing/limit QA.                                            | Confirm test-account fixtures are clearly labeled and ensure production accounts receive catalog-backed balances.                                                                                                  |

## Successful checks

- Login with the supplied test account succeeded.
- Chat prompt produced a coherent Arabic response.
- Model picker opened and listed Lite, standard, and Max variants.
- Website/Coder mode accepted a prompt and returned HTML/CSS code.
- Slides mode accepted a prompt and entered `Writing slides` state with a progress item.
- Research mode accepted a prompt and entered `Thinking…` state, but did not complete during observation.
- Pricing opened Dodo checkout without submitting payment.
- Settings, Usage, and Referrals loaded while authenticated.
- No real payment was executed.

## Notes and limits

The browser session did not provide a controllable mobile viewport in this run, so mobile-specific visual assertions were not treated as confirmed findings. The source repository’s TypeScript and production build checks were successful in the earlier audit; the live findings above require job/backend and billing-catalog validation rather than a simple TypeScript fix.

## Post-deployment follow-up

After the first production deployment, the live pricing page displayed **$5/month** while its FAQ still said **$7 first month**. The FAQ copy was changed to refer to the current introductory price dynamically rather than hard-coding the obsolete amount. The trial CTA was also changed to depend on account/catalog eligibility rather than the asynchronous visitor-region result; a trial request is explicitly routed to the local Kashier gateway.

## Final verification

The final production page displayed **Try 3 days for $1** for the eligible test account. Clicking the trial CTA created a local Kashier checkout and opened it without submitting payment. The generated checkout contained `amount=49`, `currency=EGP`, `trial_days=3` in the order metadata path, and the local Kashier gateway URL. No card details were entered and no payment was completed.
