var $={};
document.documentElement.classList?($.hasClass=function(e,t){return e.classList.contains(t)},$.addClass=function(e,t){e.classList.add(t)},$.removeClass=function(e,t){e.classList.remove(t)}):($.hasClass=function(e,t){return-1!=(" "+e.className+" ").indexOf(" "+t+" ")}),$.docEl=document.documentElement;

var ImageExpansion={};
ImageExpansion.expand=function(e){
return e.setAttribute("data-expanding","1"),t=document.createElement("img"),t.setAttribute("src",e.parentNode.getAttribute("href")),t.className="expanded-thumb",t.style.display="none",e.parentNode.insertBefore(t,e.nextElementSibling),e.style.opacity="0.75",setTimeout(ImageExpansion.checkLoadStart,15,t,e),!0
}

ImageExpansion.contract=function(e){
t=(a=e.parentNode).parentNode.parentNode
$.removeClass(a.parentNode,"image-expanded")
a.firstChild.style.display=""
a.removeChild(e)
a.offsetTop<window.pageYOffset&&a.scrollIntoView({top:0,behavior:"smooth"})
}

ImageExpansion.toggle=function(e){
if(e.hasAttribute("data-src")){return ImageExpansion.expand(e)}else ImageExpansion.contract(e);
return!0
}

ImageExpansion.checkLoadStart=function(e,t)
{if(!e.naturalWidth)return setTimeout(ImageExpansion.checkLoadStart,15,e,t);ImageExpansion.onLoadStart(e,t),t.style.opacity=""}

ImageExpansion.onLoadStart=function(e,t){
t.removeAttribute("data-expanding")
d=t.parentNode.parentNode
$.addClass(d,"image-expanded")
e.style.maxWidth="100%"
e.style.display=""
t.style.display="none"
};

var Main={};
Main.init=function()
{document.addEventListener("DOMContentLoaded",Main.run,!1)}

Main.run=function()
{document.addEventListener("click",Main.onclick,!1)}

Main.onclick=function(e)
{if((t=e.target)!=document){if($.hasClass(t.parentNode,"fileThumb"))return void(ImageExpansion.toggle(t)&&e.preventDefault());}}

Main.init();