let currentChannel;
const loadMessages = async(channelId, skip = 0) => {
  const messages = document.getElementById('messages');
  const loadButton = document.getElementById('load-more-button');
  if (loadButton){
    loadButton.outerHTML = '';
  }
  if (currentChannel != channelId) messages.innerHTML = '';
  currentChannel = channelId;
  const channelData = await fetch(`/api/discord/channel/${channelId}?skip=${skip}`);
  const channel = await channelData.json();
  channel.map(msg => {
    let dls = '';
    let avatarurl = '';
    let embeds = ''
    msg.attachments.map(dl => {
      let path = dl.path.replace('https://kemono.party', 'http://localhost:5000') // debug
      if (dl.isImage) {
        dls += `<a href="${path}" target="_blank"><img class="user-post-image" style="max-width:300px"src="${path}"></a><br>`
      } else {
        dls += `<a href="${path}">Download ${dl.name}</a><br>`
      }
    })
    msg.embeds.map(embed => {
      embeds += `
        <a href="${embed.url}" target="_blank">
          <div class="embed-view" style="max-width:300px">
            <p>${embed.description}</p>
          </div>
        </a>
      `
    });
    if (msg.author.avatar) {
      avatarurl = `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}`
    } else {
      avatarurl = 'https://discordapp.com/assets/1cbd08c76f8af6dddce02c5138971129.png';
    }
    messages.innerHTML = `
      <div class="message">
        <div class="avatar" style="background-image:url('${avatarurl}')"></div>
        <div style="display:inline-block">
          <div class="message-header">
            <b><p>${msg.author.username}</p></b>
            <p style="color:#757575">${msg.published_at}</p>
          </div>
          <p>${msg.content}</p>
          ${dls}
          ${embeds}
        </div>
      </div>
    ` + messages.innerHTML
  })
  messages.innerHTML = `
    <div class="message" id="load-more-button">
      <button onClick="loadMessages('${channelId}', ${skip + 50})" class="load-more-button">
        Load More
      </button>
    </div>
  ` + messages.innerHTML
}

const load = async() => {
  const pathname = window.location.pathname.split('/');
  const serverData = await fetch(`/api/discord/channels/lookup?q=${pathname[3]}`);
  const server = await serverData.json();
  const channels = document.getElementById('channels');
  server.map(ch => {
    let channel = document.getElementById(`channel-${ch.id}`);
    if (!channel) {
      channels.innerHTML += `
        <div class="channel" id="channel-${ch.id}" onClick="loadMessages('${ch.id}')">
          <p>#${ch.name}</p>
        </div>
      `;
    }
  });
}

load();