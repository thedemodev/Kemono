const Datastore = require('nedb-promise');
const db = new Datastore({filename: `${process.env.DB_ROOT}/posts.db`});
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()});
const cd = require('content-disposition');
const Promise = require('bluebird');
const request = require('request-promise');
const os = require('os');
const fs = require('fs-extra');
const mime = require('mime');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_ACCESS_KEY,
  region: process.env.S3_REGION
});
let tmpdir = os.tmpdir()
async function scraper(key, uri = 'https://api.patreon.com/stream?json-api-version=1.0') {
  let options = cloudscraper.defaultParams;
  options.headers['cookie'] = `session_id=${key}`;
  options['resolveWithFullResponse'] = true;
  options['json'] = true;

  let patreon = await cloudscraper.get(uri, options)
  await patreon.body.data.map(async(post) => {
    let attr = post.attributes;
    let rel = post.relationships;
    let cdn = 'https://cdn.kemono.party'
    let fileKey = `files/${rel.user.data.id}/${post.id}`
    let attachmentsKey = `attachments/${rel.user.data.id}/${post.id}`

    let postDb = {
      version: 1,
      title: attr.title,
      content: attr.content,
      id: post.id,
      user: rel.user.data.id,
      post_type: attr.post_type,
      published_at: attr.published_at,
      added_at: new Date().getTime(),
      embed: {},
      post_file: {},
      attachments: []
    };

    await db.loadDatabase();
    let postExists = await db.findOne({id: post.id});
    if (postExists) return;

    if (attr.post_file) {
      let fileData = await request.get({url: attr.post_file.url, encoding: 'binary'})
      await fs.outputFile(`${tmpdir}/kemono/${fileKey}/${attr.post_file.name}`, fileData, 'binary')
      s3.upload({
        Bucket: 'kemono-cdn',
        Body: fs.readFileSync(`${tmpdir}/kemono/${fileKey}/${attr.post_file.name}`),
        CacheControl: 'max-age=2592000, public',
        ContentType: mime.getType(`${tmpdir}/kemono/${fileKey}/${attr.post_file.name}`),
        Key: `${fileKey}/${attr.post_file.name}`,
      }, () => {});
      postDb.post_file['name'] = attr.post_file.name
      postDb.post_file['path'] = `${cdn}/${fileKey}/${attr.post_file.name}`
    }

    if (attr.embed) {
      postDb.embed['subject'] = attr.embed.subject;
      postDb.embed['description'] = attr.embed.description;
      postDb.embed['url'] = attr.embed.url;
    }

    Promise
      .map(rel.attachments.data, async(attachment) => {
        // use content disposition
        let attachmentOptions = options;
        attachmentOptions['encoding'] = 'binary';

        let attachmentData = await cloudscraper.get(`https://www.patreon.com/file?h=${post.id}&i=${attachment.id}`, attachmentOptions);
        let info = cd.parse(attachmentData.headers['content-disposition']);
        await fs.outputFile(`${tmpdir}/kemono/${attachmentsKey}/${info.parameters.filename}`, attachmentData.body, 'binary')
        s3.upload({
          Bucket: 'kemono-cdn',
          Body: fs.readFileSync(`${tmpdir}/kemono/${attachmentsKey}/${info.parameters.filename}`),
          CacheControl: 'max-age=2592000, public',
          ContentType: mime.getType(`${tmpdir}/kemono/${attachmentsKey}/${info.parameters.filename}`),
          Key: `${attachmentsKey}/${info.parameters.filename}`,
        }, () => {});
        postDb.attachments.push({
          id: attachment.id, 
          name: info.parameters.filename,
          path: `${cdn}/${attachmentsKey}/${info.parameters.filename}`
        });
      })
      .then(() => db.insert(postDb))
  })
  
  if (patreon.body.links.next) {
    scraper(key, 'https://' + patreon.body.links.next)
  }
}

module.exports = (key) => scraper(key)