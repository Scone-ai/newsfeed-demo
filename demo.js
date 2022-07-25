import fetch from 'node-fetch';
import { connect } from 'getstream';
import pkg from 'contentful';
const {createClient} = pkg;
import ogs from 'open-graph-scraper';

const SCONE_ROOT_URL = 'https://api.scone.ai/api/v2';
const LOCALES = ['nl-NL', 'en-US', 'de-DE', 'fr-FR', 'pt-PT']
const LOCALE_ONLY = true

const authToken = process.argv[2];

if (!authToken) {
  console.log(`Auth token required`)
  process.exit()
}
const locale = process.argv[3] || LOCALES[0];

if (!LOCALES.includes(locale)) {
  console.log(`unsupported locale: ${locale}`)
  process.exit()
}

(async () => {
  try {
    const tokenResponse = await fetch(SCONE_ROOT_URL + '/user/newsfeed-tokens', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      }
    })

    if (tokenResponse.status !== 200) {
      console.log(`Token fetch failed, probably invalid auth token`)
      return
    }

    const tokens = await tokenResponse.json()
    console.log(tokens)

    const contentfulClient = createClient({space: tokens.contentfulSpace, accessToken: tokens.contentfulAccessToken});

    const client = connect(tokens.getstreamApiKey, tokens.getstreamUserToken, tokens.getstreamAppId);
    const feed = client.feed('user', tokens.userUuid);
    const feedData = await feed.get({ limit: 10 });

    for (const feedItem of feedData.results) {
      console.log()
      console.log()
      console.log('Getstream data:')
      console.log(' Object ID', feedItem.object)
      console.log(' authorName:', feedItem.authorName)
      console.log(' authorAvatar:', feedItem.authorAvatar)
      console.log(' category:', feedItem.category)
      console.log(' contentfulId:', feedItem.contentfulId)
      console.log(' contentPublishDate:', feedItem.contentPublishDate)
      console.log(' subType', feedItem.subType)
      console.log(' hasPages:', feedItem.hasPages)
      console.log(' linkLanguages', feedItem.linkLanguages)

      if (!feedItem.contentfulId) {
        console.log('Skipping rest as no contentful ID')
        continue
      }

      if (LOCALE_ONLY && feedItem.linkLanguages && !feedItem.linkLanguages.includes(locale)) {
        console.log('Skipping rest as language not supported')
        continue
      }

      const entity = await contentfulClient.getEntry(feedItem.contentfulId, {
        include: 3,
        locale: locale
      });
      console.log()
      console.log('Contentful data:')
      console.log(' image:', entity?.fields.image?.fields.file.url)
      console.log(' link:', entity?.fields.link)
      console.log(' linkHeadline:', entity?.fields.linkHeadline)
      console.log(' linkLanguages:', entity?.fields.linkLanguages)
      console.log(' description:')
      console.log(entity?.fields.description)
      if (entity?.fields.link) {
        console.log()
        console.log('OpenGraph data:')
        try {
          const ogResult = await ogs({url: entity?.fields.link})
          console.log(' link title:', ogResult.result.ogTitle)
          console.log(' link description:', ogResult.result.ogDescription)
          console.log(' link type:', ogResult.result.ogType)
          console.log(' link image:', ogResult.result.ogImage.url)
        } catch (e) {
          console.log('failed to fetch')
          continue
        }
      }
    }
  }
  catch (e) {
    console.log(e)
  }
})()
