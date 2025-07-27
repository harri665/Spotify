const buddyList = require('./')

async function main () {
  const spDcCookie = 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4'

  const accessTokenInfo = await buddyList.getWebAccessToken(spDcCookie)

  console.log('Access token:', JSON.stringify(accessTokenInfo))

  const friendActivity = await buddyList.getFriendActivity(accessTokenInfo.accessToken)

  console.log(JSON.stringify(friendActivity, null, 2))
}

main()

// Run every minute
// setInterval(() => main(), 1000 * 60)
