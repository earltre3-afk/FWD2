const urls = [
  "com.treytv.fwd://auth/callback",
  "com.treytv.fwd://auth/callback?code=test",
  "https://fwd.treytv.com/auth/callback?code=test",
  "https://fwd.treytv.com/gif/test",
  "com.treytv.fwd://auth/callback#access_token=abc",
  "com.treytv.fwd://auth/trey-tv/callback?code=xyz"
];

for (const url of urls) {
  let path = '/';
  if (url.startsWith('https://fwd.treytv.com')) {
    const urlObj = new URL(url);
    path = urlObj.pathname + urlObj.search + urlObj.hash;
  } else if (url.startsWith('com.treytv.fwd://')) {
    const stripped = url.replace('com.treytv.fwd://', '');
    path = stripped.startsWith('/') ? stripped : '/' + stripped;
  } else {
    try {
      const urlObj = new URL(url);
      path = urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      path = url.split('://')[1] ? '/' + url.split('://')[1] : '/';
    }
  }
  
  console.log(`URL: ${url} -> Path: ${path}`);
}
