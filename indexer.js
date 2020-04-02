const Promise = require('bluebird');
const request = require('request-promise');
const { unraw } = require('unraw');
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()});
const { posts, lookup } = require('./db');
posts.createIndex({ added_at: -1 });
async function indexer() {
  let postsData = await posts
    .find({})
    .sort({ added_at: -1 })
    .project({ version: 1, user: 1 })
    .toArray();
  Promise.mapSeries(postsData, async(post) => {
    let indexExists = await lookup.findOne({id: post.user, service: post.service});
    if (indexExists) return;

    switch (post.service) {
      case 'patreon': {
        let api = 'https://www.patreon.com/api/user';
        let user = await cloudscraper.get(`${api}/${post.user}`, { json: true });
        await lookup.insertOne({
          version: post.version,
          service: 'patreon',
          id: post.user,
          name: user.data.attributes.vanity || user.data.attributes.full_name
        });
        break;
      }
      case 'fanbox': {
        let api = 'https://fanbox.pixiv.net/api/creator.get?userId';
        let user = await request.get(`${api}=${post.user}`, { 
          json: true,
          headers: {
            'origin': 'https://www.pixiv.net'
          } 
        });
        await lookup.insertOne({
          version: post.version,
          service: 'fanbox',
          id: post.user,
          name: unraw(user.body.user.name)
        });
        break;
      }
      case 'gumroad': {
        let api = 'https://kemono.party/proxy/gumroad/user';
        let user = await request.get(`${api}/${post.user}`, { json: true });
        await lookup.insertOne({
          version: post.version,
          service: 'gumroad',
          id: post.user,
          name: user.name
        })
        break;
      }
      default: {
        let api = 'https://www.patreon.com/api/user';
        let user = await cloudscraper.get(`${api}/${post.user}`, { json: true });
        await lookup.insertOne({
          version: post.version,
          service: 'patreon',
          id: post.user,
          name: user.data.attributes.vanity || user.data.attributes.full_name
        });
      }
    }

  });
}

module.exports = () => indexer()