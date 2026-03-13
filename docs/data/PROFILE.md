# Profile Page Data (`/:screen_name`)

Data available when viewing another user's profile page (not your own — see [SELF_PROFILE.md](./SELF_PROFILE.md) for self-profile specifics).

## Network Endpoints

### `UserByScreenName` (GraphQL GET)
Primary endpoint for loading a user's profile data.
- **Variables:** `screen_name`, `withGrokTranslatedBio`
- **Feature flags:** `hidden_profile_subscriptions_enabled`, `subscriptions_verification_info_is_identity_verified_enabled`, `highlights_tweets_tab_ui_enabled`, etc.
- **Returns:** Full user object with profile metadata. See [NETWORK.md](./NETWORK.md).

### `UserTweets` (GraphQL GET)
Loads the user's tweet timeline (Posts tab).
- **Variables:** `userId` (numeric ID), `count` (page size), `includePromotedContent`, `withQuickPromoteEligibilityTweetFields`, `withVoice`
- **Returns:** Paginated tweet timeline. Each tweet has the same structure as [THREAD.md](./THREAD.md) `tweet` prop.

### `ProfileSpotlightsQuery` (GraphQL GET)
- **Variables:** `screen_name`
- **Returns:** Profile spotlight/highlight metadata.

### Common endpoints
Also loads `DataSaverMode`, `XChatDmSettingsQuery`, `useDirectCallSetupQuery`, `user_flow.json`. See [NETWORK.md](./NETWORK.md).

## React Fiber Data

Profile-level user data is accessible by walking up the fiber tree from `[data-testid="UserName"]`.

### `user` prop (profile-level)

Same schema as `tweet.user` on thread/timeline pages (see [THREAD.md](./THREAD.md)), with these additional fields:

| Field | Type | Notes |
|---|---|---|
| `verification_info` | object | `{ is_identity_verified: boolean }` |
| `user_seed_tweet_count` | number | Seed tweet count |
| `highlights_info` | object | `{ can_highlight_tweets: boolean, highlighted_tweets: string }` |
| `has_hidden_subscriptions_on_profile` | boolean | Whether subscriptions are hidden |
| `premium_gifting_eligible` | boolean | Eligible for premium gifting |

Fields **not present** on other users' profiles (self-only):
- `birthdate` — only visible on own profile
- `needs_phone_verification` — only on own profile

### Tweet data

Tweets on the Posts tab use the same `tweet` and `tweet.user` schema as [THREAD.md](./THREAD.md).

## DOM Structure

### Profile Header
- `[data-testid="UserName"]` — display name and handle
- `[data-testid="UserDescription"]` — bio text
- `[data-testid="UserLocation"]` — location (only present if user has set one)
- `[data-testid="UserUrl"]` — website link
- `[data-testid="UserJoinDate"]` — join date
- `[data-testid="UserProfileHeader_Items"]` — container for location, url, join date
- `[data-testid="UserProfileSchema-test"]` — schema.org metadata
- `[data-testid="{userId}-follow"]` — follow button (shows "Follow" text when not following)
- `[data-testid="placementTracking"]` — promoted/suggested content

### Profile Tabs
- `[role="tab"]` elements — tab navigation
- Typical tabs for other users: Posts, Replies, Highlights, Articles, Media

### "You might like" Section
- `[data-testid="UserCell"]` — user recommendation cards (similar users)
- `[data-testid="{userId}-follow"]` — follow buttons on recommended users

### Tweet Cells
Same structure as timeline — see [TIMELINE.md](./TIMELINE.md).

## Key Differences from Self Profile

| Aspect | Other Profile | Self Profile |
|---|---|---|
| Edit button | Not present | `[data-testid="editProfileButton"]` |
| Follow button | `[data-testid="{userId}-follow"]` | Not present |
| Birthdate data | Not available | Available in fiber |
| Tabs | Posts, Replies, Highlights, Articles, Media | Posts, Replies, Highlights, Articles, Media, Likes |
| "You might like" | Present (suggested similar users) | Not present |
| Self-specific endpoints | N/A | `isEligibleForVoButtonUpsellQuery`, `HandleShareBannerQuery` |
