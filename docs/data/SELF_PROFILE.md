# Self Profile Page Data (`/:own_screen_name`)

Data available when viewing your own profile page. For shared profile data, see [PROFILE.md](./PROFILE.md).

## Network Endpoints

Same as [PROFILE.md](./PROFILE.md) (`UserByScreenName`, `UserTweets`, `ProfileSpotlightsQuery`), plus:

### `isEligibleForVoButtonUpsellQuery` (GraphQL GET)
- **Variables:** `screenName`, `promptPurpose` ("x_vo_business_promotion")
- **Returns:** Whether the user is eligible for business promotion upsell.

### `useEligibleForHandleShareBannerQuery` (GraphQL GET)
- **Returns:** Whether the handle share banner should be shown.

### `HandleShareBannerQuery` (GraphQL GET)
- **Returns:** Handle share banner metadata.

## React Fiber Data

### `user` prop (profile-level)

Same as [PROFILE.md](./PROFILE.md), with these additional self-only fields:

| Field | Type | Notes |
|---|---|---|
| `birthdate` | object | `{ day, month, year, visibility, year_visibility }` — visibility is "self", "mutual_follow", etc. |
| `needs_phone_verification` | boolean | Whether phone verification is pending |
| `url` | string | Profile website URL |

Fields **not present** on self profile (other-user only):
- `verification_info` — only on other users' profiles
- `user_seed_tweet_count` — only on other users' profiles

### Self-profile specific highlights
- `highlights_info.can_highlight_tweets` is `true` (vs `false` on others' profiles where you lack permission)
- `following` and `followed_by` are both `false` (you don't follow yourself)

## DOM Structure

### Self-specific elements
- `[data-testid="editProfileButton"]` — edit profile button (not present on other profiles)
- `[data-testid="pillLabel"]` — label/pill elements on profile

### Profile Tabs
Same tab navigation as other profiles, but includes an additional **Likes** tab:
- Posts, Replies, Highlights, Articles, Media, **Likes**

### Elements NOT present on self profile
- No follow button (`[data-testid="{userId}-follow"]`)
- No "You might like" / similar users section
- No DM button

## Identifying Self Profile

A profile page is the logged-in user's own profile when:
1. `[data-testid="editProfileButton"]` is present
2. The screen name in the URL matches `a[data-testid="AppTabBar_Profile_Link"]` href
3. `user.following === false && user.followed_by === false` (though this also applies to strangers — combine with other checks)
