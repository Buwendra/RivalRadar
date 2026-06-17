# RivalScan Intelligence Report — Doc990

> **Demonstration artifact.** This document reproduces the complete data model RivalScan would hold for a real workspace, generated using the application's actual deep-research prompt structure and output schema (`deepResearch()`, `derivedState`, enrichment, predicted moves, recommendations, Share of Voice, Brand Health, comparative briefing). All **findings and citations are real**, gathered via live web research in June 2026. The **derived/AI-scored fields** (momentum %, threat level, predicted moves, recommendations, win-against tactics, Brand Health Score, Share of Voice counts) are analyst-emulated outputs in the exact app schema — they illustrate what the live Claude pipeline would produce, not actual model output from a production run.
>
> **Data as of:** 13 June 2026 · **Plan tier modelled:** Command · **Industry:** Healthcare

> **industryContext config-fit note:** Doc990's industry is set to **Healthcare**, whose `industryContext` bucket ships as **"Clinical & Regulatory"** with US-FDA-centric guidance (FDA 510(k), Medicare/Medicaid, JAMA/NEJM). Doc990 is a consumer health-tech *marketplace*, not a drug/device maker, so this report populates the bucket with the **locally-relevant analog** — Sri Lanka's PDPA, Ministry of Health telemedicine guidelines, the National Digital Health Blueprint, and hospital-network coverage. In production this is exactly the kind of mismatch that would prompt a future industry config (e.g. a "Digital Health / Health-Tech" variant).

---

## Workspace configuration

| Setting | Value |
|---|---|
| Workspace owner | Doc990 / Digital Health (Pvt) Ltd (self-brand) |
| Plan tier | **Command** ($199/mo) |
| Industry | Healthcare |
| `industryContext` bucket label | **"Clinical & Regulatory"** (localized — see note above) |
| Self-brand monitoring (Brand Pulse) | Enabled (1 self row) |
| Competitors tracked | 4 of 25 ceiling |
| History retention | 365 days |
| Default research cadence | Every 14 days |

### Capability matrix (Command tier — `CAPABILITIES`)

| Feature | Enabled |
|---|---|
| PDF exports | ✅ |
| CSV exports | ✅ |
| Slack integration | ✅ |
| Webhook integration | ✅ |
| Predicted moves | ✅ |
| Recommendations (max visible) | Unlimited |
| Custom recommendation categories | ✅ |
| Scheduled reports | ✅ |
| Comparator matrix | ✅ |
| Brand Pulse (self-brand) | ✅ |
| Audio briefing (ElevenLabs TTS) | ✅ |
| API access | ✅ |
| Workspace seats | 25 |
| Saved views | 25 |
| API keys | 25 |

### Plan limits reference (`PLAN_LIMITS`)

| Tier | Price | Max competitors | History | Research/day | Monthly cost cap | Cadence default |
|---|---|---|---|---|---|---|
| Scout | $49/mo | 3 | 30 days | 10 | $5 | 7 days |
| Strategist | $99/mo | 10 | 90 days | 30 | $20 | 7 days |
| **Command** | **$199/mo** | **25** | **365 days** | **100** | **$80** | **14 days** |

### Competitor roster (sidebar order: threat ↓ → momentum ↓ → name ↑)

| Entity | Type | Threat | Momentum | Note |
|---|---|---|---|---|
| **Doc990** | self | — | rising | Market leader, ~40%+ channeling share |
| oDoc | competitor | high | rising | Telemedicine specialist, VC-backed, regional |
| eChannelling PLC | competitor | high | slowing | Listed incumbent (ECL.N0000), SLT-Mobitel |
| MyDoctor.lk | competitor | medium | insufficient-data | Smaller channeling app |
| Healthnet | competitor | low | stable | Adjacent — e-pharmacy / medicine delivery |

---

# 1 · Brand Pulse — Doc990 (self-brand)

> `targetKind: 'self'` — framed as media intelligence ("how is the market perceiving Doc990?"). Threat scoring and predicted moves are intentionally omitted for the self row, exactly as the production pipeline does.

**Research finding** · `RESEARCH#2026-06-13T07:02:00Z` · `tokensUsed: 13,910`

### Summary

Doc990, operated by Digital Health (Pvt) Ltd, is Sri Lanka's category-leading digital-health platform — a cross-sector JV between Dialog Axiata and the Asiri, Nawaloka, Durdans, Ceylon and Lanka Hospitals groups that has captured 40%+ of the doctor-channeling market with 158k+ customers, 5,000+ doctors and 140+ hospitals since launching in 2016. Recent coverage is expansion-led: the October 2024 launch of "Sri Lanka's first comprehensive Wellness Marketplace," an AI-powered diagnostics push, an Alexa voice integration, and a July 2025 Nawaloka Care Labs partnership that deepens diagnostics-to-channeling flow. The strategic narrative is a move from single-purpose channeling toward a full-stack health super-app — backed by Dialog's telco distribution.

### Findings by category

#### 📰 news
- **Nawaloka Care Labs partnership (Jul 2025)** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Doc990 partnered with Nawaloka Care Labs so patients visiting for tests can seamlessly schedule doctor appointments across its hospital network — tightening the diagnostics-to-channeling funnel. [island.lk](https://island.lk/doc990-partners-with-nawaloka-care-labs-to-expand-access-to-doctor-channeling-services/) · [dialog.lk](https://www.dialog.lk/news/doc990-partners-with-nawaloka-car-labs-to-expand-access-to-doctor-channeling-services)
- **Dialog Axiata FY2024 core revenue +10%** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  Parent Dialog Axiata posted ~10% core revenue growth in FY2024, underpinning continued investment capacity in digital-health verticals like Doc990. [dialog.lk](https://www.dialog.lk/news/dialog-delivers-strong-fy-2024-performance)

#### 🚀 product
- **"Sri Lanka's first comprehensive Wellness Marketplace" (Oct 2024)** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Doc990 launched a marketplace for medical packages — health check-ups, home care, cosmetic treatments and weight-loss programs from leading hospitals — extending well beyond appointment booking. [Daily News](https://www.dailynews.lk/2024/10/15/business/653040/doc990-by-dialog-sets-new-standard-with-sri-lankas-first-comprehensive-wellness-marketplace/)
- **AI-powered diagnostics + Alexa voice channeling** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  The platform added an AI-powered diagnostics solution and an Amazon Alexa integration for voice-driven digital-health services — signalling a tech-forward, multi-modal roadmap. [dialog.lk](https://www.dialog.lk/news/doc990-alexa-launch)
- **Full-stack service suite** · importance **2** · sentiment **positive** · timeSensitivity **historical**
  Beyond channeling: Tele Doctor, Medicine to Your Doorstep, Healthcare to Your Doorstep, My Health Records and Lab Reports — a breadth no pure-channeling rival matches. [doc.lk/about](https://www.doc.lk/about)

#### 💰 funding
- **Cross-sector JV with deep hospital + telco backing** · importance **3** · sentiment **positive** · timeSensitivity **historical**
  Backed by Dialog Axiata (Digital Holdings Lanka) plus Asiri, Nawaloka, Durdans, Ceylon and Lanka Hospitals, and investors incl. BOV Capital — the first cross-sector healthcare JV of its kind in Sri Lanka, giving privileged hospital-network access. [bouncewatch.com](https://www.bouncewatch.com/explore/startup/doc990-l-digital-health-private-limited) · [durdans.com](https://www.durdans.com/digitising-healthcare-durdans-hospital-partners-in-doc-990-joint-venture-with-dialog/)

#### 🧑‍💼 hiring
- **Dialog Axiata operating umbrella** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Operated as a Dialog Axiata subsidiary, Doc990 draws on telco-scale product, engineering and distribution talent rather than a standalone startup bench. [linkedin.com](https://lk.linkedin.com/company/digital-health-private-limited)

#### 💬 social
- **Recognised digital-inclusion case study** · importance **2** · sentiment **positive** · timeSensitivity **historical**
  Profiled by the GSMA Mobile for Development programme as a model for enhancing patient access via mobile — strong institutional/reputational standing. [gsma.com](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/uncategorized/doc990-enhancing-patient-access-to-healthcare-services-in-sri-lanka-through-mobile/)

#### 📊 industryContext — *"Clinical & Regulatory"* (localized)
- **PDPA obligations operationalize Sep 2025** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  Sri Lanka's GDPR-inspired Personal Data Protection Act (No. 9 of 2022) sees key obligations take effect September 2025 — a direct compliance burden for a platform holding health records, lab data and channeling histories. [Wikipedia: PDPA](https://en.wikipedia.org/wiki/Personal_Data_Protection_Act_(Sri_Lanka)) · [dpa.gov.lk](https://dpa.gov.lk/Background.php)
- **MoH Telemedicine Guidelines v1.0 (2024) + Digital Health Blueprint** · importance **2** · sentiment **neutral** · timeSensitivity **recent**
  The Ministry of Health's 2024 telemedicine guidelines and the MoH/ICTA National Digital Health Blueprint set the standards Doc990's Tele Doctor service must align to — regulatory tailwind for compliant incumbents. [health.gov.lk](https://www.health.gov.lk/wp-content/uploads/2023/11/Telemedicine-Guidelines-Final-9.05.2024-for-MoH-Web-site.pdf) · [digitalsrilanka.lk](https://digitalsrilanka.lk/digital-healthcare/)

### Derived state (`derivedState`)

| Field | Value |
|---|---|
| `stage` | **growth** |
| `fundingState` | **bootstrapped** *(corporate-JV funded; no external VC round)* |
| `hiringState` | **steady** |
| `strategicDirection` | **diversifying** |
| `techPositioning` | **ai-adjacent** |
| `pacing` | **shipping-fast** |
| `evidenceNotes` | Category leader scaling from channeling into a full health super-app (Wellness Marketplace, AI diagnostics, Alexa, lab partnerships). Funded via a corporate hospital+telco JV rather than VC. Rapid, multi-product shipping cadence; AI-adjacent rather than AI-native. |

### Self-brand tags (`derivedTags`)

`coverage-rising` · `launch-landing` · `growth-story` · `growth-stage`

### Momentum

- **`momentum`: rising** · `momentumChangePercent`: **+38%** · `momentumAsOf`: 2026-06-13
  Trailing-30-day coverage is up sharply on the Wellness Marketplace rollout, AI diagnostics, and the Nawaloka Care Labs tie-up.

### 🏥 Brand Health Score (`computeBrandHealthScore`)

> **79 / 100** · confidence **medium**

| Component | Score | Detail |
|---|---|---|
| Sentiment | **82** | 7 positive vs 1 negative mention across categories in the last 4 weeks — strongly favourable (launches, partnerships, recognition); the lone negative is regulatory (PDPA burden). |
| Voice | **74** | Self-brand dominates workspace mentions as category leader, though oDoc and eChannelling generate meaningful counter-volume. |
| Momentum | **80** | Rule-based momentum is `rising`. |

Composite = round((82 + 74 + 80) / 3) = **79**. Confidence **medium**: 8 qualifying mentions over the 4-week window (≥5 and <20).

---

# 2 · Competitor — oDoc

**Threat: `high`** · **Momentum: `rising` (+22%)** · Private (VC-backed)

**Research finding** · `RESEARCH#2026-06-13T07:10:00Z` · `tokensUsed: 11,540`

### Summary

oDoc is the credible tech-forward challenger — a telemedicine-first app (vs Doc990's channeling-first roots) with a regional footprint across Sri Lanka, India, the Maldives and Cambodia. It has 1,000+ partner doctors covering ~200,000 lives and 65+ corporate clients, and was Techstars-backed (raising $1M pre-Series A in 2021 from Hustle Fund and Unpopular Ventures). Its B2B2C insurance/corporate distribution and teleconsultation depth make it the sharpest competitor in exactly the growth segment (Tele Doctor) Doc990 is expanding into.

### Findings by category

#### 📰 news
- **Regional, corporate-led telemedicine footprint** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  oDoc covers ~200,000 lives across 65+ corporates in Sri Lanka, India, the Maldives and Cambodia — a B2B2C model that locks in employer/insurer demand Doc990 competes for. [ha-asia.com](https://www.ha-asia.com/sri-lanka-riding-the-telemedicine-wave/) · [crunchbase.com](https://www.crunchbase.com/organization/odoc)

#### 🚀 product
- **Teleconsultation-native experience** · importance **3** · sentiment **negative** · timeSensitivity **historical**
  Remote video consults, anonymous consults, doctor-profile comparison, symptom search and health-record storage — a purpose-built telemedicine UX vs Doc990's channeling-first heritage. [odoc.life](https://www.odoc.life/)

#### 💰 funding
- **VC-backed (Techstars, Hustle Fund, Unpopular Ventures)** · importance **3** · sentiment **negative** · timeSensitivity **historical**
  Raised $1M pre-Series A in Feb 2021 at double its prior valuation; Silicon Valley investor base gives it growth capital and a regional-expansion mandate unusual for a Sri Lankan health-tech. [Daily FT](https://www.ft.lk/front-page/Healthtech-startup-oDoc-raises-1-m-in-pre-series-A-funding/44-713746) · [adaderana](http://bizenglish.adaderana.lk/healthtech-startup-odoc-raises-1m-in-pre-series-a-funding/)

#### 🧑‍💼 hiring
- **Startup talent + Silicon Valley network** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Techstars alumni network and VC backing support product/engineering hiring oriented to rapid iteration. [crunchbase.com](https://www.crunchbase.com/organization/odoc)

#### 💬 social
- **Strong startup-ecosystem visibility** · importance **2** · sentiment **negative** · timeSensitivity **historical**
  Frequent positive coverage across regional startup/funding media positions oDoc as the innovation story in Sri Lankan health-tech. [yourstory.com](https://yourstory.com/companies/odoc)

#### 📊 industryContext — *"Clinical & Regulatory"* (localized)
- **Best-positioned for the telemedicine-guidelines era** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  As MoH telemedicine guidelines formalize remote care, a telemedicine-native player with insurance integration is structurally advantaged in the fastest-growing post-COVID segment. [ha-asia.com](https://www.ha-asia.com/sri-lanka-riding-the-telemedicine-wave/)

### Derived state

| Field | Value |
|---|---|
| `stage` | **growth** |
| `fundingState` | **recently-raised** |
| `hiringState` | **steady** |
| `strategicDirection` | **expanding-geo** |
| `techPositioning` | **ai-adjacent** |
| `pacing` | **shipping-fast** |
| `evidenceNotes` | VC-backed telemedicine-native challenger expanding regionally (LK/IN/MV/KH) via B2B2C insurance/corporate channels. Tech-forward, fast-moving, and concentrated in the high-growth teleconsultation segment that overlaps Doc990's Tele Doctor. |

### Tags (`derivedTags`)

`expanding-geo` · `growth-stage` · `shipping-fast`

### Threat assessment

- **`threatLevel`: high** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** A telemedicine-native, VC-funded competitor with regional reach and entrenched corporate/insurance distribution — directly contesting Doc990's fastest-growing vertical (Tele Doctor). Less of a channeling threat, but the strongest challenger in the strategic direction Doc990 is betting on.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| New funding round to fund regional expansion | 0.45 | 90d | funding | Last raise was 2021; a multi-country footprint and growth mandate make a follow-on round plausible. |
| Deeper insurer/corporate-wellness bundling | 0.65 | 60d | strategic | 65+ corporates already onboard; expanding employer health benefits is its clearest growth lever. |
| AI-triage / symptom-checker feature expansion | 0.55 | 90d | product | Telemedicine-native UX + investor pressure favour AI-led consult-deflection features. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `rising` (+22%) · Recent activity: 3 changes / 30 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `growth` · Funding `recently-raised` · Hiring `steady` · Direction `expanding-geo` · Tech `ai-adjacent` · Pacing `shipping-fast`
- **Win-against tactics (`suggestWinAgainstTactics`):**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Leverage exclusive hospital-network channeling oDoc can't match | high | easy | Doc990's JV with Asiri/Nawaloka/Durdans/Ceylon/Lanka gives in-person + diagnostics depth a pure telemedicine app lacks. |
| Bundle Tele Doctor with Medicine-to-Doorstep + lab reports | high | moderate | Doc990 can out-feature oDoc on the full care journey (consult → prescription → delivery → records) in one app. |
| Win the corporate/insurer segment with Dialog's enterprise reach | medium | moderate | Dialog's B2B salesforce can contest oDoc's 65+ corporate accounts with telco-grade enterprise relationships. |

- **Citations:** [Daily FT](https://www.ft.lk/front-page/Healthtech-startup-oDoc-raises-1-m-in-pre-series-A-funding/44-713746) · [odoc.life](https://www.odoc.life/)

---

# 3 · Competitor — eChannelling PLC

**Threat: `high`** · **Momentum: `slowing` (−6%)** · CSE: ECL.N0000

**Research finding** · `RESEARCH#2026-06-13T07:18:00Z` · `tokensUsed: 11,020`

### Summary

eChannelling PLC is the listed incumbent and Doc990's most direct head-to-head channeling rival — an SLT-Mobitel subsidiary that bills itself as "the largest Channelling Network in Sri Lanka," connecting patients to 150+ health institutes via audio/video channeling, queue management and a mobile app. But its FY2024 revenue fell 5.6% to LKR 255.9m, and notably Doc990 and eChannelling are partly *integrated* (cross-booking where one isn't the primary system) — a coopetition dynamic. Its telco parentage (SLT-Mobitel) mirrors Doc990's Dialog backing, making this the clearest two-horse race in core channeling.

### Findings by category

#### 📰 news
- **FY2024 revenue down 5.6% to LKR 255.9m** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  Revenue declined to LKR 255.9m from LKR 271.2m — a contraction that contrasts with Doc990's expansion momentum. [stockanalysis.com](https://stockanalysis.com/quote/cose/ECL.N0000/) · [LankaBIZ](https://lankabizz.net/2024/04/18/echanneling-plc-financial-performance-and-future-outlook/)
- **"Exponential expansion" into digital lifestyle services** · importance **2** · sentiment **neutral** · timeSensitivity **recent**
  eChannelling signalled a push to broaden beyond channeling into wider digital-lifestyle services — a strategic pivot to arrest the revenue decline. [island.lk](https://island.lk/echannelling-to-uplift-sri-lankas-digital-lifestyle-services-with-exponential-expansion/)

#### 🚀 product
- **Audio/video channeling + queue management** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  Core products span medical channeling, an online queue-management solution and driver's-license medical appointment booking across 150+ institutes. [emis.com](https://www.emis.com/php/company-profile/LK/E-Channelling_Plc_en_2314121.html)
- **Doc990 ↔ eChannelling cross-integration** · importance **3** · sentiment **neutral** · timeSensitivity **historical**
  The two platforms are integrated so patients can reach hospitals where the other is the primary system — coopetition that blunts pure head-to-head displacement. [gsma.com](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/uncategorized/doc990-enhancing-patient-access-to-healthcare-services-in-sri-lanka-through-mobile/)

#### 💰 funding
- **Listed, SLT-Mobitel-backed** · importance **3** · sentiment **neutral** · timeSensitivity **historical**
  As a CSE-listed (ECL.N0000) SLT-Mobitel subsidiary, it has public-market funding access and telco parentage symmetrical to Doc990's Dialog backing. [pitchbook.com](https://pitchbook.com/profiles/company/161019-55)

#### 🧑‍💼 hiring
- **SLT-Mobitel operating umbrella** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Draws on SLT-Mobitel's group resources, mirroring Doc990's Dialog structure. [emis.com](https://www.emis.com/php/company-profile/LK/E-Channelling_Plc_en_2314121.html)

#### 💬 social
- **Established brand, mature app footprint** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Long-standing iOS/Android presence and broad institute coverage give it durable brand recognition despite the revenue dip. [App Store](https://apps.apple.com/lk/app/echannelling/id1087304077)

#### 📊 industryContext — *"Clinical & Regulatory"* (localized)
- **Same PDPA / telemedicine-guideline exposure** · importance **2** · sentiment **neutral** · timeSensitivity **recent**
  Faces identical PDPA (Sep 2025) and MoH telemedicine compliance obligations as Doc990 — neither side gains a regulatory edge, but scale of data holdings raises the stakes. [Wikipedia: PDPA](https://en.wikipedia.org/wiki/Personal_Data_Protection_Act_(Sri_Lanka))

### Derived state

| Field | Value |
|---|---|
| `stage` | **public** |
| `fundingState` | **public** |
| `hiringState` | **steady** |
| `strategicDirection` | **diversifying** |
| `techPositioning` | **legacy** |
| `pacing` | **steady** |
| `evidenceNotes` | Listed (ECL.N0000) SLT-Mobitel channeling incumbent with declining revenue, pivoting toward broader digital-lifestyle services to offset core erosion. Direct channeling rival but partly integrated with Doc990; mature/legacy tech posture. |

### Tags (`derivedTags`)

`public-co` · `diversifying` · `legacy`

### Threat assessment

- **`threatLevel`: high** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** The only true head-to-head channeling competitor at national scale, with symmetric telco (SLT-Mobitel) backing and public-market funding. Threat is tempered by declining revenue and cross-platform integration (coopetition), but its incumbency and "largest network" claim directly contest Doc990's leadership.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| Launch of broadened "digital lifestyle" services beyond channeling | 0.60 | 90d | product | Publicly signalled expansion to arrest the revenue decline. |
| Price/commission competition to defend channeling volume | 0.50 | 60d | pricing | A shrinking top line pressures it to compete on hospital/doctor commercials. |
| Deeper SLT-Mobitel bundling (data/airtime + channeling) | 0.45 | 90d | strategic | Telco parent integration is its most defensible distribution lever vs Dialog-backed Doc990. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `slowing` (−6%) · Recent activity: 3 changes / 30 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `public` · Funding `public` · Hiring `steady` · Direction `diversifying` · Tech `legacy` · Pacing `steady`
- **Win-against tactics:**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Out-innovate on the super-app roadmap (Wellness Marketplace, AI, lab tie-ins) | high | moderate | Doc990's product velocity outpaces a legacy incumbent whose revenue is declining. |
| Convert shared-integration traffic into Doc990-primary bookings | high | hard | The cross-integration is a channel to migrate users onto Doc990's richer ecosystem over time. |
| Press the growth-vs-decline narrative with hospital partners | medium | easy | Doc990's expansion + 40%+ share is a stronger pitch to hospitals weighing primary-platform commitments. |

- **Citations:** [stockanalysis.com](https://stockanalysis.com/quote/cose/ECL.N0000/) · [LankaBIZ](https://lankabizz.net/2024/04/18/echanneling-plc-financial-performance-and-future-outlook/)

---

# 4 · Competitor — MyDoctor.lk

**Threat: `medium`** · **Momentum: `insufficient-data`** · Private

**Research finding** · `RESEARCH#2026-06-13T07:25:00Z` · `tokensUsed: 8,980`

### Summary

MyDoctor.lk is a smaller digital-healthcare player that positions on affordability and continuity of care — it claims a Sri Lankan first with a dedicated mobile app *for doctors*, plus patient access to past medical histories with their treating professionals. Public financial and traction signal is thin, so RivalScan flags momentum as `insufficient-data` rather than inferring a trend. It overlaps Doc990 on core channeling but lacks the hospital-JV depth, telco distribution and multi-service breadth of the leaders.

### Findings by category

#### 📰 news
- **First "mobile app for doctors" claim** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  MyDoctor.lk launched what it bills as Sri Lanka's first mobile app aimed at doctors, emphasising professional-side workflow rather than only patient booking. [Daily Mirror](https://www.dailymirror.lk/healthcare/MyDoctor-lk-launches-mobile-app-for-doctors-for-first-time-in-Sri-Lanka/304-131193)

#### 🚀 product
- **Affordability + medical-history continuity** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  Positions on affordable, convenient access plus easy retrieval of past medical histories across treating professionals — a continuity-of-care angle. [Daily Mirror](https://www.dailymirror.lk/healthcare/MyDoctor-lk-launches-mobile-app-for-doctors-for-first-time-in-Sri-Lanka/304-131193)

#### 💰 funding
- **No disclosed institutional backing** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  No public funding rounds or corporate-JV/telco parentage surfaced — a structural disadvantage vs Doc990 and eChannelling. *(No primary source; absence-of-signal noted.)*

#### 🧑‍💼 hiring
- **Limited public signal** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  No notable leadership or hiring disclosures in the research window. *(Absence-of-signal.)*

#### 💬 social
- **Modest visibility** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Far lighter media and ecosystem footprint than Doc990, eChannelling or oDoc. [Daily Mirror](https://www.dailymirror.lk/healthcare/MyDoctor-lk-launches-mobile-app-for-doctors-for-first-time-in-Sri-Lanka/304-131193)

#### 📊 industryContext — *"Clinical & Regulatory"* (localized)
- **PDPA cost-of-compliance hits smaller players hardest** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  The September 2025 PDPA obligations impose fixed compliance costs that are proportionally heavier for a sub-scale operator without telco/hospital-group legal resources. [Wikipedia: PDPA](https://en.wikipedia.org/wiki/Personal_Data_Protection_Act_(Sri_Lanka))

### Derived state

| Field | Value |
|---|---|
| `stage` | **early** |
| `fundingState` | **unknown** |
| `hiringState` | **unknown** |
| `strategicDirection` | **specializing** |
| `techPositioning` | **mixed** |
| `pacing` | **slow** |
| `evidenceNotes` | Smaller channeling/continuity-of-care app with an affordability and doctor-side workflow angle, but thin public signal on funding, traction and team — several labels remain `unknown` by design. Lacks the hospital-JV and telco distribution of the leaders. |

### Tags (`derivedTags`)

`early-stage` · `specializing`

### Threat assessment

- **`threatLevel`: medium** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** Overlaps Doc990 on core channeling with a differentiated affordability/continuity angle, but is sub-scale, thinly resourced and lacks hospital-JV or telco distribution. A watch-item that could carve a value niche, not a near-term displacement threat.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| *(Low confidence — limited signal)* Niche positioning on affordability / doctor-side tools | 0.40 | 90d | product | Its stated differentiation suggests it leans further into underserved doctor-workflow and low-cost segments. |
| Seek a partnership or funding to reach scale | 0.30 | 90d | funding | Sub-scale players typically need external capital or a hospital/insurer partner to compete with JV-backed leaders. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `insufficient-data` · Recent activity: <3 changes / 14 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `early` · Funding `unknown` · Hiring `unknown` · Direction `specializing` · Tech `mixed` · Pacing `slow`
- **Win-against tactics:**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Compete on ecosystem breadth and hospital coverage | high | easy | Doc990's 140+ hospitals and full service suite dwarf a single-app challenger. |
| Match affordability messaging where it threatens price-sensitive users | medium | easy | Neutralize MyDoctor's value angle with Doc990 promotions on Dialog's distribution. |
| Win doctors with superior practice tools | medium | moderate | Counter MyDoctor's doctor-app pitch by deepening Doc990's provider-side workflow features. |

- **Citations:** [Daily Mirror](https://www.dailymirror.lk/healthcare/MyDoctor-lk-launches-mobile-app-for-doctors-for-first-time-in-Sri-Lanka/304-131193)

---

# 5 · Competitor — Healthnet

**Threat: `low`** · **Momentum: `stable` (+4%)** · Private (adjacent — e-pharmacy)

**Research finding** · `RESEARCH#2026-06-13T07:31:00Z` · `tokensUsed: 8,420`

### Summary

Healthnet is an *adjacent* rather than head-to-head competitor — Sri Lanka's first full-service e-pharmacy, focused on medication delivery for patients managing high-risk non-communicable diseases (NCDs), with an app offering scheduled refill reminders. It does not do doctor channeling, but it overlaps one Doc990 vertical: "Medicine to Your Doorstep." It's tracked as a low-threat watch on the pharmacy-delivery flank rather than a core-market rival.

### Findings by category

#### 📰 news
- **Sri Lanka's first full-service e-pharmacy** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  Healthnet positions as the country's first full-service online pharmacy and medication-delivery service. [LMD](https://lmd.lk/healthnet/) · [healthnetstore.lk](https://www.healthnetstore.lk/)

#### 🚀 product
- **NCD-focused medication delivery + refill reminders** · importance **3** · sentiment **negative** · timeSensitivity **historical**
  Targets chronic-disease patients with monthly medication ordering and scheduled reminders — directly overlapping Doc990's "Medicine to Your Doorstep." [healthnetstore.lk](https://www.healthnetstore.lk/)

#### 💰 funding
- **Independent e-pharmacy** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  No major disclosed institutional funding; operates as a specialised independent. [crunchbase.com](https://www.crunchbase.com/organization/healthnet-ebd2)

#### 🧑‍💼 hiring
- **Limited public signal** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  No notable leadership/hiring disclosures in the window. *(Absence-of-signal.)*

#### 💬 social
- **Niche chronic-care reputation** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Recognised within the NCD/chronic-medication niche but without broad consumer-health visibility. [LMD](https://lmd.lk/healthnet/)

#### 📊 industryContext — *"Clinical & Regulatory"* (localized)
- **Pharmacy-delivery regulatory regime differs** · importance **2** · sentiment **neutral** · timeSensitivity **recent**
  Faces pharmacy/medicines-regulatory oversight (NMRA) plus PDPA, a partly different compliance surface from channeling/telemedicine platforms — limiting direct competitive overlap. [Wikipedia: PDPA](https://en.wikipedia.org/wiki/Personal_Data_Protection_Act_(Sri_Lanka))

### Derived state

| Field | Value |
|---|---|
| `stage` | **growth** |
| `fundingState` | **bootstrapped** |
| `hiringState` | **unknown** |
| `strategicDirection` | **specializing** |
| `techPositioning` | **mixed** |
| `pacing` | **steady** |
| `evidenceNotes` | Specialised, bootstrapped e-pharmacy focused on NCD medication delivery — adjacent to Doc990 only on the pharmacy-fulfilment vertical, with a different (NMRA) regulatory surface. Steady niche operator, not a channeling competitor. |

### Tags (`derivedTags`)

`specializing` · `growth-stage`

### Threat assessment

- **`threatLevel`: low** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** Adjacent specialist competing only on Doc990's medicine-delivery vertical, not its core channeling/telemedicine market. Niche NCD focus and absence of doctor-booking keep it a low-priority, single-flank watch rather than a strategic threat.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| Deepen NCD chronic-care subscription model | 0.55 | 90d | product | Refill-reminder + monthly-delivery mechanics point to recurring-revenue subscription expansion. |
| *(Low confidence)* Partner with a channeling platform for prescription flow | 0.30 | 90d | strategic | A pharmacy without booking may seek upstream channeling/teleconsult partners — potentially a Doc990 rival or ally. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `stable` (+4%) · Recent activity: <3 changes / 30 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `growth` · Funding `bootstrapped` · Hiring `unknown` · Direction `specializing` · Tech `mixed` · Pacing `steady`
- **Win-against tactics:**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Bundle medicine delivery into the full care journey | high | easy | Doc990 can attach delivery to consult+prescription in one flow; a standalone pharmacy can't offer the upstream booking. |
| Use hospital-network prescriptions as a fulfilment funnel | high | moderate | Doc990's channeling volume feeds prescriptions Healthnet has to acquire separately. |
| Match NCD refill-reminder UX | medium | easy | Replicate the chronic-care reminder features to neutralize Healthnet's main differentiator. |

- **Citations:** [healthnetstore.lk](https://www.healthnetstore.lk/) · [LMD](https://lmd.lk/healthnet/)

---

# 6 · Comparative analytics (Phase 24)

## 6.1 Share of Voice (`computeShareOfVoice`)

**Window:** 30 days (2026-05-14 → 2026-06-13) · **Total changes:** 41

### Overall

| Rank | Entity | Self | Changes | Share |
|---|---|---|---|---|
| 1 | Doc990 | ✅ | 14 | 34.1% |
| 2 | oDoc | | 9 | 22.0% |
| 3 | eChannelling PLC | | 8 | 19.5% |
| 4 | MyDoctor.lk | | 6 | 14.6% |
| 5 | Healthnet | | 4 | 9.8% |

### By category (`byCategory`)

| Entity | news | product | funding | hiring | social | industryContext |
|---|---|---|---|---|---|---|
| Doc990 (self) | 3 | 4 | 2 | 1 | 2 | 2 |
| oDoc | 2 | 2 | 2 | 1 | 1 | 1 |
| eChannelling | 2 | 2 | 1 | 1 | 1 | 1 |
| MyDoctor.lk | 1 | 2 | 1 | 0 | 1 | 1 |
| Healthnet | 1 | 1 | 0 | 0 | 1 | 1 |

**Read:** Doc990 leads share of voice decisively (34%) on its product-led expansion narrative — it dominates the `product` category, the right place for a category leader to lead. oDoc out-voices the listed incumbent eChannelling, confirming the competitive center of gravity is shifting from channeling toward telemedicine/innovation, exactly the vertical Doc990 must defend.

## 6.2 Strategic recommendations (`generateRecommendations`)

> Command tier — unlimited visible. Confidence is honestly calibrated 0–1.

**1. Defend the telemedicine vertical before oDoc owns it**
`category: product` · `effortLevel: high` · `timeHorizon: this-quarter` · `confidence: 0.80`
oDoc is telemedicine-native with entrenched corporate/insurance distribution in the fastest-growing segment. Accelerate Tele Doctor's UX, AI-triage and insurer integrations so Doc990's growth flank isn't ceded to a focused challenger. *(Triggered by: oDoc product + corporate-footprint signals.)*

**2. Convert the eChannelling cross-integration into a migration funnel**
`category: positioning` · `effortLevel: medium` · `timeHorizon: this-quarter` · `confidence: 0.70`
With eChannelling's revenue declining and the two platforms integrated, use the shared traffic plus Doc990's richer super-app to migrate users to Doc990-primary bookings. *(Triggered by: eChannelling revenue decline + integration signal.)*

**3. Get ahead of PDPA before the September 2025 deadline**
`category: messaging` · `effortLevel: medium` · `timeHorizon: this-month` · `confidence: 0.78`
PDPA obligations operationalize Sept 2025 and Doc990 holds the largest pool of health data in the set. Turn compliance into a trust differentiator — publicise data-protection posture as a competitive moat smaller rivals can't afford. *(Triggered by: industryContext PDPA signal.)*

**4. Monetise the Wellness Marketplace breadth as a defensive moat**
`category: product` · `effortLevel: medium` · `timeHorizon: this-quarter` · `confidence: 0.74`
No competitor matches the channel→consult→prescription→delivery→records→wellness span. Bundle and cross-sell across it to raise switching costs and lift revenue per user. *(Triggered by: self product breadth.)*

**5. Lock in hospital exclusivity while leading**
`category: sales` · `effortLevel: medium` · `timeHorizon: this-quarter` · `confidence: 0.66`
Doc990's JV gives privileged access to Asiri/Nawaloka/Durdans/Ceylon/Lanka; deepen primary-platform agreements so eChannelling and new entrants can't pry hospital networks loose. *(Triggered by: competitive incumbency dynamics.)*

**6. Counter oDoc's corporate-wellness wedge with Dialog enterprise sales**
`category: sales` · `effortLevel: high` · `timeHorizon: this-quarter` · `confidence: 0.61`
oDoc's 65+ corporate accounts are a B2B2C beachhead. Mobilise Dialog's enterprise salesforce to win employer health-benefit contracts before they consolidate. *(Triggered by: oDoc corporate footprint.)*

## 6.3 Comparative weekly briefing (`generateComparativeBriefing`)

**Briefing**

> Doc990 enters the period from a position of clear strength: category leadership at 40%+ channeling share, decisive share of voice (34%), and a product narrative — the Wellness Marketplace, AI diagnostics, Alexa, and the Nawaloka Care Labs tie-up — that frames it as Sri Lanka's emerging health super-app rather than a booking utility. Its cross-sector JV and Dialog distribution remain structural advantages no rival fully replicates.
>
> The competitive pressure is not where the brand was built. The listed incumbent eChannelling is contracting (revenue −5.6%) and partly integrated with Doc990, making it a managed rather than acute threat. The sharper challenge is oDoc — a VC-backed, telemedicine-native, regionally-expanding player that already out-voices eChannelling and owns exactly the teleconsultation/insurance vertical Doc990 is growing into. The strategic question is whether Doc990's breadth can out-defend a focused specialist's depth.
>
> Two near-term imperatives stand out. First, PDPA's September 2025 obligations turn data stewardship into both a cost and a trust opportunity — and Doc990, holding the most health data, has the most to gain by leading on it. Second, the corporate/insurer channel is the contested beachhead; Dialog's enterprise reach is the asset to deploy before oDoc consolidates employer contracts.

**Suggested narrative angles**

1. *"From channeling app to health super-app"* — Doc990's product breadth (Wellness Marketplace, AI, lab tie-ins) as a reinvention the single-purpose rivals can't tell.
2. *"Trust is the new moat"* — positioning PDPA compliance leadership as a competitive differentiator in a data-sensitive category.
3. *"The leader is also the innovator"* — pairing 40%+ market share with the fastest product cadence to counter the startup-innovation narrative around oDoc.

---

# 7 · Weekly competitive digest (`generateWeeklySummary`)

> Email-style strategic briefing — top changes by significance, past 7 days.

**Subject: Your competitive week — the battle moves from channeling to telemedicine**

Three developments matter this week. First, **oDoc** continued to consolidate the telemedicine/insurance vertical with its regional, corporate-led footprint (~200k lives, 65+ corporates) — the most strategically significant competitive signal, because it targets exactly the Tele Doctor growth area you're expanding into (significance **8/10**). Second, **eChannelling's** FY2024 revenue decline (−5.6% to LKR 255.9m) confirms the listed incumbent is contracting even as it signals a "digital lifestyle" pivot — an opening to migrate shared-integration users onto your platform (significance **7/10**). Third, the regulatory clock is the macro story: **PDPA obligations operationalize in September 2025**, and as the holder of the most health data in the market, you carry both the heaviest compliance load and the biggest opportunity to turn data-protection into a trust moat (significance **7/10**).

Your own week was strong — the Wellness Marketplace, AI diagnostics and the Nawaloka Care Labs partnership gave you a commanding 34% share of voice and clear product leadership. The structural watch-item is that the competitive center of gravity is shifting from channeling (where you lead) toward telemedicine (where oDoc is focused). The recommended focus: accelerate Tele Doctor, weaponise your full-stack breadth, deploy Dialog's enterprise salesforce against the corporate-wellness flank, and get visibly ahead of PDPA.

🔊 *Audio briefing available (Command tier — ElevenLabs narration of this digest).*

---

## Appendix · Schema coverage checklist

This document exercises every RivalScan output surface:

- ✅ `ResearchFinding` — summary, 6 categories (`news`/`product`/`funding`/`hiring`/`social`/`industryContext`), per-finding `importance` (1–3), `sentiment` (positive/neutral/negative), `timeSensitivity` (breaking/recent/historical), citations, `tokensUsed`
- ✅ `derivedState` — `stage` / `fundingState` / `hiringState` / `strategicDirection` / `techPositioning` / `pacing` / `evidenceNotes` (all enum values verbatim; note `early`/`growth`/`public` stages and `recently-raised`/`bootstrapped`/`public`/`unknown` funding states all exercised across the set)
- ✅ Enrichment — `momentum` (rising/slowing/stable/insufficient-data + `momentumChangePercent`), `threatLevel` (high/medium/low) + `threatReasoning`, `derivedTags` (competitor + self-brand slug sets)
- ✅ `predictedMoves` — `move` / `reasoning` / `probability` / `timeHorizon` (30d/60d/90d) / `category` *(omitted for self row, per pipeline)*
- ✅ Battlecard — at-a-glance, strategic snapshot grid, win-against tactics (`impact`/`difficulty`), citations
- ✅ Comparative analytics — Share of Voice (`overall` + `byCategory`), Strategic recommendations (`category`/`effortLevel`/`timeHorizon`/`confidence`), Comparative briefing (prose + angles)
- ✅ Brand Health Score — composite + sentiment/voice/momentum components + confidence bucket
- ✅ Weekly digest — `generateWeeklySummary` prose + audio-briefing flag

---

> **AI-generated analysis. May contain errors. For internal evaluation only — not legal or financial advice.**
> Findings sourced from public web research (June 2026). Derived scores, predictions, recommendations and Share-of-Voice counts are illustrative of the RivalScan AI pipeline's output format and were generated for this demonstration, not produced by a live production research run. The `industryContext` ("Clinical & Regulatory") bucket was localized to Sri Lanka's regulatory context rather than the shipped config's US-FDA framing. — *RivalScan*
