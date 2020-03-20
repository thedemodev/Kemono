const sync = require('node-sync')
const request = require('request-promise');
const { unraw } = require('unraw');
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()})
const { posts, lookup } = require('./db');
async function indexer() {
  await posts
    .find({})
    .forEach(post => {
      let indexExists = sync(lookup.findOne({id: post.user}));
      if (indexExists) return;

      switch (post.service) {
        case 'patreon': {
          let api = 'https://www.patreon.com/api/user';
          cloudscraper.get(`${api}/${post.user}`, { json: true })
            .then(user => {
              lookup.insertOne({
                version: post.version,
                service: 'patreon',
                id: post.user,
                name: user.data.attributes.vanity || user.data.attributes.full_name
              });
            })
          break;
        }
        case 'fanbox': {
          let api = 'https://fanbox.pixiv.net/api/creator.get?userId';
          request
            .get(`${api}=${post.user}`, { 
              json: true,
              headers: {
                'origin': 'https://www.pixiv.net'
              } 
            })
            .then(user => {
              lookup.insertOne({
                version: post.version,
                service: 'fanbox',
                id: post.user,
                name: unraw(user.body.user.name)
              })
            })
          break;
        }
        case 'gumroad': {
          let api = 'https://kemono.party/proxy/gumroad/user';
          request.get(`${api}/${post.user}`, { json: true })
            .then(user => {
              lookup.insertOne({
                version: post.version,
                service: 'gumroad',
                id: post.user,
                name: user.name
              })
            })
          break;
        }
        default: {
          let api = 'https://www.patreon.com/api/user';
          cloudscraper.get(`${api}/${post.user}`, { json: true })
            .then(user => {
              lookup.insertOne({
                version: post.version,
                service: 'patreon',
                id: post.user,
                name: user.data.attributes.vanity || user.data.attributes.full_name
              })
            })
        }
      }
    })
}

module.exports = () => indexer()