async function searchUpdate() {
  let marthaView = document.getElementById('recent-view');
  marthaView.innerHTML = ''
  const query = document.getElementById('search-input').value;
  const searchData = await fetch(`/api/lookup?q=${encodeURIComponent(query)}`);
  const results = await searchData.json();
  results.map(async(userId) => {
    let userType = 'Patreon'
    const userData = await fetch(`/proxy/user/${userId}`);
    const user = await userData.json();
    marthaView.innerHTML += `
      <div class="recent-row">
        <div class="recent-row-container">
          <a href="/user/${userId}">
          <div class="avatar" style="background-image: url('${user.included[0].attributes.avatar_photo_url}');"></div>
          </a>
          <div style="display: inline-block">
            <a class="link-reset" href="/user/${userId}">
              <p><b>${user.data.attributes.vanity || user.data.attributes.full_name}</b></p>
            </
            <a class="link-reset" href="/user/${userId}">
              <p>${userType}</p>
            </a>
          </div>
        </div>
      </div>
    `
  })

  const gumroadSearchData = await fetch(`/api/gumroad/lookup?q=${encodeURIComponent(query)}`);
  const gumroadResults = await gumroadSearchData.json();
  gumroadResults.map(async(userId) => {
    let userType = 'Gumroad'
    const userData = await fetch(`/proxy/gumroad/user/${userId}`);
    const user = await userData.json();
    marthaView.innerHTML += `
      <div class="recent-row">
        <div class="recent-row-container">
          <a href="/gumroad/user/${userId}">
          <div class="avatar" style="background-image: url('${user.avatar}');"></div>
          </a>
          <div style="display: inline-block">
            <a class="link-reset" href="/gumroad/user/${userId}">
              <p><b>${user.name}</b></p>
            </
            <a class="link-reset" href="/gumroad/user/${userId}">
              <p>${userType}</p>
            </a>
          </div>
        </div>
      </div>
    `
  })

  const fanboxSearchData = await fetch(`/api/fanbox/lookup?q=${encodeURIComponent(query)}`);
  const fanboxResults = await fanboxSearchData.json();
  require(["https://unpkg.com/unraw@1.2.5/dist/index.min.js"], function(unraw) {
    fanboxResults.map(async(userId) => {
      let userType = 'Pixiv Fanbox'
      const userData = await fetch(`/proxy/fanbox/user/${userId}`);
      const user = await userData.json();
      marthaView.innerHTML += `
        <div class="recent-row">
          <div class="recent-row-container">
            <a href="/fanbox/user/${userId}">
            <div class="avatar" style="background-image: url('${unraw.unraw(user.body.user.iconUrl)}');"></div>
            </a>
            <div style="display: inline-block">
              <a class="link-reset" href="/fanbox/user/${userId}">
                <p><b>${unraw.unraw(user.body.user.name)}</b></p>
              </
              <a class="link-reset" href="/fanbox/user/${userId}">
                <p>${userType}</p>
              </a>
            </div>
          </div>
        </div>
      `
    })
  })
}

async function main() {
  let marthaView = document.getElementById('recent-view');
  const recentData = await fetch('/api/recent');
  const recent = await recentData.json();
  recent.map(async(post) => {
    if (post.version == 1 || post.service == 'patreon') {
      let marthaView = document.getElementById('recent-view');
      marthaView.innerHTML += `
        <div class="recent-row">
          <div class="recent-row-container">
            <a href="/user/${post.user}" id="post-${post.id}-avatar"></a>
            <div style="display: inline-block">
              <a class="link-reset" href="/user/${post.user}">
                <p><b>${post.title}</b></p>
              </a>
              <a class="link-reset" href="/user/${user.data.id}" id="post-${post.id}-username"></a>
            </div>
          </div>
        </div>
      `
      fetch(`/proxy/user/${post.user}`)
        .then(data => data.json())
        .then(user => {
          let avatar = document.getElementById(`post-${post.id}-avatar`);
          avatar += `<div class="avatar" style="background-image: url('${user.included[0].attributes.avatar_photo_url}');"></div>`
          let username = document.getElementById(`post-${post.id}-username`);
          username += `<p>${user.data.attributes.vanity || user.data.attributes.full_name}</p>`
        })
    } else if (post.service == 'gumroad') {
      let marthaView = document.getElementById('recent-view');
      marthaView.innerHTML += `
        <div class="recent-row">
          <div class="recent-row-container">
            <a href="/gumroad/user/${post.user}" id="post-${post.id}-avatar"></a>
            <div style="display: inline-block">
              <a class="link-reset" href="/gumroad/user/${post.user}">
                <p><b>${post.title}</b></p>
              </a>
              <a class="link-reset" href="/gumroad/user/${user.data.id}" id="post-${post.id}-username"></a>
            </div>
          </div>
        </div>
      `
      fetch(`/proxy/gumroad/user/${post.user}`)
        .then(data => data.json())
        .then(user => {
          let avatar = document.getElementById(`post-${post.id}-avatar`);
          avatar += `<div class="avatar" style="background-image: url('${user.avatar}');"></div>`
          let username = document.getElementById(`post-${post.id}-username`);
          username += `<p>${user.name}</p>`
        })
    } else if (post.service == 'fanbox') {
      let marthaView = document.getElementById('recent-view');
      marthaView.innerHTML += `
        <div class="recent-row">
          <div class="recent-row-container">
            <a href="/fanbox/user/${post.user}" id="post-${post.id}-avatar"></a>
            <div style="display: inline-block">
              <a class="link-reset" href="/fanbox/user/${post.user}">
                <p><b>${post.title}</b></p>
              </a>
              <a class="link-reset" href="/fanbox/user/${user.data.id}" id="post-${post.id}-username"></a>
            </div>
          </div>
        </div>
      `
      fetch(`/proxy/fanbox/user/${post.user}`)
        .then(data => data.json())
        .then(user => {
          require(["https://unpkg.com/unraw@1.2.5/dist/index.min.js"], unraw => {
            let avatar = document.getElementById(`post-${post.id}-avatar`);
            avatar += `<div class="avatar" style="background-image: url('${unraw.unraw(user.body.user.iconUrl)}');"></div>`
            let username = document.getElementById(`post-${post.id}-username`);
            username += `<p>${unraw.unraw(user.body.user.name)}</p>`
          })
        })
    }
  });
  document.getElementById('search-input').addEventListener('keyup', _.debounce(searchUpdate, 350))
}

main()