# Other User's "Followers You Know" Page (`/:screen_name/followers_you_follow`)

Data available when viewing the "Followers you know" tab on another user's profile. This tab shows followers of the viewed user that you also follow.

## Network Endpoints

### `FollowersYouKnow` (GraphQL GET)
- **Path:** `/i/api/graphql/{hash}/FollowersYouKnow`
- **Variables:** `userId` (numeric — the profile owner's ID), `count` (page size), `cursor` (pagination), `includePromotedContent`
- **Returns:** Paginated list of the profile owner's followers that the logged-in user also follows. Each entry contains a full user object.

Also loads `UserByScreenName` for the profile owner's data.

### Common endpoints
Also loads `DataSaverMode`, `XChatDmSettingsQuery`, `useDirectCallSetupQuery`, `user_flow.json`. See [NETWORK.md](./NETWORK.md).

## React Fiber Data

Data is accessible on `[data-testid="UserCell"]` elements via the `__reactFiber` key.

### `user` prop

Same full user object schema as other following/followers pages — see [OWN_FOLLOWING.md](./OWN_FOLLOWING.md) for the complete field list.

Key relationship fields:

| Field | Type | Notes |
|---|---|---|
| `following` | boolean | Always `true` — all listed users are people you follow |
| `followed_by` | boolean | Whether this user follows **you** back |

## DOM Structure

### Tab Navigation
- `[role="tab"]` elements: **Verified Followers**, **Followers you know**, **Followers**, **Following**
- Same 4-tab layout as other tabs on another user's profile

### User Cells
- `[data-testid="UserCell"]` — each mutual-follow user
- `[data-testid="UserAvatar-Container-{screenName}"]` — avatar
- `[data-testid="{userId}-unfollow"]` — unfollow button (all entries, since you follow everyone listed)
- `[data-testid="userFollowIndicator"]` — "Follows you" indicator (only when `followed_by` is `true`)
- `[data-testid="icon-verified"]` — verification badge

## Unique Characteristics

This page is unique among other-user following/followers pages:
- **Only tab with `userFollowIndicator`** on another user's profile (since all listed users are people you follow, the indicator shows which ones follow you back)
- **All entries have `{userId}-unfollow`** buttons (never `{userId}-follow`, since every user on this list is someone you follow)
- Uses its own dedicated `FollowersYouKnow` endpoint (not `Followers` or `Following`)
- Only available on **other users'** profiles (not on your own)

## Key Differences from Other Tabs

| Aspect | Followers You Know | Followers | Following |
|---|---|---|---|
| Endpoint | `FollowersYouKnow` | `Followers` | `Following` |
| `user.following` | Always `true` | Varies | Varies |
| Action buttons | Unfollow only | Mix of follow/unfollow | Mix of follow/unfollow |
| `userFollowIndicator` | Present (when `followed_by`) | Not present | Not present |
| Available on own profile | No | Yes | Yes |
