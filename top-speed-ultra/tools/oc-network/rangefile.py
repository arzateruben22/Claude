import io, os, requests
S = requests.Session()
# behind a TLS-inspecting proxy, point REQUESTS_CA_BUNDLE at its CA bundle
S.verify = os.environ.get('REQUESTS_CA_BUNDLE') or True
class RangeFile(io.RawIOBase):
    def __init__(self, url, size=None):
        self.url, self.pos = url, 0
        if size is None:
            r = S.head(url, timeout=60); r.raise_for_status(); size = int(r.headers['Content-Length'])
        self.size = size; self.cache = {}
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else (self.pos + off if whence == 1 else self.size + off)
        return self.pos
    def read(self, n=-1):
        if n is None or n < 0: n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n <= 0: return b''
        for i in range(5):
            try:
                r = S.get(self.url, headers={'Range': f'bytes={self.pos}-{self.pos+n-1}'}, timeout=120)
                r.raise_for_status(); b = r.content
                if len(b) == n: break
            except Exception as e:
                if i == 4: raise
        self.pos += len(b); return b
    def readinto(self, buf):
        b = self.read(len(buf)); buf[:len(b)] = b; return len(b)
