const Promise = require('bluebird');
const request = require('request-promise');
const { unraw } = require('unraw');
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()})
const { posts, lookup } = require('./db');
async function indexer() {
  posts.loadDatabase();
  let postsData = await posts.cfind({}).sort({ added_at: -1 }).exec();
  Promise.mapSeries(postsData, async(post) => {
    lookup.loadDatabase();
    let indexExists = await lookup.findOne({id: post.user});
    if (indexExists) return;

    if (post.version == 1) { // patreon
      let api = 'https://www.patreon.com/api/user';
      let user = await cloudscraper.get(`${api}/${post.user}`, { json: true })
      lookup.insert({
        version: post.version,
        id: post.user,
        name: user.data.attributes.vanity || user.data.attributes.full_name
      })
    } else if (post.version == 2 && post.service == 'fanbox') {
      let api = 'https://www.pixiv.net/ajax/fanbox/creator?userId';
      let user = await request.get(`${api}=${post.user}`);
      lookup.insert({
        version: post.version,
        service: 'fanbox',
        id: post.user,
        name: unraw(user.body.creator.user.name)
      })
    }
  });
}

module.exports = () => indexer()