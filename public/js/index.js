async function searchUpdate(){let marthaView=document.getElementById('recent-view');marthaView.innerHTML='';const query=document.getElementById('search-input').value;const searchData=await fetch(`/api/lookup?q=${encodeURIComponent(query)}`);const results=await searchData.json();results.map(async(userId)=>{let userType='patreon';const userData=await fetch(`/proxy/user/${ userId }`);const user=await userData.json();marthaView.innerHTML+=`
      <div class="recent-row">
        <div class="recent-row-container">
          <a href="/user/${ userId }">
            <img class="avatar" src="${user.data.attributes.image_url }"></img>
          </a>
          <div style="display: inline-block">
            <a class="link-reset" href="/user/${ userId }">
              <p><b>${user.data.attributes.vanity||user.data.attributes.full_name }</b></p>
            </
            <a class="link-reset" href="/user/${ userId }">
              <p>${ userType }</p>
            </a>
          </div>
        </div>
      </div>
    `})}async function main(){const recentData=await fetch('/api/recent');const recent=await recentData.json();let userQueue={};recent.map(async(post)=>{if(!userQueue[post.user]){const userData=await fetch(`/proxy/user/${post.user }`);const user=await userData.json();userQueue[post.user]=user}let marthaView=document.getElementById('recent-view');marthaView.innerHTML+=`
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
              <p>${userQueue[post.user].data.attributes.vanity||userQueue[post.user].data.attributes.full_name }</p>
            </a>
          </div>
        </div>
      </div>
    `});document.getElementById('search-input').addEventListener('keyup',_.debounce(searchUpdate,350))}main();