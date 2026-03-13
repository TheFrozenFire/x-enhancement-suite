# X Pro Page Data (`pro.x.com/i/decks/{deckId}`)

X Pro (formerly TweetDeck) provides a multi-column deck layout. Tweet and user data in the React fiber tree is a **superset** of regular X — all regular fields are present, plus additional fields documented below.

## Network Endpoints

### `HomeLatestTimeline` (GraphQL POST)
- **Method:** POST (unlike regular X's `HomeTimeline` which is GET)
- **Path:** `/i/api/graphql/{hash}/HomeLatestTimeline`
- **Used on:** Home column
- **Returns:** Chronological timeline entries. Same tweet/user schema but with additional fields (see below).

### `ViewerAccountSync` (GraphQL GET)
- **Path:** `/i/api/graphql/{hash}/ViewerAccountSync`
- **Used on:** All X Pro pages
- **Returns:** Account sync metadata.

### `DelegateSwitcherQuery` (GraphQL GET)
- **Path:** `/i/api/graphql/{hash}/DelegateSwitcherQuery`
- **Used on:** All X Pro pages
- **Returns:** Account delegation/switching data (for managing multiple accounts).

### `useRelayDelegateDataQuery` (GraphQL GET)
- **Path:** `/i/api/graphql/{hash}/useRelayDelegateDataQuery`
- **Used on:** All X Pro pages
- **Returns:** Relay/delegate metadata.

### Common endpoints
Also loads `DataSaverMode`, `user_flow.json`. See [NETWORK.md](./NETWORK.md).

### Endpoints NOT used
- `HomeTimeline` — replaced by `HomeLatestTimeline`
- `XChatDmSettingsQuery` — not observed on X Pro

## React Fiber Data

Data is accessible on `article[data-testid="tweet"]` elements via the `__reactFiber` key, same traversal as regular X.

### `tweet` prop — additional fields (vs regular X)

All fields from [THREAD.md](./THREAD.md) are present, plus:

| Field | Type | Notes |
|---|---|---|
| `source` | string | HTML anchor tag with client app info (e.g. `<a href="..." rel="nofollow">Twitter Web App</a>`) |
| `source_name` | string | Clean client app name (e.g. "Twitter Web App", "Twitter for iPhone") |
| `source_url` | string | Client app URL |
| `permalink` | string | Tweet permalink path (e.g. `/{screen_name}/status/{id}`) |
| `views` | object | `{ state: "Enabled" }` or `{ count: number, state: "EnabledWithCount" }` — view count when available |
| `text` | string | Duplicate of `full_text` |
| `has_super_follower` | boolean | Whether the tweet author has super follower status |
| `retweeted_status` | object/null | Full nested tweet object for retweets (regular X only has retweet context via `socialContext`) |
| `grok_analysis_button` | boolean | Whether Grok analysis is available for this tweet |
| `grok_annotations` | object | Grok annotation metadata |

### `tweet.user` prop — additional fields (vs regular X)

All fields from [THREAD.md](./THREAD.md) are present, plus:

| Field | Type | Notes |
|---|---|---|
| `id` | number | Numeric user ID (regular X only has `id_str`) |
| `profile_image_url` | string | HTTP avatar URL (regular X only has `profile_image_url_https`) |
| `subscribed_by` | boolean | Whether this user is subscribed to you |
| `dm_blocked_by` | boolean | Whether this user has blocked your DMs |
| `dm_blocking` | boolean | Whether you have blocked this user's DMs |
| `professional` | object/null | Professional account metadata (see below) |

### `professional` object

Present on accounts registered as professional/creator accounts:

| Field | Type | Notes |
|---|---|---|
| `professional_type` | string | `"Creator"` or `"Business"` |
| `rest_id` | string | Professional profile ID |
| `category` | array | List of category objects |

Each category object:

| Field | Type | Notes |
|---|---|---|
| `id` | number | Category ID |
| `name` | string | Category name (e.g. "Social Media Influencer", "Media & News") |
| `icon_name` | string | Icon identifier (e.g. "IconBriefcaseStroke") |

## DOM Structure

### Deck Layout
- `[data-testid="gryphonLayout"]` — root deck layout container
- `[data-testid="multi-column-layout-column-content"]` — individual column content area
- `[data-testid="column-title-wrapper"]` — column header (e.g. "Home")

### Column Controls
- `[data-testid="action-icon_Clear posts"]` — clear posts in column
- `[data-testid="action-icon_Open column options - Home"]` — column options menu
- `[data-testid="action-icon_Reorder column - Home"]` — reorder column

### Tweet Cells
- `[data-testid="cellInnerDiv"]` — scroll row container (same as regular X)
- `article[data-testid="tweet"]` — tweet container (same as regular X)
- `[data-testid="tweetText"]` — tweet text content
- `[data-testid="tweetPhoto"]` — tweet images
- `[data-testid="tweet-text-show-more-link"]` — "Show more" link for long tweets

### Tweet Actions
- `[data-testid="reply"]` — reply button
- `[data-testid="retweet"]` — retweet button
- `[data-testid="like"]` — like button
- `[data-testid="caret"]` — tweet menu (three dots)

### Other Elements
- `[data-testid="socialContext"]` — retweet/like context (same as regular X timeline)
- `[data-testid="placementTracking"]` — promoted/ad content
- `[data-testid="pillLabel"]` — label/pill elements
- `[data-testid="icon-verified"]` — verification badge
- `[data-testid="DMDrawer"]` — DM drawer panel
- `[data-testid="SideNav_AccountSwitcher_Button"]` — account switcher
- `[data-testid="ScrollSnap-List"]` — horizontal scroll carousel

## Key Differences from Regular X

| Aspect | X Pro | Regular X |
|---|---|---|
| Timeline endpoint | `HomeLatestTimeline` (POST) | `HomeTimeline` (GET) |
| Tweet `source` fields | Present (`source`, `source_name`, `source_url`) | Not present |
| Tweet `views` | Present with optional count | Not present in fiber |
| Tweet `permalink` | Present | Not present |
| Tweet `retweeted_status` | Full nested tweet object | Only `socialContext` indicator |
| User `professional` | Present with category/type | Not present |
| User `subscribed_by` | Present | Not present |
| User DM block fields | `dm_blocked_by`, `dm_blocking` | Not present |
| Layout | Multi-column deck | Single-column |
| Domain | `pro.x.com` | `x.com` |

## Filtering Potential

X Pro's additional data enables filtering not possible on regular X:

- **By client source**: `source_name` reveals what app was used to post (Web, iPhone, Android, third-party clients)
- **By professional category**: `professional.category[].name` identifies account types (e.g. "Media & News", "Social Media Influencer")
- **By professional type**: `professional.professional_type` distinguishes Creator vs Business accounts
- **By subscription relationship**: `subscribed_by` indicates if a user subscribes to you
- **By DM relationship**: `dm_blocked_by` / `dm_blocking` for DM-level blocking
