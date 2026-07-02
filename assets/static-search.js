(function () {
  const root = document.documentElement.dataset.siteRoot || '';
  const forms = Array.from(document.querySelectorAll('.search-form'));
  const searchQuery = sanitizeQuery(new URLSearchParams(window.location.search).get('search') || '');

  forms.forEach(form => {
    const input = form.querySelector('input[type="search"]');

    if (!input) {
      return;
    }

    if (searchQuery) {
      input.value = searchQuery;
    }

    form.addEventListener('submit', event => {
      if (!input.value.trim()) {
        event.preventDefault();
      }
    });
  });

  if (searchQuery) {
    void renderSearchPageAsync(searchQuery);
  }

  async function renderSearchPageAsync(query) {
    const template = document.getElementById('static-search-page-template');
    const main = getMainContainer();

    if (!template || !main) {
      window.location.href = root + '?search=' + encodeURIComponent(query);
      return;
    }

    document.body.className = 'page-search';
    main.innerHTML = template.innerHTML;
    const queryElement = document.getElementById('static-search-query');

    if (queryElement) {
      queryElement.textContent = query;
    }

    const placeholder = document.getElementById('static-search-results-placeholder');

    if (!placeholder) {
      return;
    }

    placeholder.outerHTML = '<p>Searching...</p>';

    try {
      const searchData = await loadSearchDataAsync();
      const results = runRanetoSearch(searchData, query);
      const resultsHost = document.querySelector('.content.search');

      if (resultsHost) {
        const title = resultsHost.querySelector('.title');
        resultsHost.innerHTML = '';

        if (title) {
          resultsHost.appendChild(title);
        }

        resultsHost.insertAdjacentHTML('beforeend', renderResults(results, query));
      }
    } catch (error) {
      const resultsHost = document.querySelector('.content.search');

      if (resultsHost) {
        resultsHost.insertAdjacentHTML(
          'beforeend',
          '<p class="static-search-failed">Search index could not be loaded.</p>',
        );
      }
    }
  }

  async function loadSearchDataAsync() {
    const response = await fetch(root + 'search-index.json');

    if (!response.ok) {
      throw new Error('Cannot load search-index.json');
    }

    return await response.json();
  }

  function runRanetoSearch(searchData, query) {
    const cleanQuery = query
      .replace(/[~*+\-^:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanQuery) {
      return [];
    }

    const pagesById = new Map(searchData.pages.map(page => [page.id, page]));
    const index = window.lunr && searchData.index
      ? window.lunr.Index.load(searchData.index)
      : null;
    let matches = [];

    if (index) {
      matches = trySearch(index, cleanQuery);

      if (matches.length === 0 && cleanQuery.includes(' ')) {
        matches = trySearch(index, cleanQuery.split(/\s+/).join(' OR '));
      }

      if (matches.length === 0 && cleanQuery.length > 2) {
        matches = trySearch(index, cleanQuery + '~1');
      }

      if (matches.length === 0) {
        matches = trySearch(index, cleanQuery + '*');
      }

      if (matches.length === 0) {
        const fuzzyQuery = cleanQuery
          .split(/\s+/)
          .filter(word => word.length > 2)
          .map(word => word + '~1')
          .join(' OR ');

        if (fuzzyQuery) {
          matches = trySearch(index, fuzzyQuery);
        }
      }
    }

    if (matches.length > 0) {
      return matches
        .map(match => pagesById.get(match.ref))
        .filter(Boolean);
    }

    return runSubstringFallback(searchData.pages, cleanQuery);
  }

  function trySearch(index, query) {
    try {
      return index.search(query);
    } catch (_error) {
      return [];
    }
  }

  function runSubstringFallback(pages, cleanQuery) {
    const tokens = cleanQuery.toLowerCase().split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      return [];
    }

    return pages
      .map(page => {
        const searchText = page.searchText || '';

        if (!tokens.every(token => searchText.includes(token))) {
          return null;
        }

        const titleText = String(page.title || '').toLowerCase();
        const titleScore = tokens.reduce(
          (score, token) => score + (titleText.includes(token) ? 10 : 0),
          0,
        );

        return { page, score: titleScore + tokens.length };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score)
      .map(result => result.page);
  }

  function renderResults(results, query) {
    if (results.length === 0) {
      return '<p class="nothing-found">Nothing found for "' + escapeHtml(query) + '"</p>';
    }

    return results.map(page => {
      const href = root + page.slug.replace(/^\//, '').replace(/\/?$/, '/');
      const category = page.category
        ? '<span style="color: #DDD;">(' + escapeHtml(page.category) + ')</span>'
        : '';
      return '<div class="page">' +
        '<h2 class="page-title">' +
        '<a href="' + escapeHtml(href) + '">' +
        escapeHtml(page.title) +
        category +
        '</a>' +
        '</h2>' +
        '<div class="page-excerpt">' + highlightExcerpt(page.excerpt || page.text || '', query) + '</div>' +
        '</div>';
    }).join('');
  }

  function highlightExcerpt(excerpt, query) {
    const escapedExcerpt = escapeHtml(excerpt);
    const escapedQuery = escapeRegExp(query.trim());

    if (!escapedQuery) {
      return escapedExcerpt;
    }

    return escapedExcerpt.replace(
      new RegExp('(' + escapedQuery + ')', 'gim'),
      '<span class="search-query">$1</span>',
    );
  }

  function sanitizeQuery(query) {
    return String(query)
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getMainContainer() {
    return Array.from(document.body.children)
      .find(element => element.classList && element.classList.contains('container-fluid'));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
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
