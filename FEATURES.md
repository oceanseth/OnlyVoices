# OnlyVoices — Feature Roadmap & Monetization Analysis

Prioritized by revenue potential, implementation complexity, and user retention impact.

---

## Tier 1: High Revenue, Ship First

### 1. Audio Previews & Samples
**Revenue: Direct conversion driver**
- Let creators upload 10-30 second voice samples that play inline on their profile and marketplace cards
- Buyers hear before they buy — this is the single biggest conversion lever
- Store samples in S3/Firebase Storage, serve via CloudFront
- **Effort:** 2-3 days | **Impact:** 5/5

### 2. Real-Time Reading Generation (Checkout Flow)
**Revenue: Core transaction engine**
- Complete the checkout → ElevenLabs render → delivery pipeline
- Buyer selects voice + uploads text → pays via Stripe → audio generated → download link emailed/stored in library
- Webhook-driven: Stripe payment.succeeded → SQS → renderWorker → notify user
- **Effort:** 4-5 days | **Impact:** 5/5

### 3. Subscription Tiers for Creators
**Revenue: Recurring MRR**
- Free tier: 1 voice clone, 5 readings/month
- Pro ($9.99/mo): Unlimited voices, priority queue, analytics dashboard
- Business ($29.99/mo): API access, bulk generation, white-label options
- Use Stripe Subscriptions with metered billing for overages
- **Effort:** 5-7 days | **Impact:** 5/5

### 4. Custom Message Requests (Cameo-Style)
**Revenue: $5-$200 per message, high margin**
- Fans request personalized messages ("Happy Birthday from [creator]")
- Creator sets their price, approves/rejects requests
- Turnaround time SLA, late = auto-refund
- This is the viral use case — gift a voice message for birthdays, holidays, etc.
- **Effort:** 4-5 days | **Impact:** 5/5

---

## Tier 2: Growth & Retention

### 5. Creator Analytics Dashboard
**Revenue: Retention + upsell to Pro**
- Plays, earnings, conversion rate, top content, geographic breakdown
- Chart.js or Recharts for visualization
- Weekly email digest with stats
- **Effort:** 3-4 days | **Impact:** 4/5

### 6. Audio Player with Waveform Visualization
**Revenue: Better UX → higher conversion**
- Custom audio player with waveform display (wavesurfer.js)
- Playback speed control, skip forward/back
- Replaces basic HTML5 audio — makes the product feel premium
- **Effort:** 2-3 days | **Impact:** 4/5

### 7. Referral Program
**Revenue: Viral acquisition channel**
- Creators share referral links — earn 10% of referred creator's first 3 months
- Buyers get $5 credit for inviting friends
- Track with unique referral codes stored in Firestore
- **Effort:** 3-4 days | **Impact:** 4/5

### 8. Voice Collections / Bundles
**Revenue: Higher AOV**
- Creators bundle multiple readings at a discount (e.g., "Full audiobook" = 10 chapters)
- Platform promotes bundles on explore page
- Bundle pricing: 15-25% discount vs. individual
- **Effort:** 3-4 days | **Impact:** 4/5

---

## Tier 3: Differentiation & Moat

### 9. Live Voice Preview (Try Before You Buy)
**Revenue: Reduces purchase friction**
- Type up to 100 characters, hear the AI voice read it instantly
- Rate-limited (3 previews per voice per day for non-buyers)
- Uses ElevenLabs streaming TTS API for low latency
- **Effort:** 2-3 days | **Impact:** 4/5

### 10. Multi-Language Support
**Revenue: 5x addressable market**
- ElevenLabs supports 29 languages — expose language selection
- Translate marketplace UI (i18next)
- Language-specific creator categories
- **Effort:** 5-7 days | **Impact:** 4/5

### 11. EPUB/PDF Smart Parsing
**Revenue: Better content experience**
- Parse EPUB chapter structure, extract clean text
- PDF OCR fallback for scanned documents
- Chapter-by-chapter generation with progress tracking
- Support for large books (100k+ words) with queue-based processing
- **Effort:** 4-5 days | **Impact:** 3/5

### 12. Social Features (Follow, Like, Comment)
**Revenue: Retention + engagement**
- Follow creators, get notified of new voices/listings
- Like and rate readings (public reviews)
- Activity feed on dashboard
- **Effort:** 4-5 days | **Impact:** 3/5

---

## Tier 4: Platform Scale

### 13. Creator Verification & Badges
**Revenue: Trust = more transactions**
- Verified badge for identity-confirmed creators
- "Top Creator" badge based on earnings/ratings
- Prevents voice fraud — important for trust & safety
- **Effort:** 2-3 days | **Impact:** 3/5

### 14. API for Developers
**Revenue: B2B SaaS income stream**
- REST API for programmatic voice generation
- API keys, usage metering, rate limits
- Documentation site (Docusaurus or similar)
- Pricing: Pay-per-character or monthly API plans
- **Effort:** 7-10 days | **Impact:** 3/5

### 15. Mobile App (React Native)
**Revenue: Push notifications + always-on access**
- Share most business logic with web app
- Push notifications for new messages, completed readings
- Mobile recording for voice training
- **Effort:** 15-20 days | **Impact:** 3/5

### 16. Podcast Integration
**Revenue: Niche category expansion**
- Generate podcast episodes from text scripts
- RSS feed output for distribution to Spotify/Apple
- Intro/outro with creator's voice, ad insertion points
- **Effort:** 5-7 days | **Impact:** 2/5

### 17. Affiliate / Creator Marketplace Ads
**Revenue: Ad revenue stream**
- Creators pay to promote their profile/listings (featured placement)
- Cost-per-click or flat daily rate
- Non-intrusive — "Sponsored" badge on boosted listings
- **Effort:** 5-7 days | **Impact:** 2/5

---

## Revenue Model Summary

| Revenue Stream | Type | Est. Monthly (at 1k users) |
|---|---|---|
| Transaction fees (20% platform cut) | Per-transaction | $2,000 - $8,000 |
| Creator subscriptions (Pro/Business) | Recurring MRR | $1,500 - $5,000 |
| Custom messages (Cameo-style) | Per-transaction | $1,000 - $4,000 |
| Promoted listings / ads | Ad revenue | $500 - $2,000 |
| API access (B2B) | Usage-based | $500 - $3,000 |
| **Total potential** | | **$5,500 - $22,000/mo** |

---

## Recommended Build Order

**Phase 1 (Week 1-2):** Audio Previews → Checkout Flow → Custom Messages
*Get the core transaction loop working end-to-end.*

**Phase 2 (Week 3-4):** Subscription Tiers → Creator Analytics → Audio Player
*Add recurring revenue and make the product feel polished.*

**Phase 3 (Month 2):** Live Preview → Referral Program → Voice Bundles
*Growth levers and higher average order value.*

**Phase 4 (Month 3+):** Multi-language → API → Social → Mobile
*Scale the platform and expand the market.*

---

## What's Already Built

- [x] Firebase Auth (Google, GitHub, Email)
- [x] Voice cloning via ElevenLabs (upload, record, YouTube)
- [x] Creator marketplace with profiles and listings
- [x] Content library (text paste, file upload)
- [x] Stripe Connect (creator onboarding, platform fee)
- [x] Earnings dashboard
- [x] Settings (API keys, creator toggle, pricing)
- [x] 89 passing tests across 11 test suites
- [x] OnlyFans-inspired dark theme
- [x] Responsive layout with navigation
