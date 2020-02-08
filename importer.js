const { posts } = require('./db');
const cloudscraper = require('cloudscraper')
  .defaults({
    onCaptcha: require('./captcha')()
  });
const cd = require('content-disposition');
const Promise = require('bluebird');
const request = require('request-promise');
const indexer = require('./indexer');
const fs = require('fs-extra');
const isImage = require('is-image');
const mime = require('mime')
const getUrls = require('get-urls');
const sanitizePostContent = async(content) => {
  // mirror and replace any inline images
  let contentToSanitize = content;
  let urls = getUrls(contentToSanitize, {
    sortQueryParameters: false,
    stripWWW: false
  });
  await Promise.mapSeries(urls, async(val) => {
    let url = new URL(val);
    if (isImage(url.origin + url.pathname)) {
      let imageMime = mime.getType(url.origin + url.pathname);
      let filename = new Date().getTime() + '.' + mime.getExtension(imageMime);
      let data = await request.get({url: val, encoding: 'binary'});
      fs.outputFile(`${process.env.DB_ROOT}/inline/${filename}`, data, 'binary');
      contentToSanitize = contentToSanitize.replace(val, `https://kemono.party/inline/${filename}`);
    }
  })
  return contentToSanitize;
}
async function scraper(key, uri = 'https://api.patreon.com/stream?json-api-version=1.0') {
  let options = cloudscraper.defaultParams;
  options.headers['cookie'] = `session_id=${key}`;
  options['resolveWithFullResponse'] = true;
  options['json'] = true;

  let patreon = await cloudscraper.get(uri, options)
  await Promise
    .mapSeries(patreon.body.data, async(post) => {
      let attr = post.attributes;
      let rel = post.relationships;
      let cdn = 'https://kemono.party'
      let fileKey = `files/${rel.user.data.id}/${post.id}`
      let attachmentsKey = `attachments/${rel.user.data.id}/${post.id}`

      let postDb = {
        version: 1,
        title: attr.title,
        content: await sanitizePostContent(attr.content),
        id: post.id,
        user: rel.user.data.id,
        post_type: attr.post_type,
        published_at: attr.published_at,
        added_at: new Date().getTime(),
        embed: {},
        post_file: {},
        attachments: []
      };

      let postExists = await posts.findOne({id: post.id});
      if (postExists) return;

      if (attr.post_file) {
        await fs.ensureFile(`${process.env.DB_ROOT}/${fileKey}/${attr.post_file.name}`);
        await request.get({url: attr.post_file.url, encoding: 'binary'})
          .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/${fileKey}/${attr.post_file.name}`, 'binary'))
        postDb.post_file['name'] = attr.post_file.name
        postDb.post_file['path'] = `${cdn}/${fileKey}/${attr.post_file.name}`
      }

      if (attr.embed) {
        postDb.embed['subject'] = attr.embed.subject;
        postDb.embed['description'] = attr.embed.description;
        postDb.embed['url'] = attr.embed.url;
      }

      Promise
        .mapSeries(rel.attachments.data, async(attachment) => {
          // use content disposition
          let attachmentOptions = options;
          attachmentOptions['encoding'] = 'binary';

          await cloudscraper.get(`https://www.patreon.com/file?h=${post.id}&i=${attachment.id}`, attachmentOptions)
            .on('response', async(attachmentData) => {
              let info = cd.parse(attachmentData.headers['content-disposition']);
              postDb.attachments.push({
                id: attachment.id, 
                name: info.parameters.filename,
                path: `${cdn}/${attachmentsKey}/${info.parameters.filename}`
              })
              await fs.ensureFile(`${process.env.DB_ROOT}/${attachmentsKey}/${info.parameters.filename}`);
              res.pipe(fs.createWriteStream(`${process.env.DB_ROOT}/${attachmentsKey}/${info.parameters.filename}`, 'binary'));
            })
        })
        .then(() => posts.insert(postDb))
    })
  
  indexer()
  if (patreon.body.links.next) {
    scraper(key, 'https://' + patreon.body.links.next)
  }
}

posts.loadDatabase();
module.exports = (key) => scraper(key)