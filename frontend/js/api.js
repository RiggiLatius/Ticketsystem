(function (global) {
  const API = {};

  async function request(method, path, body, opts) {
    const options = {
      method,
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    };
    if (body !== undefined) {
      if (body instanceof FormData) {
        options.body = body;
      } else {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
    }
    const res = await fetch(path, options);
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (data && data.fehler) || `Fehler ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      if (res.status === 401 && !opts?.suppressAuthRedirect) {
        API.onUnauthorized && API.onUnauthorized();
      }
      throw err;
    }
    return data;
  }

  API.get = (path, opts) => request('GET', path, undefined, opts);
  API.post = (path, body, opts) => request('POST', path, body, opts);
  API.patch = (path, body, opts) => request('PATCH', path, body, opts);
  API.del = (path, opts) => request('DELETE', path, undefined, opts);

  API.onUnauthorized = null;

  global.API = API;
})(window);
