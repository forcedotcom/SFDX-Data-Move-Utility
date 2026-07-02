$.expr[":"].icontains = function (a, i, m) {
  return $(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
};

$(function () {
  $("#sidebarmenu li").each(function (e) {
    if ($(this).hasClass("active")) {
      $(this).closest("li").find("a").click();
    }
  });
  $(document).on("shown.bs.collapse", "#sidebarmenu", function (e) {
    $(e.target)
      .find(">a i")
      .removeClass("fa-folder")
      .addClass("fa-folder-open");
  });
  $(document).on("hidden.bs.collapse", "#sidebarmenu", function (e) {
    $(e.target)
      .find(">a i")
      .removeClass("fa-folder-open")
      .addClass("fa-folder");
  });
  $(document).find("code").addClass("hljs");

  $(window).on('resize', setHeight);

  setHeight();
  $(`[href="#top-anchor"]`).click(() => scrollTo(0))
});

const setHeight = () => {
  const  height = `${window.innerHeight - document.querySelector('.page-widgets').offsetTop - document.querySelector('.page-widgets').offsetHeight}px`;
  document.querySelector('.page-content').style.height = height;
  document.querySelector('.side-menu').style.height = height;
};

const scrollTo = (top) => {
  document.querySelector('.page-content').scrollTo({ top, behavior: "smooth" });
};


(function () {
  let _oldSearch;
  let _offsets = [];
  let _index = -1;

  const clear = () => {
    _oldSearch = "";
    _offsets = [];
    _index = -1;
  };

  const debounce = (func, timeout = 200) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, timeout);
    };
  };

  const whatPressed = (event) => {
    switch (event.key) {
      case "ArrowUp":
        return "Up";

      case "ArrowDown":
      case "Enter":
        return "Down";

      default:
        return "Letter";
    }
  };

  const search = (event, value, selector, offset) => {
    if (whatPressed(event) !== "Letter") {
      return;
    }

    if (!value) {
      $(".search-button.nav-button").prop("disabled", true);
      window.quickSearch_OnSearch(value, selector);
      return;
    }

    $(".search-button.nav-button").prop("disabled", false);

    if (_oldSearch !== value) {
      $(selector).unhighlight();
      $(selector).highlight(value);
      _oldSearch = value;
      _index = -1;
      let prev = -1;
      _offsets = $(`${selector} .highlight`)
        .map((i, element) => {
          const top = $(element).offset().top - offset - 5;
          if (prev < 0 || top - prev > 10) {
            prev = top;
            return top;
          }
          return null;
        })
        .filter((x) => x != null);
    }

    window.quickSearchNext();
  };

  window.quickSearch_OnKeyDown = (event) => {
    const pressed = whatPressed(event);
    switch (pressed) {
      case "Down":
        window.quickSearchNext();
        break;
      case "Up":
        window.quickSearchPrev();
        break;
    }
  };

  window.quickSearchTop_OnMoveTop = () => {
    _index = -1;
    scrollTo(0);
  };

  window.quickSearch_OnSearch = (value, selector) => {
    if (!value) {
      clear();
      scrollTo(0);
      $(selector).unhighlight();
      $(".search-button.nav-button").prop("disabled", true);
    }
  };

  window.quickSearchNext = () => {
    _offsets[_index + 1] >= 0
      ? scrollTo(_offsets[++_index])
      : _offsets[_index] >= 0 && scrollTo(_offsets[_index]);
  };

  window.quickSearchPrev = () => {
    _offsets[_index - 1] >= 0
      ? scrollTo(_offsets[--_index])
      : _offsets[_index] >= 0 && scrollTo(_offsets[_index]);
  };

  window.quickSearch_OnKeyUp = debounce((event, value, selector, offset) =>
    search(event, value, selector, offset)
  );
})();
