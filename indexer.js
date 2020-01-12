const Promise = require('bluebird');
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()})
const { posts, lookup } = require('./db');
lookup.ensureIndex({fieldName: 'name'});
async function indexer() {
  posts.loadDatabase();
  let postsData = await posts.cfind({}).sort({ added_at: -1 }).exec();
  Promise.mapSeries(postsData, async(post) => {
    lookup.loadDatabase();
    let indexExists = await lookup.findOne({id: post.user});
    if (indexExists) return;

    let api = 'https://www.patreon.com/api/user';
    let user = await cloudscraper.get(`${api}/${post.user}`, { json: true })
    lookup.insert({
      version: post.version,
      id: post.user,
      name: user.data.attributes.vanity || user.data.attributes.full_name
    })
  });
}

module.exports = () => indexer()