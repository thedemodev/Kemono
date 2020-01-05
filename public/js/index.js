async function main(){const recentData=await fetch(`/api/recent`);const recent=await recentData.json();let userQueue={};recent.map(async(post)=>{if(!userQueue[post.user]){const userData=await fetch(`/proxy/user/${post.user }`);const user=await userData.json();userQueue[post.user]=user}let marthaView=document.getElementById('recent-view');marthaView.innerHTML+=`
      <div class="recent-row">
        <div class="recent-row-container">
          <a href="/user/${userQueue[post.user].data.id }">
            <img class="avatar" src="${userQueue[post.user].data.attributes.image_url }"></img>
          </a>
          <div style="display: inline-block">
            <a class="link-reset" href="/user/${userQueue[post.user].data.id }">
              <p><b>${post.title }</b></p>
            </a>
            <a class="link-reset" href="/user/${userQueue[post.user].data.id }">
              <p>${userQueue[post.user].data.attributes.vanity }</p>
            </a>
          </div>
        </div>
      </div>
    `})}main();