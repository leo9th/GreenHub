(function() {
  function shareFunction() {
    if (navigator.share) {
      navigator.share({
        title: document.title,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('Link copied!'))
        .catch(console.error);
    }
  }

  // Safe event listener attachment
  const shareButton = document.getElementById('shareButton');
  if (shareButton) {
    shareButton.addEventListener('click', shareFunction);
  }
})();
