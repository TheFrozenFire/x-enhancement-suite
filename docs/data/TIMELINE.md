# Timeline Page Data (`/home`)

## Network Endpoints

### `HomeTimeline` (GraphQL GET)
Primary endpoint for loading the "For You" timeline.
- **Variables:** `count` (page size, default 20), `includePromotedContent`, `requestContext` ("launch"), `withCommunity`
- **Returns:** Paginated timeline entries including tweets, promoted content, and injected modules (e.g. "Creators for you"). Each tweet entry includes full `tweet` and `user` objects.

### `PinnedTimelines` (GraphQL GET)
Returns pinned timeline/list metadata (e.g. custom tabs alongside "For You" / "Following").

### Common endpoints
Also loads `DataSaverMode`, `XChatDmSettingsQuery`, `useDirectCallSetupQuery`, `getAltTextPromptPreference`, `user_flow.json`. See [NETWORK.md](./NETWORK.md).

## React Fiber Data

Data is accessible on `article[data-testid="tweet"]` elements via the `__reactFiber` key.

### `tweet` prop

Same schema as thread page — see [THREAD.md](./THREAD.md) for the full field list.

Notable timeline-specific fields:
| Field | Type | Notes |
|---|---|---|
| `in_reply_to_status_id_str` | string/null | Set when the tweet is a reply (shown with "Replying to" context) |
| `quoted_status` | object/null | Embedded quote tweet data |
| `quoted_status_permalink` | object/null | Permalink info for the quoted tweet |
| `extended_entities` | object/null | Extended media entities (multiple images, video metadata) |

### `tweet.user` prop

Same schema as thread page — see [THREAD.md](./THREAD.md) for the full field list.

Additional field observed on timeline:
| Field | Type | Notes |
|---|---|---|
| `highlightedLabel` | object | Profile label/badge info (may not be present on thread page) |

### `userData` prop

Same schema as thread page — see [THREAD.md](./THREAD.md).

### `loggedInUser` prop

Same schema as thread page — see [THREAD.md](./THREAD.md).

### Timeline-specific fiber props

| Prop | Type | Notes |
|---|---|---|
| `label` | object/null | Profile label metadata: `badge`, `description`, `url`, `userLabelDisplayType` (e.g. "Badge"), `userLabelType` (e.g. "BusinessLabel") |
| `screenNameSuffix` | object | Timestamp component with `link` (permalink), `timestamp` (ISO string) |
| `quotedTweetPermalink` | string/null | Permalink path for quoted tweet |
| `contextualClientEventInfo` | object | Analytics/tracking context |

## DOM Structure

### Tab Navigation
- `[role="tab"]` elements for "For You" and "Following" tabs
- `aria-selected="true"` on the active tab

### Tweet Cells
- `[data-testid="cellInnerDiv"]` — virtual scroll row container
- `article[data-testid="tweet"]` — tweet container (same as thread page)

### Injected Modules (non-tweet cells)

**"Creators for you" / "Who to follow":**
- `[data-testid="UserCell"]` — user recommendation card
- `[data-testid="{userId}-subscribe"]` — subscribe button
- These appear between tweet cells in the timeline

### Reply Indicators on Timeline
Replies that appear in the timeline show "Replying to @username" text via `div > span` elements within the article. This is distinct from thread pages where position determines reply status.

### Social Context
- `[data-testid="socialContext"]` — shows context like "X liked" or "X retweeted" (appears above the tweet when someone the user follows interacted with it)

### Key `data-testid` selectors (timeline-specific)
- `[data-testid="ScrollSnap-List"]` — horizontal scroll carousel (for "Creators for you" etc.)
- `[data-testid="UserCell"]` — user recommendation cell
- `[data-testid="{userId}-subscribe"]` — subscribe button on user recommendations

For common tweet-level selectors, see [THREAD.md](./THREAD.md).

## Distinguishing Tweet Types on Timeline

| Type | How to identify |
|---|---|
| Original post | No `in_reply_to_status_id_str`, no social context |
| Reply | Has "Replying to" span text, `in_reply_to_status_id_str` is set |
| Quote tweet | `is_quote_status` is true, `quoted_status` is present |
| Retweet | `[data-testid="socialContext"]` with "retweeted" text |
| Promoted/Ad | `[data-testid="placementTracking"]` in the cell |

## Notable Differences from Thread Page

- No focal tweet — all tweets are peers in the timeline
- Social context indicators (likes/retweets by followed users) are unique to timeline
- "Creators for you" / "Who to follow" injected modules appear between tweets
- Tab navigation ("For You" / "Following") controls which timeline is shown
- `label` prop (profile business labels) observed more frequently on timeline tweets
