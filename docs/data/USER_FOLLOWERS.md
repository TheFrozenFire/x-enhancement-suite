# Other User's Followers Pages (`/:screen_name/followers`, `/:screen_name/verified_followers`)

Data available when viewing another user's Followers and Verified Followers lists.

## Network Endpoints

### `Followers` (GraphQL GET)
Same endpoint as own followers page. See [NETWORK.md](./NETWORK.md).
- **Variables:** `userId` (numeric — the profile owner's ID), `count`, `includePromotedContent`
- **Used on:** `/:screen_name/followers` tab
- **Returns:** Paginated list of all followers of this user.

### `BlueVerifiedFollowers` (GraphQL GET)
Same endpoint as own verified followers page. See [NETWORK.md](./NETWORK.md).
- **Variables:** `userId` (numeric — the profile owner's ID), `count`, `includePromotedContent`
- **Used on:** `/:screen_name/verified_followers` tab
- **Returns:** Paginated list of verified/premium followers only.

Also loads `UserByScreenName` for the profile owner's data.

### Common endpoints
Also loads `DataSaverMode`, `XChatDmSettingsQuery`, `useDirectCallSetupQuery`, `user_flow.json`. See [NETWORK.md](./NETWORK.md).

## React Fiber Data

Data is accessible on `[data-testid="UserCell"]` elements via the `__reactFiber` key.

### `user` prop

Same full user object schema as own followers pages — see [OWN_FOLLOWING.md](./OWN_FOLLOWING.md) for the complete field list.

Key relationship fields reflect **your** relationship to the listed user (not the profile owner's):

| Field | Type | Notes |
|---|---|---|
| `following` | boolean | Whether **you** follow this user |
| `followed_by` | boolean | Whether this user follows **you** |

## DOM Structure

### Tab Navigation
- `[role="tab"]` elements: **Verified Followers**, **Followers you know**, **Followers**, **Following**
- 4 tabs (vs 3 on own profile — adds "Followers you know")

### User Cells
- `[data-testid="UserCell"]` — each follower
- `[data-testid="UserAvatar-Container-{screenName}"]` — avatar
- `[data-testid="{userId}-follow"]` — follow button (when you don't follow this user)
- `[data-testid="{userId}-unfollow"]` — unfollow button (when you follow this user)
- `[data-testid="icon-verified"]` — verification badge

### Notable Absences (vs own followers pages)
- No `userFollowIndicator` — only shown on your own followers pages to indicate "Follows you"
- No `pillLabel` testid

## Key Differences from Own Followers Pages

| Aspect | Other User's Followers | Own Followers |
|---|---|---|
| Tabs | 4 tabs (adds "Followers you know") | 3 tabs |
| `userFollowIndicator` | Not present | Present on all cells |
| Relationship fields | Your relationship to listed user | Your relationship to listed user |
| `UserByScreenName` request | Yes (loads profile owner data) | No |
