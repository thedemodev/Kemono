const Promise = require('bluebird');
const request = require('request-promise');
const cloudscraper = require('cloudscraper');
const retry = require('p-retry');
const getProxies = () => {
  // fork of proxy-list-random
  return new Promise((resolve, reject) => {
    request('http://spys.me/proxy.txt')
      .then(ipport => {
        const regex = /[0-9]+(?:\.[0-9]+){3}:[0-9]+/gm;
        const allIP = [];

        while ((m = regex.exec(ipport)) !== null) {
          if (m.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          m.map(ip => {
            allIP.push(ip);
          });
        }
        resolve(allIP);
      })
      .catch(err => reject(err))
  });
}
module.exports = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    let proxies;
    retry(async(i) => {
      let proxy;
      if (i == 1) {
        proxy = undefined; // try without proxy initially
      } else {
        proxies = proxies || await getProxies();
        proxy = 'http://' + proxies[Math.floor(Math.random() * proxies.length)]
      }
      cloudscraper.get(url, Object.assign(options, { proxy: proxy }))
        .then(res => resolve(res))
        .catch(err => {
          if (err.errorType == 1) throw new Error(); // hit captcha; try again with a new proxy
          reject(err)
        })
    }, {retries: 300}).catch(() => reject())
  })
}