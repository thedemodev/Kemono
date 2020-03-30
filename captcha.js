const request = require('request-promise');
const retry = require('retry');
module.exports = () => {
  return (options, response, body) => {
    const captcha = response.captcha;
    request
      .get(
        'https://azcaptcha.com/in.php?key=' + process.env.AZCAPTCHA_KEY +
        '&method=userrecaptcha' +
        '&googlekey=' + encodeURIComponent(captcha.siteKey) +
        '&pageurl=' + encodeURIComponent(captcha.uri.href) +
        '&json=1'
      )
      .then(res => {
        let json = JSON.parse(res)
        let operation = retry.operation({
          retries: 5,
          factor: 1,
          minTimeout: 10000
        });
        operation.attempt(async() => {
          let token = await request.get(
            'http://azcaptcha.com/res.php?key=' + process.env.AZCAPTCHA_KEY +
            '&action=get' +
            '&id=' + json.request
          );
          if (token == 'CAPTCHA_NOT_READY') return;
          captcha.form['g-recaptcha-response'] = token;
          captcha.form['h-recaptcha-response'] = token;
          captcha.submit();
        })
      })
      .catch(err => captcha.submit(err))
  }
}