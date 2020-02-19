const { posts } = require('./db');
const cloudscraper = require('cloudscraper')
  .defaults({
    onCaptcha: require('./captcha')()
  });
const cloudscraper2 = require('cloudscraper') // https://github.com/request/request/issues/2974
  .defaults({
    onCaptcha: require('./captcha')(),
    encoding: null
  });
const { workerData } = require('worker_threads');
const cd = require('content-disposition');
const Promise = require('bluebird');
const request = require('request-promise');
const indexer = require('./indexer');
const fs = require('fs-extra');
const isImage = require('is-image');
const mime = require('mime')
const getUrls = require('get-urls');
const crypto = require('crypto');
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
      await fs.ensureFile(`${process.env.DB_ROOT}/inline/${filename}`);
      request.get({url: val, encoding: null})
        .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/inline/${filename}`, {
          highWaterMark: 64 * 1024
        }))
      contentToSanitize = contentToSanitize.replace(val, `https://kemono.party/inline/${filename}`);
    }
  })
  return contentToSanitize;
}
async function scraper(key, uri = 'https://api.patreon.com/stream?json-api-version=1.0') {
  let safeToLoop = true;
  let options = cloudscraper.defaultParams;
  options.headers['cookie'] = `session_id=${key}`;
  options['resolveWithFullResponse'] = true;
  options['json'] = true;

  let patreon = await cloudscraper.get(uri, options)
  if (patreon.body.data.length == 0) safeToLoop = false;
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
        let filename = attr.post_file.name.replace(/ /g, '_')
        await fs.ensureFile(`${process.env.DB_ROOT}/${fileKey}/${filename}`);
        await request.get({url: attr.post_file.url, encoding: null})
          .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/${fileKey}/${filename}`, {
            highWaterMark: 64 * 1024
          }))
        postDb.post_file['name'] = attr.post_file.name
        postDb.post_file['path'] = `${cdn}/${fileKey}/${filename}`
      }

      if (attr.embed) {
        postDb.embed['subject'] = attr.embed.subject;
        postDb.embed['description'] = attr.embed.description;
        postDb.embed['url'] = attr.embed.url;
      }

      Promise
        .mapSeries(rel.attachments.data, async(attachment) => {
          // use content disposition
          let attachmentOptions = cloudscraper.defaultParams;
          attachmentOptions['encoding'] = null;
          attachmentOptions.headers['cookie'] = `session_id=${key}`;

          let randomKey = crypto.randomBytes(20).toString('hex');
          await fs.ensureFile(`${process.env.DB_ROOT}/${attachmentsKey}/${randomKey}`);
          await new Promise(resolve => {
            cloudscraper2.get(`https://www.patreon.com/file?h=${post.id}&i=${attachment.id}`, attachmentOptions)
              .on('complete', async(attachmentData) => {
                let info = cd.parse(attachmentData.headers['content-disposition']);
                let filename = info.parameters.filename.replace(/ /g, '_')
                postDb.attachments.push({
                  id: attachment.id,
                  name: info.parameters.filename,
                  path: `${cdn}/${attachmentsKey}/${filename}`
                })
                await fs.move(
                  `${process.env.DB_ROOT}/${attachmentsKey}/${randomKey}`,
                  `${process.env.DB_ROOT}/${attachmentsKey}/${filename}`
                );
                resolve()
              })
              .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/${attachmentsKey}/${randomKey}`, {
                highWaterMark: 64 * 1024
              }))
          })   
        })
        .then(async() => {
          await posts.insertOne(postDb)
          postDb = null; // avoid memory leaks
        })
    })
  
  if (patreon.body.links.next && safeToLoop) {
    scraper(key, 'https://' + patreon.body.links.next)
    patreon = null;
  } else {
    indexer();
  }
}

scraper(workerData);