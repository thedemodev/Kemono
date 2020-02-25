const { posts } = require('../../db');
const { workerData, parentPort } = require('worker_threads');
const indexer = require('../../indexer');
const fs = require('fs-extra');
const request = require('request-promise');
const request2 = require('request')
  .defaults({ encoding: null })
const { unraw } = require('unraw');
const nl2br = require('nl2br');
const Promise = require('bluebird');
let requestOptions = (key) => {
  return {
    json: true,
    headers: { 
      'cookie': `PHPSESSID=${key}`,
      'origin': 'https://www.pixiv.net'
    }
  }
};

let fileRequestOptions = (key) => {
  return {
    encoding: null,
    headers: { 
      'cookie': `PHPSESSID=${key}`,
      'origin': 'https://www.pixiv.net',
    }
  }
};

async function scraper(key) {
  parentPort.postMessage('fanbox scraper fired!');
  let fanboxIndex = await request.get('https://www.pixiv.net/ajax/fanbox/index', requestOptions(key));
  Promise.mapSeries(fanboxIndex.body.supportingPlans, async(artist) => {
    processFanbox(`https://www.pixiv.net/ajax/fanbox/creator?userId=${artist.user.userId}`, key)
  });
}

async function processFanbox(url, key) {
  let data = await request.get(unraw(url), requestOptions(key));
  let postData = {};
  if (data.message == "") {
    postData = data.body.post; // initial page
    data = null;
  } else {
    postData = data.body; // nextUrl
    data = null;
  }
  Promise.mapSeries(postData.items, async(post) => {
    parentPort.postMessage(post);
    if (!post.body) return // locked content; nothing to do
    let postModel = {
      version: 2,
      service: 'fanbox',
      title: unraw(post.title),
      content: nl2br(unraw(post.body.text || concatenateArticle(post.body, key))),
      id: post.id,
      user: post.user.userId,
      post_type: post.type, // image, article, embed (undocumented) or file
      published_at: post.publishedDatetime,
      added_at: new Date().getTime(),
      embed: {},
      post_file: {},
      attachments: []
    };

    let postExists = await posts.findOne({id: post.id, service: 'fanbox'});
    if (postExists) return;

    let filesLocation = 'https://kemono.party/files/fanbox'
    let attachmentsLocation = 'https://kemono.party/attachments/fanbox'
    if (post.body.images) {
      await Promise.mapSeries(post.body.images, async(image, index) => {
        if (index == 0 && !postModel.post_file['name']) {
          request2.get(unraw(image.originalUrl), fileRequestOptions(key))
            .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${image.id}.${image.extension}`, {
              highWaterMark: 64 * 1024
            }))
          postModel.post_file['name'] = `${image.id}.${image.extension}`
          postModel.post_file['path'] = `${filesLocation}/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
        } else {
          request2.get(unraw(image.originalUrl), fileRequestOptions(key))
            .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${image.id}.${image.extension}`))
          postModel.attachments.push({
            id: image.id,
            name: `${image.id}.${image.extension}`,
            path: `${attachmentsLocation}/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
          });
        }
      })
    }
    
    if (post.body.files) {
      await Promise.mapSeries(post.body.files, async(file, index) => {
        if (index == 0 && !postModel.post_file['name']) {
          request2.get(unraw(file.url), fileRequestOptions(key))
            .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${file.name}.${file.extension}`))
          postModel.post_file['name'] = `${file.name}.${file.extension}`
          postModel.post_file['path'] = `${filesLocation}/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
        } else {
          request2.get(unraw(file.url), fileRequestOptions(key))
            .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${file.name}.${file.extension}`))
          postModel.attachments.push({
            id: file.id,
            name: `${file.name}.${file.extension}`,
            path: `${attachmentsLocation}/${post.user.userId}/${post.id}/${file.name}.${file.extension}`
          });
        }
      })
    }

    await posts.insertOne(postModel)
  })

  if (postData.nextUrl) {
    processFanbox(postData.nextUrl, key)
  } else {
    indexer();
  }
}

async function concatenateArticle(body, key) {
  let concatenatedString = '<p>';
  await Promise.mapSeries(body.blocks, async(block) => {
    if (block.type == 'image') {
      let imageInfo = body.imageMap[block.imageId];
      request2.get(unraw(imageInfo.originalUrl), fileRequestOptions(key))
        .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/inline/fanbox/${imageInfo.id}.${imageInfo.extension}`))
      concatenatedString += `<img src="https://kemono.party/inline/fanbox/${imageInfo.id}.${imageInfo.extension}"><br>`
    } else if (block.type == 'p') {
      concatenatedString += `${unraw(block.text)}<br>`
    }
  })
  concatenatedString += '</p>'
  return concatenatedString
}

scraper(workerData)