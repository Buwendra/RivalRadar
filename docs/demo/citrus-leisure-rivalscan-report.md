# RivalScan Intelligence Report — Citrus Leisure PLC

> **Demonstration artifact.** This document reproduces the complete data model RivalScan would hold for a real workspace, generated using the application's actual deep-research prompt structure and output schema (`deepResearch()`, `derivedState`, enrichment, predicted moves, recommendations, Share of Voice, Brand Health, comparative briefing). All **findings and citations are real**, gathered via live web research in June 2026. The **derived/AI-scored fields** (momentum %, threat level, predicted moves, recommendations, win-against tactics, Brand Health Score, Share of Voice counts) are analyst-emulated outputs in the exact app schema — they illustrate what the live Claude pipeline would produce, not actual model output from a production run.
>
> **Data as of:** 13 June 2026 · **Plan tier modelled:** Command · **Industry:** Travel / Hospitality

---

## Workspace configuration

| Setting | Value |
|---|---|
| Workspace owner | Citrus Leisure PLC (self-brand) |
| Plan tier | **Command** ($199/mo) |
| Industry | Travel / Hospitality |
| `industryContext` bucket label | **"Booking Trends & Occupancy"** |
| Self-brand monitoring (Brand Pulse) | Enabled (1 self row) |
| Competitors tracked | 5 of 25 ceiling |
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

| Entity | Type | Threat | Momentum | CSE ticker |
|---|---|---|---|---|
| **Citrus Leisure PLC** | self | — | rising | REEF.N0000 |
| Eden Hotel Lanka PLC | competitor | high | rising | EDEN.N0000 |
| Serendib Hotels PLC | competitor | high | rising | SHOT.N0000 |
| The Lighthouse Hotel PLC | competitor | medium | rising | LHL.N0000 |
| Browns Beach Hotels PLC | competitor | medium | stable | BBH.N0000 |
| Tangerine Beach Hotels PLC | competitor | medium | insufficient-data | TANG.N0000 |

---

# 1 · Brand Pulse — Citrus Leisure PLC (self-brand)

> `targetKind: 'self'` — framed as media intelligence ("how is the market perceiving Citrus Leisure?"). Threat scoring and predicted moves are intentionally omitted for the self row, exactly as the production pipeline does.

**Research finding** · `RESEARCH#2026-06-13T06:12:00Z` · `tokensUsed: 14,820`

### Summary

Citrus Leisure PLC has turned a corner: FY2024/25 delivered group revenue of ~LKR 2.28bn (+4.4%) and a return to operating profitability after years of losses, riding Sri Lanka's record 2.36m tourist arrivals in 2025. Coverage in the period is dominated by two narratives — the December 2023 launch and 2025 maturation of Blue Orbit, South Asia's tallest revolving restaurant at Colombo Lotus Tower, and 2025 TripAdvisor Travellers' Choice wins for both Citrus Hikkaduwa and Citrus Waskaduwa. A capital-recycling signal (the 10% Hikkaduwa Beach Resort stake sale) and a refurbishment programme across Waskaduwa and Hikkaduwa round out a brand visibly repositioning around F&B experiences and asset upgrades.

### Findings by category

#### 📰 news
- **FY2024/25 turnaround to operating profitability** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Group revenue rose ~4.4% to LKR 2.28bn with gross profit up 8% to Rs 1,488.2m; the company reported a clear return to operating profit for the year ended 31 March 2025. [ft.lk / annual report](https://www.citrusleisure.com/wp-content/uploads/2025/09/Citrus-Leisure-PLC-FY-2024-25.pdf)
- **2025 TripAdvisor Travellers' Choice for both beach resorts** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  Citrus Hikkaduwa and Citrus Waskaduwa were both honoured in the 2025 TripAdvisor Travellers' Choice Awards. [traveltalkasia.com](https://www.traveltalkasia.com/2025/05/20/citrus-hikkaduwa-and-citrus-waskaduwa-honoured-in-2025-tripadvisor-travelers-choice-awards/)

#### 🚀 product
- **Blue Orbit & Cosmic at Lotus Tower scale up** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Citrus is the exclusive operator of Blue Orbit — South Asia's tallest and Sri Lanka's first revolving restaurant — plus the Cosmic banquet hall at Colombo Lotus Tower, a marquee F&B asset that broadens the brand beyond beach rooms. [island.lk](https://island.lk/citrus-leisure-in-collaboration-with-colombo-lotus-tower-takes-dining-and-banqueting-to-new-heights/) · [ft.lk](https://www.ft.lk/food__beverage/Blue-Orbit-and-Cosmic-add-ethereal-dimension-to-Colombo-s-dining-and-banqueting-offering/39-756279)
- **Portfolio-wide refurbishment programme (FY2025/26)** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  The company plans to complete ongoing refurbishments at Waskaduwa and Hikkaduwa and assess upgrades at The Steuart, raising the standard of physical infrastructure across the portfolio. [Citrus FY24/25 report](https://www.citrusleisure.com/wp-content/uploads/2025/09/Citrus-Leisure-PLC-FY-2024-25.pdf)

#### 💰 funding
- **10% stake sale in Hikkaduwa Beach Resort** · importance **3** · sentiment **neutral** · timeSensitivity **historical**
  Citrus sold 62.5m shares (>10%) of subsidiary Hikkaduwa Beach Resort at Rs 3.50–3.70; REEF traded around Rs 4.30 at the time — a capital-recycling / liquidity signal. [Daily Mirror](https://www.dailymirror.lk/print/business-news/Citrus-Leisure-sells-62-5mn-shares-in-Hikkaduwa-Beach-Resort/273-319062) · [EconomyNext](https://economynext.com/sri-lankas-citrus-leisure-sells-10-pct-stake-in-hikkaduwa-beach-resort-239980/)
- **Concentrated ownership under George Steuart** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  George Steuart & Co holds 75.16%, with Divasa Equity (9.85%) and Vallibel One (3.13%) — a tightly-held register that constrains free float. [Wikipedia](https://en.wikipedia.org/wiki/Citrus_Leisure)

#### 🧑‍💼 hiring
- **Stable board, advertising-rooted leadership** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Leadership includes E.P.A. Cooray (Chairman), P.C.B. Talwatte (CEO), and directors Dilith Jayaweera and Varuni Fernando (Triad Advertising), reflecting a marketing-led ownership culture. [marketscreener.com](https://www.marketscreener.com/quote/stock/CITRUS-LEISURE-PLC-20703675/company/)

#### 💬 social
- **Vibrant, value-positioned beach brand reputation** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  Citrus Hikkaduwa and Waskaduwa are widely described as vibrant, well-reviewed coastal destinations for both local and international travellers, reinforced by the Travellers' Choice wins. [citrusleisure.com](https://citrusleisure.com/) · [traveltalkasia.com](https://www.traveltalkasia.com/2025/05/20/citrus-hikkaduwa-and-citrus-waskaduwa-honoured-in-2025-tripadvisor-travelers-choice-awards/)

#### 📊 industryContext — *"Booking Trends & Occupancy"*
- **Record national arrivals tailwind** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Sri Lanka logged an all-time-high 2,362,521 arrivals in 2025 (+15.1%), generating >USD 3.2bn; 2026 is tracking even higher (Q1 >740k) with a government target of 3m — a demand backdrop directly lifting west/south-coast occupancy. [Daily FT](https://www.ft.lk/top-story/Tourism-arrivals-grow-by-15-to-2-36-m-record-high-in-2025/26-786582)
- **Average spend-per-tourist softening** · importance **2** · sentiment **negative** · timeSensitivity **recent**
  Even as volumes hit records, average tourist spending is declining — a margin/ADR risk for mid-market beach operators competing on price. [bangladeshmonitor.com.bd](https://www.bangladeshmonitor.com.bd/lead-news-details/sri-lanka-logs-all-time-high-236-million-annual-tourist-arrivals-in-2025-average-tourist-spending-decreases)

### Derived state (`derivedState`)

| Field | Value |
|---|---|
| `stage` | **public** |
| `fundingState` | **public** |
| `hiringState` | **steady** |
| `strategicDirection` | **diversifying** |
| `techPositioning` | **legacy** |
| `pacing` | **steady** |
| `evidenceNotes` | Listed entity (REEF.N0000) returning to operating profit on record national arrivals; diversifying from beach rooms into landmark F&B (Blue Orbit/Cosmic) and recycling capital via the Hikkaduwa stake sale. No technology-led differentiation evident; pace of change is steady rather than rapid. |

### Self-brand tags (`derivedTags`)

`coverage-rising` · `narrative-funding-buzz` · `launch-landing` · `public-co`

### Momentum

- **`momentum`: rising** · `momentumChangePercent`: **+31%** · `momentumAsOf`: 2026-06-13
  Coverage volume over the trailing 30 days is up materially versus the prior window, driven by the Blue Orbit maturation, Travellers' Choice wins, and FY24/25 results cycle.

### 🏥 Brand Health Score (`computeBrandHealthScore`)

> **74 / 100** · confidence **medium**

| Component | Score | Detail |
|---|---|---|
| Sentiment | **78** | 6 positive vs 1 negative mention across categories in the last 4 weeks — favourable coverage skew (awards, turnaround, F&B). |
| Voice | **62** | Self-brand accounts for a healthy share of workspace mentions, but premium peers (Serendib, Eden) generate comparable volume. |
| Momentum | **80** | Rule-based momentum is `rising`. |

Composite = round((78 + 62 + 80) / 3) = **73** → reported **74** after self-brand sentiment weighting. Confidence **medium**: 7 qualifying mentions over the 4-week window (≥5 and <20).

---

# 2 · Competitor — Eden Hotel Lanka PLC

**Threat: `high`** · **Momentum: `rising` (+41%)** · CSE: EDEN.N0000

**Research finding** · `RESEARCH#2026-06-13T06:18:00Z` · `tokensUsed: 13,440`

### Summary

Eden Hotel Lanka PLC is the most aggressive grower in the set: FY2024 group revenue surged ~29.7% to LKR 9.04bn (a figure that consolidates Browns' Maldives resorts alongside the flagship Occidental Eden Beruwala), with losses narrowing 67% and the March 2025 quarter swinging to +140% profit growth. The Rs 1.5bn full renovation of the 158-room Occidental Eden Beruwala — now managed by Barceló Hotel Group under the international Occidental brand — places a premium, internationally-flagged beach product directly on Citrus's west-coast doorstep.

### Findings by category

#### 📰 news
- **March 2025 quarter swings to strong profit growth** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Consolidated net profit growth of +140.57% in the quarter ended March 2025, with full-year losses narrowing 67% YoY. [stockanalysis.com](https://stockanalysis.com/quote/cose/EDEN.N0000/) · [MarketScreener](https://www.marketscreener.com/quote/stock/EDEN-HOTEL-LANKA-PLC-20700157/)

#### 🚀 product
- **Occidental Eden Beruwala — Rs 1.5bn international-brand relaunch** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Reopened May 2023 after a total revamp of all 158 rooms, common spaces and amenities; managed by Barceló under the Occidental brand, lifting it to global standards on the Beruwala beach strip. [brownsinvestments.com](https://www.brownsinvestments.com/news-and-events/occidental-eden-beruwala-elevates-sri-lankas-coastal-resort-scene-on-par-with-global-standards/)

#### 💰 funding
- **Revenue near LKR 9bn on Maldives consolidation** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  FY2024 revenue of ~LKR 9.04bn (+29.7%) reflects the broader Browns leisure platform (Browns Ari, Raa and Kaafu resorts in the Maldives) plus Beruwala. [stockanalysis.com](https://stockanalysis.com/quote/cose/EDEN.N0000/)

#### 🧑‍💼 hiring
- **Backed by Browns / LOLC conglomerate** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  Owned by Browns Investments (Brown & Company PLC, within LOLC Holdings) — deep balance-sheet and management bandwidth relative to independent peers. [emis.com](https://www.emis.com/php/company-profile/LK/Eden_Hotel_Lanka_Plc_en_2313972.html)

#### 💬 social
- **International "Occidental" brand recognition** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  Listed across global OTAs (Hotels.com et al.) under the Occidental flag, giving it international-traveller discoverability Citrus's owned brand lacks. [hotels.com](https://ca.hotels.com/ho3768133312)

#### 📊 industryContext — *"Booking Trends & Occupancy"*
- **Premium international flag on the west coast** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  A Barceló-managed 5-star at Beruwala captures higher-ADR international demand in the same micro-market as Citrus Waskaduwa, pressuring rate and mix as national spend-per-tourist softens. [brownsinvestments.com](https://www.brownsinvestments.com/news-and-events/occidental-eden-beruwala-elevates-sri-lankas-coastal-resort-scene-on-par-with-global-standards/)

### Derived state

| Field | Value |
|---|---|
| `stage` | **public** |
| `fundingState` | **public** |
| `hiringState` | **steady** |
| `strategicDirection` | **going-upmarket** |
| `techPositioning` | **mixed** |
| `pacing` | **shipping-fast** |
| `evidenceNotes` | Conglomerate-backed operator moving upmarket via an international Barceló/Occidental flag and a Rs 1.5bn renovation, with fast revenue growth and a profit turnaround. Scale and capital access exceed independent peers. |

### Tags (`derivedTags`)

`going-upmarket` · `public-co` · `shipping-fast` · `late-stage`

### Threat assessment

- **`threatLevel`: high** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** Direct geographic overlap with Citrus Waskaduwa on the Beruwala–Kalutara west-coast strip, now armed with an internationally-managed (Barceló/Occidental) premium product, conglomerate (LOLC/Browns) capital, and the fastest revenue growth in the set. Competes for the higher-ADR international guest Citrus is trying to win.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| Push Occidental Eden into all-inclusive / packaged European tour-operator contracts | 0.65 | 60d | strategic | Barceló's distribution and the renovated room base favour AI packaging to fill the larger property during shoulder season. |
| Further Maldives capacity additions under the Browns leisure platform | 0.45 | 90d | geo | Revenue mix already leans on Maldives resorts; conglomerate appetite for high-ADR island inventory is evident. |
| Targeted ADR increases at Beruwala as occupancy firms | 0.55 | 30d | pricing | Record arrivals + renovated premium product support rate pushes ahead of peak season. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `rising` (+41%) · Recent activity: 4 changes / 30 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `public` · Funding `public` · Hiring `steady` · Direction `going-upmarket` · Tech `mixed` · Pacing `shipping-fast`
- **Win-against tactics (`suggestWinAgainstTactics`):**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Win on authentic local character vs a globally-standardised flag | high | moderate | Occidental's international template can feel generic; Citrus can lean into Sri Lankan F&B identity (incl. Blue Orbit) and local warmth. |
| Target direct-booking value bundles to undercut OTA-heavy distribution | high | moderate | International-brand inventory leans on OTA/tour-operator channels; Citrus can defend margin with direct-booking perks as ADRs compress. |
| Counter-programme MICE/events using Cosmic at Lotus Tower | medium | easy | Eden has no Colombo banqueting landmark; Citrus's Lotus Tower assets are a unique corporate-events hook. |

- **Citations:** [brownsinvestments.com](https://www.brownsinvestments.com/news-and-events/occidental-eden-beruwala-elevates-sri-lankas-coastal-resort-scene-on-par-with-global-standards/) · [stockanalysis.com](https://stockanalysis.com/quote/cose/EDEN.N0000/)

---

# 3 · Competitor — Serendib Hotels PLC

**Threat: `high`** · **Momentum: `rising` (+34%)** · CSE: SHOT.N0000

**Research finding** · `RESEARCH#2026-06-13T06:24:00Z` · `tokensUsed: 12,910`

### Summary

Serendib Hotels PLC is the highest-quality earner in the comparison set: FY2024/25 revenue of LKR 3.40bn (+18.7%) with earnings up 23% to Rs 524m, net assets of Rs 7.9bn, and a clean sweep of TripAdvisor Travellers' Choice and Booking.com awards across its portfolio. Crucially, its Avani and Anantara Kalutara resorts sit in the same Kalutara micro-market as Citrus Waskaduwa, pairing internationally-recognised Minor Hotels brands with a profitable, award-winning operating record.

### Findings by category

#### 📰 news
- **FY2024/25 revenue Rs 3.4bn, earnings +23%** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Group revenue rose 18.7% to LKR 3.40bn; earnings of Rs 523.8m (+23.1%), EBIT Rs 172.7m, net assets Rs 7,886m — a financially strong, profitable peer. [annual report](https://cdn.cse.lk/cmt/upload_report_file/601_1756350557623.pdf)

#### 🚀 product
- **Avani & Anantara Kalutara — premium brands in Citrus's backyard** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  Operates Avani and Anantara (Minor Hotels) resorts in Kalutara — directly adjacent to Citrus Waskaduwa — plus Thaala Bentota, Hotel Sigiriya, Club Hotel Dolphin (Waikkal) and Lantern Beach Collection (Mirissa). [emis.com](https://www.emis.com/php/company-profile/LK/Serendib_Hotels_Plc_en_2313968.html)

#### 💰 funding
- **Strong balance sheet (net assets Rs 7.9bn)** · importance **2** · sentiment **neutral** · timeSensitivity **recent**
  Net assets of Rs 7,886m underpin reinvestment capacity well above independent mid-market peers. [annual report](https://cdn.cse.lk/cmt/upload_report_file/601_1756350557623.pdf)

#### 🧑‍💼 hiring
- **Hayleys leisure pedigree** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Part of the Hayleys leisure ecosystem, giving it group-level management depth and access to international brand partnerships (Minor Hotels). [marketscreener.com](https://www.marketscreener.com/quote/stock/SERENDIB-HOTELS-PLC-20703717/company/)

#### 💬 social
- **Portfolio-wide guest-review awards** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  Every Serendib property won TripAdvisor Travellers' Choice and Booking.com Guest Review Awards in 2024; Club Hotel Dolphin took a HolidayCheck 2025 award — best-in-set guest sentiment. [stockanalysis.com](https://stockanalysis.com/quote/cose/SHOT.N0000/)

#### 📊 industryContext — *"Booking Trends & Occupancy"*
- **Multi-brand, multi-region demand capture** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  Coverage across coast (Bentota, Kalutara, Waikkal, Mirissa) and cultural triangle (Sigiriya) lets Serendib capture demand across source markets and seasons that a two-resort operator cannot. [emis.com](https://www.emis.com/php/company-profile/LK/Serendib_Hotels_Plc_en_2313968.html)

### Derived state

| Field | Value |
|---|---|
| `stage` | **public** |
| `fundingState` | **public** |
| `hiringState` | **steady** |
| `strategicDirection` | **expanding-geo** |
| `techPositioning` | **mixed** |
| `pacing` | **steady** |
| `evidenceNotes` | Profitable, award-winning multi-property group with international brand partnerships (Minor: Avani/Anantara) and a strong balance sheet; geographically diversified across coast and cultural triangle. Steady, well-capitalised execution. |

### Tags (`derivedTags`)

`expanding-geo` · `public-co` · `late-stage`

### Threat assessment

- **`threatLevel`: high** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** Operates internationally-branded premium resorts (Avani, Anantara) in the same Kalutara micro-market as Citrus Waskaduwa, with best-in-set guest-review awards, consistent profitability, and a Rs 7.9bn balance sheet. The clearest "trade-up" alternative a Citrus guest could choose.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| Refurbishment/repositioning of a Bentota or Kalutara asset to defend premium ADR | 0.50 | 90d | product | Strong earnings + net assets support reinvestment to sustain its award-winning premium positioning. |
| Expanded direct-booking / loyalty push leveraging Minor (GHA Discovery) | 0.60 | 60d | strategic | Anantara/Avani affiliation gives access to a global loyalty programme it is likely to lean on as OTA costs rise. |
| Selective new management contract or lease in an under-served region | 0.40 | 90d | geo | Demonstrated multi-region appetite and group backing favour continued geographic expansion. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `rising` (+34%) · Recent activity: 3 changes / 30 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `public` · Funding `public` · Hiring `steady` · Direction `expanding-geo` · Tech `mixed` · Pacing `steady`
- **Win-against tactics:**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Compete on price-to-value below Anantara/Avani rate cards | high | easy | Citrus can target the value-conscious traveller priced out of Serendib's premium brands while arrivals are high but spend is soft. |
| Differentiate with unique Colombo F&B experiences (Blue Orbit/Cosmic) | medium | easy | Serendib has no Colombo dining landmark; bundle a Lotus Tower experience with a beach stay. |
| Win domestic/regional weekend demand with agile local marketing | medium | moderate | Marketing-led ownership (Triad) can out-execute on fast, locally-resonant campaigns vs a corporate group cadence. |

- **Citations:** [annual report 2024/25](https://cdn.cse.lk/cmt/upload_report_file/601_1756350557623.pdf) · [emis.com](https://www.emis.com/php/company-profile/LK/Serendib_Hotels_Plc_en_2313968.html)

---

# 4 · Competitor — The Lighthouse Hotel PLC

**Threat: `medium`** · **Momentum: `rising` (+28%)** · CSE: LHL.N0000

**Research finding** · `RESEARCH#2026-06-13T06:30:00Z` · `tokensUsed: 11,760`

### Summary

The Lighthouse Hotel PLC (Jetwing) runs a profitable, low-leverage south-coast premium operation anchored by the Bawa-designed Jetwing Lighthouse in Galle. FY2024 revenue rose ~7% to LKR 1.46bn with earnings up 33% to Rs 233m, a third-quarter revenue surge of 82% YoY, and group gearing cut to just 5% by March 2025. Notably, it deliberately resisted the all-inclusive model to protect its premium, community-focused positioning.

### Findings by category

#### 📰 news
- **3Q revenue +82% YoY; earnings +33% for the year** · importance **3** · sentiment **positive** · timeSensitivity **recent**
  Third-quarter revenue jumped to Rs 357.7m from Rs 195m; full-year earnings rose 32.6% to Rs 233.2m. [Daily Mirror](https://www.dailymirror.lk/business-news/Lighthouse-Hotel-3Q-revenue-surges-82-YoY/273-276559)
- **Gearing cut to 5%** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  Group gearing fell to 5% by 31 March 2025 with finance costs down Rs 27m on lower rates — a notably clean balance sheet. [annual report 2025/26](https://www.jetwinghotels.com/jetwinglighthouse/wp-content/uploads/sites/24/2025/06/The-Lighthouse-Hotel-PLC-Annual-Report-2025-26.pdf)

#### 🚀 product
- **Premium positioning; declined all-inclusive** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  The flagship Jetwing Lighthouse resisted pressure to convert to all-inclusive, choosing to protect rate and a community-focused, experience-led model. [MarketScreener](https://www.marketscreener.com/quote/stock/THE-LIGHTHOUSE-HOTEL-PLC-20702513/)

#### 💰 funding
- **Profitable with rising earnings** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  Revenue LKR 1.46bn (+7.2%) and net earnings Rs 233m — comfortably profitable, unlike several loss-making peers. [stockanalysis.com](https://stockanalysis.com/quote/cose/LHL.N0000/)

#### 🧑‍💼 hiring
- **Jetwing brand and management** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Operated under the respected domestic Jetwing brand (Jetwing Lighthouse, Jetwing Kurulubedda, Hotel J Unawatuna), a recognised mark of Sri Lankan hospitality quality. [Wikipedia](https://en.wikipedia.org/wiki/Jetwing_Lighthouse)

#### 💬 social
- **Architectural/heritage prestige (Bawa-designed)** · importance **2** · sentiment **positive** · timeSensitivity **historical**
  The Geoffrey Bawa-designed Galle landmark carries heritage cachet that resonates strongly with high-end international travellers and design press. [Wikipedia](https://en.wikipedia.org/wiki/Jetwing_Lighthouse)

#### 📊 industryContext — *"Booking Trends & Occupancy"*
- **Premium rate defence amid softening spend** · importance **3** · sentiment **neutral** · timeSensitivity **recent**
  By refusing all-inclusive and holding a premium line, Lighthouse is betting on ADR over volume even as national average spend declines — a different strategy from volume-led mid-market peers. [Daily Mirror](https://www.dailymirror.lk/business-news/Lighthouse-Hotel-3Q-revenue-surges-82-YoY/273-276559)

### Derived state

| Field | Value |
|---|---|
| `stage` | **public** |
| `fundingState` | **public** |
| `hiringState` | **steady** |
| `strategicDirection` | **specializing** |
| `techPositioning` | **legacy** |
| `pacing` | **steady** |
| `evidenceNotes` | Profitable, very low-geared (5%) south-coast premium operator specialising in experience-led, non-AI positioning under the Jetwing brand. Rising earnings and a heritage flagship; deliberate, focused strategy rather than expansionary. |

### Tags (`derivedTags`)

`specializing` · `public-co` · `late-stage`

### Threat assessment

- **`threatLevel`: medium** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** Premium south-coast operator near Citrus Hikkaduwa's catchment, financially healthy and brand-strong, but positioned a tier above Citrus on rate and concentrated in Galle rather than overlapping Citrus's core Kalutara/Hikkaduwa value segment. Adjacent rather than head-to-head.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| Continued premium ADR push rather than volume discounting | 0.70 | 60d | pricing | Explicit strategic choice to avoid all-inclusive signals a rate-led playbook into peak season. |
| Light refurbishment / sustainability upgrades at the Galle flagship | 0.40 | 90d | product | Low gearing creates headroom for reinvestment in the heritage asset to defend premium positioning. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `rising` (+28%) · Recent activity: 3 changes / 30 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `public` · Funding `public` · Hiring `steady` · Direction `specializing` · Tech `legacy` · Pacing `steady`
- **Win-against tactics:**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Capture price-sensitive guests Lighthouse cedes by holding premium rate | high | easy | Its no-discount stance leaves the value segment open; Citrus Hikkaduwa can target travellers priced out of Galle premium. |
| Offer flexible board options (incl. AI / packages) it refuses to | medium | easy | Lighthouse declined all-inclusive; Citrus can win tour-operator volume that needs AI pricing. |
| Lean into vibrant/social beach positioning vs quiet heritage | medium | moderate | Hikkaduwa's lively reputation appeals to a younger, social-travel segment distinct from Lighthouse's heritage clientele. |

- **Citations:** [Daily Mirror](https://www.dailymirror.lk/business-news/Lighthouse-Hotel-3Q-revenue-surges-82-YoY/273-276559) · [annual report 2025/26](https://www.jetwinghotels.com/jetwinglighthouse/wp-content/uploads/sites/24/2025/06/The-Lighthouse-Hotel-PLC-Annual-Report-2025-26.pdf)

---

# 5 · Competitor — Browns Beach Hotels PLC

**Threat: `medium`** · **Momentum: `stable` (+12%)** · CSE: BBH.N0000

**Research finding** · `RESEARCH#2026-06-13T06:36:00Z` · `tokensUsed: 11,210`

### Summary

Browns Beach Hotels PLC operates the 139-room five-star Sentido Heritance Negombo, rebranded under an international Sentido franchise in November 2023. FY2025 revenue rose ~15.3% to LKR 1.49bn and losses narrowed by two-thirds to Rs 154m, but the property remains loss-making. Its Negombo (airport-proximate) location places it in a different micro-market from Citrus's west/south-coast resorts, though it shares the same LOLC/Browns parentage as Eden.

### Findings by category

#### 📰 news
- **FY2025 revenue +15%, losses narrowing** · importance **3** · sentiment **neutral** · timeSensitivity **recent**
  Revenue rose 15.3% to LKR 1.49bn and net loss narrowed 67% to ~Rs 154m — improving but not yet profitable. [stockanalysis.com](https://stockanalysis.com/quote/cose/BBH.N0000/) · [annual report 2024/25](https://cdn.cse.lk/cmt/upload_report_file/525_1749725291926.pdf)

#### 🚀 product
- **Sentido franchise rebrand (Nov 2023)** · importance **3** · sentiment **positive** · timeSensitivity **historical**
  Heritance Negombo entered a franchise partnership with Sentido and now trades as Sentido Heritance Negombo — an ocean-facing 5-star with elevated spa and airport proximity. [emis.com](https://www.emis.com/php/company-profile/LK/Browns_Beach_Hotels_Plc_en_2314118.html)

#### 💰 funding
- **Still loss-making despite revenue growth** · importance **2** · sentiment **negative** · timeSensitivity **recent**
  Persistent net losses (Rs 154m FY2025) indicate cost/occupancy pressures despite top-line recovery. [stockanalysis.com](https://stockanalysis.com/quote/cose/BBH.N0000/)

#### 🧑‍💼 hiring
- **LOLC / Brown & Company backing** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  Part of Brown & Company PLC within LOLC Holdings — the same conglomerate as Eden Hotel Lanka, implying coordinated leisure strategy and patient capital. [Wikipedia: LOLC Holdings](https://en.wikipedia.org/wiki/LOLC_Holdings)

#### 💬 social
- **International Sentido distribution to European markets** · importance **2** · sentiment **positive** · timeSensitivity **recent**
  The Sentido (TUI-aligned) franchise opens German/European tour-operator channels for the Negombo property. [emis.com](https://www.emis.com/php/company-profile/LK/Browns_Beach_Hotels_Plc_en_2314118.html)

#### 📊 industryContext — *"Booking Trends & Occupancy"*
- **Airport-transit demand niche** · importance **2** · sentiment **neutral** · timeSensitivity **recent**
  Negombo's proximity to Bandaranaike International Airport gives it first/last-night transit demand that Citrus's resorts don't naturally capture — a different occupancy driver. [emis.com](https://www.emis.com/php/company-profile/LK/Browns_Beach_Hotels_Plc_en_2314118.html)

### Derived state

| Field | Value |
|---|---|
| `stage` | **public** |
| `fundingState` | **public** |
| `hiringState` | **steady** |
| `strategicDirection` | **going-upmarket** |
| `techPositioning` | **mixed** |
| `pacing` | **steady** |
| `evidenceNotes` | Conglomerate-backed single 5-star asset moving upmarket via an international Sentido franchise; revenue recovering and losses narrowing but not yet profitable. Different (Negombo/airport) micro-market from Citrus's core. |

### Tags (`derivedTags`)

`going-upmarket` · `public-co` · `late-stage`

### Threat assessment

- **`threatLevel`: medium** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** A conglomerate-backed 5-star with international distribution, but located in Negombo (airport transit market) rather than Citrus's west/south-coast leisure strip, and still loss-making. Shares LOLC/Browns parentage with Eden, so coordinated competitive moves are a watch-item.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| Deepen European tour-operator (TUI/Sentido) contracting | 0.60 | 60d | strategic | The franchise's core value is access to German/European volume; expect aggressive packaging to lift occupancy. |
| Continued cost restructuring to reach breakeven | 0.55 | 90d | strategic | Narrowing losses + conglomerate discipline point to a near-term profitability push. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `stable` (+12%) · Recent activity: 2 changes / 30 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `public` · Funding `public` · Hiring `steady` · Direction `going-upmarket` · Tech `mixed` · Pacing `steady`
- **Win-against tactics:**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Compete on leisure-destination appeal vs an airport-transit property | medium | easy | Citrus's beach-resort experience outclasses a transit-oriented stay for holiday travellers. |
| Diversify source markets beyond European tour operators | medium | moderate | Browns leans on TUI/Sentido channels; Citrus can court India (27% of arrivals) and regional FIT demand. |
| Hold rate discipline as a profitable independent | low | moderate | A loss-making rival may chase occupancy with discounts; Citrus can protect its newly-won operating margin. |

- **Citations:** [annual report 2024/25](https://cdn.cse.lk/cmt/upload_report_file/525_1749725291926.pdf) · [stockanalysis.com](https://stockanalysis.com/quote/cose/BBH.N0000/)

---

# 6 · Competitor — Tangerine Beach Hotels PLC

**Threat: `medium`** · **Momentum: `insufficient-data`** · CSE: TANG.N0000

**Research finding** · `RESEARCH#2026-06-13T06:42:00Z` · `tokensUsed: 9,640`

### Summary

Tangerine Beach Hotels PLC is the closest direct neighbour — its Tangerine Beach Hotel sits in Kalutara, the same strip as Citrus Waskaduwa — and it runs a three-hotel mid-market chain (Tangerine Beach, the separately-listed Royal Palms Beach Hotel, and Fairview) as an associate of Mercantile Investments and Finance PLC. Public disclosure is thinner than peers: recent EBITDA of ~Rs 203m is available, but detailed FY2024/25 profit signals are limited, so RivalScan flags momentum as `insufficient-data` rather than guessing.

### Findings by category

#### 📰 news
- **Limited recent public signal** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  FY2024/25 annual reports for both Tangerine Beach Hotels and Royal Palms Beach Hotels are filed with the CSE, but granular results coverage is sparse versus listed peers. [CSE filing](https://cdn.cse.lk/cmt/announcement_portal_prod/Registration_30077614233463969.pdf)

#### 🚀 product
- **Three-hotel Kalutara mid-market chain** · importance **2** · sentiment **neutral** · timeSensitivity **historical**
  Owns/operates Tangerine Beach Hotel (Kalutara), Royal Palms Beach Hotel (Kalutara) and Fairview Hotel — an established mid-market cluster directly adjacent to Citrus Waskaduwa. [tangerinehotels.com](https://www.tangerinehotels.com/)

#### 💰 funding
- **Mercantile Investments association; modest EBITDA** · importance **2** · sentiment **neutral** · timeSensitivity **recent**
  An associate company of Mercantile Investments and Finance PLC, with recent EBITDA around Rs 203m (margin ~12.6%). [TradingView](https://www.tradingview.com/symbols/CSELK-TANG.N0000/financials-overview/)

#### 🧑‍💼 hiring
- **Family/finance-group ownership** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  Long-established group with stable, conservative ownership tied to Mercantile Investments — limited management churn signal. [investing.com](https://www.investing.com/equities/tangerine-beach-hotels-company-profile)

#### 💬 social
- **Established Kalutara beach reputation** · importance **1** · sentiment **neutral** · timeSensitivity **historical**
  A long-running, well-known Kalutara beach property with steady OTA presence (Booking.com, Travelweekly listings). [booking.com](https://www.booking.com/hotel/lk/tangerine-beach.html)

#### 📊 industryContext — *"Booking Trends & Occupancy"*
- **Direct Kalutara micro-market overlap** · importance **3** · sentiment **negative** · timeSensitivity **recent**
  Tangerine and Royal Palms compete for the same Kalutara beach demand as Citrus Waskaduwa — the most direct head-to-head occupancy overlap in the set, even if its public signal is quiet. [tangerinehotels.com](https://www.tangerinehotels.com/) · [CSE filing](https://cdn.cse.lk/cmt/upload_report_file/581_1756295784052.pdf)

### Derived state

| Field | Value |
|---|---|
| `stage` | **public** |
| `fundingState` | **public** |
| `hiringState` | **unknown** |
| `strategicDirection` | **steady** |
| `techPositioning` | **legacy** |
| `pacing` | **slow** |
| `evidenceNotes` | Long-established mid-market Kalutara chain with conservative finance-group ownership and limited public disclosure. Direct geographic overlap with Citrus Waskaduwa, but thin recent signal — several labels remain `unknown`/`steady` by design. |

### Tags (`derivedTags`)

`public-co` · `legacy`

### Threat assessment

- **`threatLevel`: medium** · `threatAsOf`: 2026-06-13
- **`threatReasoning`:** The most geographically direct rival (Kalutara, beside Citrus Waskaduwa) with an established mid-market chain, but mature, slow-moving and thinly covered — a steady defensive watch rather than a fast-moving offensive threat. Direct demand overlap keeps it above `low`.

### Predicted moves (`predictedMoves`)

| Move | Probability | Horizon | Category | Reasoning |
|---|---|---|---|---|
| Status-quo operation riding record national arrivals | 0.65 | 90d | strategic | Conservative ownership and a `slow` pace suggest it harvests the arrivals tailwind without major strategic shifts. |
| *(Low confidence — limited signal)* Selective room refurbishment at Kalutara properties | 0.30 | 90d | product | Peak demand may prompt modest upgrades, but no public capex signal confirms this. |

### 🃏 Battlecard (Command tier)

- **At a glance:** Momentum `insufficient-data` · Recent activity: <3 changes / 14 days · Last research: 2026-06-13
- **Strategic snapshot:** Stage `public` · Funding `public` · Hiring `unknown` · Direction `steady` · Tech `legacy` · Pacing `slow`
- **Win-against tactics:**

| Tactic | Impact | Difficulty | Reasoning |
|---|---|---|---|
| Out-invest on product/experience in the shared Kalutara market | high | moderate | Citrus's active refurbishment + Blue Orbit halo can pull ahead of a slow-moving direct neighbour. |
| Win the digital/direct-booking race | medium | easy | A quiet, legacy-positioned rival likely under-invests online; Citrus's marketing-led ownership can dominate local search and social. |
| Capture group/MICE demand Tangerine can't serve | medium | easy | Citrus's Cosmic/Lotus Tower banqueting offers an events hook a pure beach chain lacks. |

- **Citations:** [CSE filing 2024/25](https://cdn.cse.lk/cmt/announcement_portal_prod/Registration_30077614233463969.pdf) · [tangerinehotels.com](https://www.tangerinehotels.com/)

---

# 7 · Comparative analytics (Phase 24)

## 7.1 Share of Voice (`computeShareOfVoice`)

**Window:** 30 days (2026-05-14 → 2026-06-13) · **Total changes:** 47

### Overall

| Rank | Entity | Self | Changes | Share |
|---|---|---|---|---|
| 1 | Citrus Leisure PLC | ✅ | 12 | 25.5% |
| 2 | Eden Hotel Lanka PLC | | 10 | 21.3% |
| 3 | Serendib Hotels PLC | | 9 | 19.1% |
| 4 | The Lighthouse Hotel PLC | | 8 | 17.0% |
| 5 | Browns Beach Hotels PLC | | 5 | 10.6% |
| 6 | Tangerine Beach Hotels PLC | | 3 | 6.4% |

### By category (`byCategory`)

| Entity | news | product | funding | hiring | social | industryContext |
|---|---|---|---|---|---|---|
| Citrus Leisure (self) | 3 | 3 | 2 | 1 | 2 | 1 |
| Eden Hotel Lanka | 2 | 2 | 3 | 1 | 1 | 1 |
| Serendib Hotels | 2 | 2 | 1 | 1 | 2 | 1 |
| The Lighthouse Hotel | 2 | 2 | 2 | 1 | 1 | 0 |
| Browns Beach Hotels | 1 | 1 | 1 | 1 | 0 | 1 |
| Tangerine Beach Hotels | 1 | 1 | 0 | 0 | 0 | 1 |

**Read:** Citrus leads share of voice this window on the Blue Orbit maturation + awards + results cycle, but the two conglomerate-backed premium operators (Eden, Serendib) together out-voice the self-brand — and dominate the `funding` category, signalling deeper-pocketed competitive capacity.

## 7.2 Strategic recommendations (`generateRecommendations`)

> Command tier — unlimited visible. Confidence is honestly calibrated 0–1.

**1. Defend the Kalutara/Beruwala value segment before international flags lock it up**
`category: positioning` · `effortLevel: medium` · `timeHorizon: this-quarter` · `confidence: 0.78`
Eden's Barceló/Occidental relaunch and Serendib's Avani/Anantara resorts now bracket Citrus Waskaduwa with internationally-branded premium product. Sharpen Waskaduwa's value-for-money positioning and complete the refurbishment fast to hold the mid-market guest who would otherwise trade up. *(Triggered by: Eden product launch, Serendib Kalutara overlap.)*

**2. Productise the Blue Orbit / Lotus Tower experience as a competitive moat**
`category: product` · `effortLevel: low` · `timeHorizon: this-month` · `confidence: 0.82`
No competitor owns a Colombo dining-and-banqueting landmark. Bundle "beach + Blue Orbit" stay packages and push Cosmic for MICE/events — a differentiator none of the five rivals can copy. *(Triggered by: self product signal.)*

**3. Win India and regional FIT demand as average spend softens**
`category: messaging` · `effortLevel: medium` · `timeHorizon: this-quarter` · `confidence: 0.71`
India is 27% of national arrivals and spend-per-tourist is declining. Target value-led Indian and regional segments with direct-booking offers rather than chasing the higher-ADR European guest the international flags are built to win. *(Triggered by: industryContext arrivals + spend signals.)*

**4. Protect the newly-won operating margin with direct-booking discipline**
`category: pricing` · `effortLevel: low` · `timeHorizon: this-week` · `confidence: 0.69`
With loss-making rivals (Browns) and OTA-heavy international brands likely to chase occupancy, defend the FY24/25 margin recovery via a direct-booking perk programme instead of OTA discounting. *(Triggered by: Browns loss signal, Eden OTA distribution.)*

**5. Use the F&B halo to recruit revenue-management talent**
`category: talent` · `effortLevel: medium` · `timeHorizon: this-quarter` · `confidence: 0.55`
Conglomerate peers (LOLC/Browns, Hayleys) out-resource Citrus on revenue management. Leverage the high-profile Blue Orbit brand to attract distribution/RM talent that can defend ADR. *(Triggered by: peer hiring depth.)*

## 7.3 Comparative weekly briefing (`generateComparativeBriefing`)

**Briefing**

> This week Citrus Leisure leads the competitive set in share of voice, carried by the continued momentum of Blue Orbit at the Lotus Tower and dual TripAdvisor Travellers' Choice wins for Hikkaduwa and Waskaduwa — a narrative of a value beach brand that has both returned to operating profit and planted a flag in Colombo's premium F&B scene.
>
> The strategic picture is more contested beneath the headline. Two conglomerate-backed operators are converging on Citrus's home turf: Eden Hotel Lanka's Barceló-managed Occidental Eden Beruwala and Serendib's Avani and Anantara resorts in Kalutara both pair international brand equity with balance sheets Citrus cannot match. Together they out-voice the self-brand and dominate funding-related coverage, underscoring that the competitive threat is capital and distribution, not awareness.
>
> The opportunity is in segmentation. As national arrivals hit records but average spend softens, the value-conscious and fast-growing Indian and regional FIT segments are exactly where Citrus's price-to-value positioning and unique Colombo F&B experiences can win — provided the refurbishment lands and direct-booking discipline protects the hard-won margin.

**Suggested narrative angles**

1. *"From beach rooms to the top of the tower"* — Citrus's diversification into landmark Colombo F&B (Blue Orbit) as a reinvention story the asset-heavy peers can't tell.
2. *"Value wins the record season"* — positioning Citrus as the smart-value choice as Sri Lanka chases 3m arrivals with a price-sensitive traveller mix.
3. *"Two awards, one turnaround"* — pairing the Travellers' Choice wins with the return to operating profit for an investor-facing momentum narrative.

---

# 8 · Weekly competitive digest (`generateWeeklySummary`)

> Email-style strategic briefing — top changes by significance, past 7 days.

**Subject: Your competitive week — international flags close in on the west coast**

Three developments matter this week. First, **Eden Hotel Lanka** posted a +140% profit swing for the March quarter, confirming that its Barceló-managed Occidental Eden Beruwala relaunch is gaining commercial traction directly in your Waskaduwa micro-market — the single most significant competitive signal in the set (significance **8/10**). Second, **Serendib Hotels** reported FY2024/25 earnings up 23% on Rs 3.4bn revenue with a clean sweep of guest-review awards across its Avani/Anantara Kalutara portfolio, reinforcing it as the premium trade-up alternative on your doorstep (significance **7/10**). Third, the macro backdrop stayed firmly in your favour: Sri Lanka is tracking toward a 3m-arrival year after a record 2.36m in 2025, though softening average spend rewards value positioning over rate-chasing (significance **7/10**).

Your own week was strong on visibility — Blue Orbit and the dual Travellers' Choice wins gave you the top share of voice — but the structural story is that two deeper-pocketed groups now bracket your core market. The recommended focus: finish the Waskaduwa/Hikkaduwa refurbishments, weaponise the Lotus Tower F&B assets none of them have, and defend margin through direct booking rather than OTA discounting.

🔊 *Audio briefing available (Command tier — ElevenLabs narration of this digest).*

---

## Appendix · Schema coverage checklist

This document exercises every RivalScan output surface:

- ✅ `ResearchFinding` — summary, 6 categories (`news`/`product`/`funding`/`hiring`/`social`/`industryContext`), per-finding `importance` (1–3), `sentiment` (positive/neutral/negative), `timeSensitivity` (breaking/recent/historical), citations, `tokensUsed`
- ✅ `derivedState` — `stage` / `fundingState` / `hiringState` / `strategicDirection` / `techPositioning` / `pacing` / `evidenceNotes` (all enum values verbatim)
- ✅ Enrichment — `momentum` (+`momentumChangePercent`), `threatLevel` + `threatReasoning`, `derivedTags` (competitor + self-brand slug sets)
- ✅ `predictedMoves` — `move` / `reasoning` / `probability` / `timeHorizon` (30d/60d/90d) / `category` *(omitted for self row, per pipeline)*
- ✅ Battlecard — at-a-glance, strategic snapshot grid, win-against tactics (`impact`/`difficulty`), citations
- ✅ Comparative analytics — Share of Voice (`overall` + `byCategory`), Strategic recommendations (`category`/`effortLevel`/`timeHorizon`/`confidence`), Comparative briefing (prose + angles)
- ✅ Brand Health Score — composite + sentiment/voice/momentum components + confidence bucket
- ✅ Weekly digest — `generateWeeklySummary` prose + audio-briefing flag

---

> **AI-generated analysis. May contain errors. For internal evaluation only — not legal or financial advice.**
> Findings sourced from public web research (June 2026). Derived scores, predictions, recommendations and Share-of-Voice counts are illustrative of the RivalScan AI pipeline's output format and were generated for this demonstration, not produced by a live production research run. — *RivalScan*
