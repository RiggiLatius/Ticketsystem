(function (global) {
  const Router = {
    routes: [],
    onNavigate: null,
  };

  Router.add = function (pattern, handler) {
    Router.routes.push({ pattern, handler });
  };

  Router.parse = function () {
    const hash = location.hash.replace(/^#/, '') || '/dashboard';
    for (const r of Router.routes) {
      if (typeof r.pattern === 'string') {
        if (r.pattern === hash) return { handler: r.handler, params: {} };
      } else if (r.pattern instanceof RegExp) {
        const m = hash.match(r.pattern);
        if (m) return { handler: r.handler, params: m.groups || m.slice(1) };
      }
    }
    return null;
  };

  Router.start = function () {
    window.addEventListener('hashchange', () => {
      const match = Router.parse();
      if (match) match.handler(match.params);
      Router.onNavigate && Router.onNavigate();
    });
    const match = Router.parse();
    if (match) match.handler(match.params);
  };

  Router.navigate = function (path) {
    location.hash = '#' + path;
  };

  global.Router = Router;
})(window);
