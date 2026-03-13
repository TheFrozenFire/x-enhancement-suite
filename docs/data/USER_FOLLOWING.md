# Other User's Following Page (`/:screen_name/following`)

Data available when viewing another user's Following list.

## Network Endpoints

### `Following` (GraphQL GET)
Same endpoint as own following page. See [NETWORK.md](./NETWORK.md).
- **Variables:** `userId` (numeric — the profile owner's ID), `count`, `includePromotedContent`
- **Returns:** Paginated list of users this person follows.

Also loads `UserByScreenName` for the profile owner's data.

### Common endpoints
Also loads `DataSaverMode`, `XChatDmSettingsQuery`, `useDirectCallSetupQuery`, `user_flow.json`. See [NETWORK.md](./NETWORK.md).

## React Fiber Data

Data is accessible on `[data-testid="UserCell"]` elements via the `__reactFiber` key.

### `user` prop

Same full user object schema as own following page — see [OWN_FOLLOWING.md](./OWN_FOLLOWING.md) for the complete field list. Additionally may include:

| Field | Type | Notes |
|---|---|---|
| `professional` | object | Professional/business account metadata (not always present) |

Key relationship fields reflect **your** relationship to the listed user (not the profile owner's):

| Field | Type | Notes |
|---|---|---|
| `following` | boolean | Whether **you** follow this user |
| `followed_by` | boolean | Whether this user follows **you** |

## DOM Structure

### Tab Navigation
- `[role="tab"]` elements: **Verified Followers**, **Followers you know**, **Followers**, **Following**
- 4 tabs (vs 3 on own profile — adds "Followers you know")
- `aria-selected="true"` on the active tab

### User Cells
- `[data-testid="UserCell"]` — each followed user
- `[data-testid="UserAvatar-Container-{screenName}"]` — avatar
- `[data-testid="{userId}-follow"]` — follow button (when you don't follow this user)
- `[data-testid="{userId}-unfollow"]` — unfollow button (when you follow this user)
- `[data-testid="icon-verified"]` — verification badge

### Notable Absences
- No `userFollowIndicator` — only appears on your own followers pages

## Key Differences from Own Following Page

| Aspect | Other User's Following | Own Following |
|---|---|---|
| Tabs | 4 tabs (adds "Followers you know") | 3 tabs |
| Action buttons | Mix of follow/unfollow (based on your relationship) | Unfollow only |
| `user.following` | Varies (your relationship) | Always `true` |
| `UserByScreenName` request | Yes (loads profile owner data) | No (already loaded) |
