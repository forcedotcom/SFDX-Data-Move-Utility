(function () {
  const root = document.documentElement.dataset.siteRoot || '';
  const forms = Array.from(document.querySelectorAll('.search-form'));
  let indexPromise;

  if (forms.length === 0) {
    return;
  }

  forms.forEach(form => {
    const input = form.querySelector('input[type="search"]');
    if (!input) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'static-search-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const results = document.createElement('div');
    results.className = 'static-search-results';
    results.hidden = true;
    wrapper.appendChild(results);

    form.addEventListener('submit', event => {
      event.preventDefault();
      void searchAsync(input, results);
    });

    input.addEventListener('input', () => {
      window.clearTimeout(input.dataset.staticSearchTimer);
      input.dataset.staticSearchTimer = window.setTimeout(() => {
        void searchAsync(input, results);
      }, 160);
    });
  });

  document.addEventListener('click', event => {
    document.querySelectorAll('.static-search-results').forEach(results => {
      if (!results.contains(event.target) && !results.previousElementSibling?.contains(event.target)) {
        results.hidden = true;
      }
    });
  });

  async function searchAsync(input, results) {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }

    const index = await loadIndexAsync();
    const tokens = query.split(/\s+/).filter(Boolean);
    const matches = index
      .filter(item => tokens.every(token => item.searchText.includes(token)))
      .slice(0, 12);

    renderResults(results, matches);
  }

  async function loadIndexAsync() {
    if (!indexPromise) {
      indexPromise = fetch(root + 'search-index.json')
        .then(response => response.json())
        .then(items => items.map(item => ({
          ...item,
          searchText: [item.title, item.description, item.path, item.text]
            .join(' ')
            .toLowerCase(),
        })));
    }

    return indexPromise;
  }

  function renderResults(results, matches) {
    results.hidden = false;

    if (matches.length === 0) {
      results.innerHTML = '<div class="static-search-result"><strong>No results</strong><span>Try another query.</span></div>';
      return;
    }

    results.innerHTML = matches.map(item => {
      const href = root + item.url.replace(/^\//, '').replace(/\/?$/, '/');
      const description = item.description || item.path;
      return '<a class="static-search-result" href="' + escapeHtml(href) + '">' +
        '<strong>' + escapeHtml(item.title) + '</strong>' +
        '<span>' + escapeHtml(description) + '</span>' +
        '</a>';
    }).join('');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}());
