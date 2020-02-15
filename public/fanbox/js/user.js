async function loadMorePosts(skip) {
  document.getElementById("load-more-button").outerHTML = "";
  let pathname = window.location.pathname.split('/')
  let marthaView = document.getElementById('martha-view');
  const userPostsData = await fetch(`/api/fanbox/user/${pathname[3]}?skip=${skip}`);
  const userPosts = await userPostsData.json();
  await userPosts.map(async(post) => {
    let image = ''
    let imageDl = ''
    let attachmentDl = ''
    let embed = ''
    post.attachments.map(attachment => {
      attachmentDl += `
        <a 
          class="user-post-attachment-link" 
          href="${attachment.path}" 
          target="_blank"
        >
          <p>Download ${attachment.name}</p>
        </a>
      `
    })

    if (post.post_type == 'image') {
      image = `<img class="user-post-image" src="${post.post_file.path}">`
      imageDl = `
        <a 
          class="user-post-attachment-link" 
          href="${post.post_file.path}" 
          target="_blank"
        >
          <p>Download ${post.post_file.name}</p>
        </a>
      `
    }

    // embeds are not supported
    // if (Object.keys(post.embed).length != 0) embed = `
    //   <a href="${post.embed.url}" target="_blank">
    //     <div class="embed-view">
    //       <h3>${post.embed.subject}</h3>
    //       <p>${post.embed.description || ''}</p>
    //     </div>
    //   </a>
    // `

    marthaView.innerHTML += `
      <div class="user-post-view" id=${post.id}>
        ${image}
        ${embed}
        <h2>${post.title}</h2>
        ${post.content}
        ${imageDl}
        ${attachmentDl}
        <p style="color: #757575;">${post.published_at}</p>
      </div>
    `
  })
  marthaView.innerHTML += `
    <button onClick="loadMorePosts(${skip + 26})" id="load-more-button" class="load-more-button">Load More</a>
  `
}

async function main() {
  let pathname = window.location.pathname.split('/')
  const userData = await fetch(`/proxy/fanbox/user/${pathname[3]}`);
  const user = await userData.json();
  require(["https://unpkg.com/unraw@1.2.5/dist/index.min.js"], function(unraw) {
    document.title = `${unraw.unraw(user.body.creator.user.name)} | kemono`
    let marthaView = document.getElementById('martha-view');
    marthaView.innerHTML += `
      <div 
        class="user-header-view" 
        style="background: url('${unraw.unraw(user.body.creator.coverImageUrl)}'); background-size: 100% auto; background-position: center;"
      >
        <div class="user-header-avatar" style="background-image: url('${unraw.unraw(user.body.creator.user.iconUrl)}');"></div>
        <div class="user-header-info">
          <div class="user-header-info-top">
            <h1>${unraw.unraw(user.body.creator.user.name)}</h1>
            <a href="https://www.pixiv.net/fanbox/creator/${user.body.creator.user.userId}" target="_blank" rel="noreferrer">
              <div class="user-header-info-fanbox"></div>
            </a>
          </div>
        </div>
      </div>
    `
    marthaView.innerHTML += `
      <button onClick="loadMorePosts(26)" id="load-more-button" class="load-more-button">Load More</a>
    `
    loadMorePosts(0)
  });
}
main()