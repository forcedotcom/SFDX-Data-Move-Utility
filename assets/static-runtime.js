(function ($, hljs) {
  if (!$) {
    return;
  }

  $(document).ready(function () {
    if ($('.content').length) {
      if (hljs && typeof hljs.initHighlightingOnLoad === 'function') {
        hljs.initHighlightingOnLoad();
      }

      $('.content table').addClass('table');

      if (typeof fitvids === 'function') {
        fitvids('.content');
      }
    }

    if ($('.home-categories').length && typeof $.fn.masonry === 'function') {
      $('.home-categories').masonry({
        columnWidth: '.col',
        itemSelector: '.col',
        transitionDuration: 0,
      });
    }
  });
}(window.jQuery, window.hljs));
