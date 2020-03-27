function lazyload() {
  var lazyloadImages;    

  lazyloadImages = document.querySelectorAll(".user-post-image");
  var imageObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var image = entry.target;
        image.src = image.dataset.src;
        imageObserver.unobserve(image);
      }
    });
  });

  lazyloadImages.forEach(function(image) {
    /*image.style.height = "200px"
    image.style.width = "auto"*/
    imageObserver.observe(image);
  });
})
