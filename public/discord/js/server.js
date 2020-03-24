let msgs = [];
let currentSkip = 0;
const showMessages = async(channel) => {
  const messages = document.getElementById('messages');
  messages.innerHTML = `<div class="message"><button onClick="load(${currentSkip}, ${channel})" id="load-more-button" class="load-more-button">Load More</a></div>`;
  msgs.map(msg => {
    if (msg.channel.id != channel) return;
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
    messages.innerHTML += `
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
    `
  })
}

const load = async(skip = 0, tochannel) => {
  const pathname = window.location.pathname.split('/');
  const serverData = await fetch(`/api/discord/server/${pathname[3]}?skip=${skip}`);
  const server = await serverData.json();
  msgs = server.concat(msgs).sort((a, b) => (a.published_at > b.published_at) ? 1 : -1);
  const channels = document.getElementById('channels');
  server.map(msg => {
    let channel = document.getElementById(`channel-${msg.channel.id}`);
    if (!channel) {
      channels.innerHTML += `
        <div class="channel" id="channel-${msg.channel.id}" onClick="showMessages(${msg.channel.id})">
          <p>#${msg.channel.name}</p>
        </div>
      `;
    }
  });
  currentSkip = skip + 250;
  if (tochannel) {
    // refresh
    showMessages(tochannel);
  }
}

load();