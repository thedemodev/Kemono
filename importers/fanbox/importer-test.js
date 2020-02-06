const Datastore = require('nedb-promise');
const db = new Datastore({filename: 'test.db'});
const fs = require('fs-extra');
const request = require('request-promise');
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
    encoding: 'binary',
    headers: { 
      'cookie': `PHPSESSID=${key}`,
      'origin': 'https://www.pixiv.net',
    }
  }
};

async function scraper(key) {
  console.log('Warning: Testing script does not have limits. Press CTRL-C to stop it.')
  let fanboxIndex = await request.get('https://www.pixiv.net/ajax/fanbox/index', requestOptions(key));
  Promise.map(fanboxIndex.body.supportingPlans, async(artist) => {
    processFanbox(`https://www.pixiv.net/ajax/fanbox/creator?userId=${artist.user.userId}`, key)
  }, { concurrency: 1 });
}

async function processFanbox(url, key) {
  let data = await request.get(url, requestOptions(key));
  let postData = {};
  if (data.message == "") {
    postItems = data.body.post; // initial page
  } else {
    postItems = data.body; // nextUrl
  }

  Promise.map(postData.items, async(post) => {
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

    let postExists = await db.findOne({id: post.id, service: 'fanbox'});
    if (postExists) return;

    let filesLocation = 'https://kemono.party/fanbox/files'
    let attachmentsLocation = 'https://kemono.party/fanbox/attachments'
    if (post.body.images) {
      await Promise.map(post.body.images, async(image, index) => {
        let fileData = await request.get(unraw(image.originalUrl), fileRequestOptions(key));
        if (index == 0 && !postModel.post_file['name']) {
          fs.outputFile(`${__dirname}/downloads/files/${post.user.userId}/${post.id}/${image.id}.${image.extension}`, fileData, 'binary');
          postModel.post_file['name'] = `${image.id}.${image.extension}`
          postModel.post_file['path'] = `${filesLocation}/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
        } else {
          fs.outputFile(`${__dirname}/downloads/attachments/${post.user.userId}/${post.id}/${image.id}.${image.extension}`, fileData, 'binary');
          postModel.attachments.push({
            id: image.id,
            name: `${image.id}.${image.extension}`,
            path: `${attachmentsLocation}/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
          });
        }
      })
    }
    
    if (post.body.files) {
      await Promise.map(post.body.files, async(file, index) => {
        let fileData = await request.get(unraw(file.url), fileRequestOptions(key));
        if (index == 0 && !postModel.post_file['name']) {
          fs.outputFile(`${__dirname}/downloads/files/${post.user.userId}/${post.id}/${file.name}.${file.extension}`, fileData, 'binary');
          postModel.post_file['name'] = `${file.name}.${file.extension}`
          postModel.post_file['path'] = `${filesLocation}/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
        } else {
          fs.outputFile(`${__dirname}/downloads/attachments/${post.user.userId}/${post.id}/${file.name}.${file.extension}`, fileData, 'binary');
          postModel.attachments.push({
            id: file.id,
            name: `${file.name}.${file.extension}`,
            path: `${attachmentsLocation}/${post.user.userId}/${post.id}/${file.name}.${file.extension}`
          });
        }
      })
    }

    db.insert(postModel)
  }, { concurrency: 1 });

  if (postData.nextUrl) {
    processFanbox(postData.nextUrl, key)
  }
}

async function concatenateArticle(body, key) {
  let concatenatedString = '<p>';
  await Promise.map(body.blocks, async(block) => {
    if (block.type == 'image') {
      let imageInfo = body.imageMap[block.imageId];
      let fileData = await request.get(unraw(imageInfo.originalUrl), fileRequestOptions(key))
      fs.outputFile(`${__dirname}/downloads/inline/${imageInfo.id}.${imageInfo.extension}`, fileData, 'binary')
      concatenatedString += `<img src="https://kemono.party/fanbox/inline/${imageInfo.id}.${imageInfo.extension}"><br>`
    } else if (block.type == 'p') {
      concatenatedString += `${unraw(block.text)}<br>`
    }
  })
  concatenatedString += '</p>'
  return concatenatedString
}

db.loadDatabase();
scraper(process.argv[2])