# X/Twitter Network Endpoints

Shared reference for GraphQL and REST endpoints used across pages.
Each page-specific document references this file for endpoint details.

## Authentication

All GraphQL endpoints require:
- **Bearer token**: Public app-level token embedded in X's client JavaScript (same for all users). Can be extracted at runtime from the client bundle.
- **CSRF token**: `ct0` cookie value, sent as `x-csrf-token` header
- **Credentials**: `include` (session cookies)

## GraphQL Endpoints

### `TweetDetail`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/TweetDetail`
- **Variables:** `focalTweetId`, `rankingMode` ("Relevance"), `withCommunity`, etc.
- **Used on:** Thread pages
- **Returns:** Focal tweet + paginated reply timeline. Each tweet entry includes full `tweet` and `user` objects (see [THREAD.md](./THREAD.md) for field details).

### `TweetResultByRestId`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/TweetResultByRestId`
- **Variables:** `tweetId`
- **Used on:** Thread pages
- **Returns:** Single tweet with full user data.

### `AboutAccountQuery`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/AboutAccountQuery`
- **Variables:** `screenName`
- **Used on:** `/{screenName}/about` page
- **Returns:** Account transparency info including:
  - `about_profile.account_based_in` — country/region string (e.g. "Spain", "Europe")
  - `about_profile.created_country_accurate` — boolean
  - `about_profile.location_accurate` — boolean
  - `about_profile.source` — account creation source (e.g. "Web")
  - `about_profile.username_changes.count` — number of username changes
  - `core.created_at` — account creation date
  - `core.name`, `core.screen_name` — display name and handle

### `HomeTimeline`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/HomeTimeline`
- **Variables:** `count` (page size), `includePromotedContent`, `requestContext` ("launch"), `withCommunity`
- **Used on:** Timeline (`/home`)
- **Returns:** Paginated timeline entries (tweets, promoted content, injected modules). Same tweet/user schema as `TweetDetail`.

### `UserByScreenName`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/UserByScreenName`
- **Variables:** `screen_name`, `withGrokTranslatedBio`
- **Used on:** Profile pages (`/:screen_name`)
- **Returns:** Full user profile object. Superset of `tweet.user` — includes additional fields like `highlights_info`, `verification_info`, `has_hidden_subscriptions_on_profile`. See [PROFILE.md](./PROFILE.md).

### `UserTweets`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/UserTweets`
- **Variables:** `userId` (numeric), `count`, `includePromotedContent`, `withQuickPromoteEligibilityTweetFields`, `withVoice`
- **Used on:** Profile pages (`/:screen_name`)
- **Returns:** Paginated tweet timeline for a user. Same tweet schema as `TweetDetail`.

### `ProfileSpotlightsQuery`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/ProfileSpotlightsQuery`
- **Variables:** `screen_name`
- **Used on:** Profile pages
- **Returns:** Profile spotlight/highlight metadata.

### `PinnedTimelines`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/PinnedTimelines`
- **Used on:** Timeline (`/home`)
- **Returns:** Pinned timeline/list metadata (custom tabs alongside "For You" / "Following").

### `DataSaverMode`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/DataSaverMode`
- **Variables:** `device_id`
- **Used on:** All pages
- **Returns:** Data saver preferences.

### `XChatDmSettingsQuery`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/XChatDmSettingsQuery`
- **Used on:** All pages
- **Returns:** DM settings.

### `Following`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/Following`
- **Variables:** `userId` (numeric), `count` (page size), `includePromotedContent`
- **Used on:** `/:screen_name/following`
- **Returns:** Paginated list of followed users. Each entry contains a full user object (same schema as `tweet.user`).

### `Followers`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/Followers`
- **Variables:** `userId` (numeric), `count` (page size), `includePromotedContent`
- **Used on:** `/:screen_name/followers`
- **Returns:** Paginated list of all followers. Same user object schema as `Following`.

### `BlueVerifiedFollowers`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/BlueVerifiedFollowers`
- **Variables:** `userId` (numeric), `count` (page size), `includePromotedContent`
- **Used on:** `/:screen_name/verified_followers`
- **Returns:** Paginated list of verified/premium followers only. Same user object schema as `Following`.

### `FollowersYouKnow`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/FollowersYouKnow`
- **Variables:** `userId` (numeric), `count` (page size), `cursor` (pagination), `includePromotedContent`
- **Used on:** `/:screen_name/followers_you_follow` (other users only)
- **Returns:** Paginated list of the profile owner's followers that the logged-in user also follows. Same user object schema as `Following`.

### `HomeLatestTimeline`
- **Method:** POST
- **Path:** `/i/api/graphql/{hash}/HomeLatestTimeline`
- **Used on:** X Pro deck Home column (`pro.x.com`)
- **Returns:** Chronological timeline entries. Superset of `HomeTimeline` — tweet objects include additional fields (`source`, `source_name`, `views`, `permalink`, `retweeted_status`), user objects include additional fields (`professional`, `subscribed_by`, `dm_blocked_by`, `dm_blocking`). See [X_PRO.md](./X_PRO.md).

### `ViewerAccountSync`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/ViewerAccountSync`
- **Used on:** X Pro (`pro.x.com`)
- **Returns:** Account sync metadata.

### `DelegateSwitcherQuery`
- **Method:** GET
- **Path:** `/i/api/graphql/{hash}/DelegateSwitcherQuery`
- **Used on:** X Pro (`pro.x.com`)
- **Returns:** Account delegation/switching data.

## REST Endpoints

### `user_flow.json`
- **Method:** POST
- **Path:** `/i/api/1.1/graphql/user_flow.json`
- **Used on:** All pages (multiple calls)
- **Returns:** User flow/onboarding state.

## Notes

- GraphQL endpoint hashes (the `{hash}` in paths) may change between X client versions. They should be treated as opaque identifiers that can be discovered at runtime.
- Endpoints accept a `features` query parameter with feature flags — these also change between versions.
- Response schemas are not formally documented; field availability may change without notice.
