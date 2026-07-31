"""Parse Outlook .msg / .eml / PDF-portfolio emails into a job ledger.
Usage: python parse_msg.py <files...>  -> prints headers, body text, saves attachments to ./attachments/
"""
import sys, os, re, email, email.policy
import olefile

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attachments')
os.makedirs(OUT, exist_ok=True)

def read_stream(ole, path):
    try:
        with ole.openstream(path) as s: return s.read()
    except Exception: return None

def msg_string(ole, prop):
    # try unicode (001F) then ansi (001E)
    for suf, dec in (('001F', 'utf-16-le'), ('001E', 'cp1252')):
        d = read_stream(ole, f'__substg1.0_{prop}{suf}')
        if d is not None:
            return d.decode(dec, errors='replace')
    return None

def parse_msg(path):
    ole = olefile.OleFileIO(path)
    hdr = {
        'subject': msg_string(ole, '0037'),
        'from': msg_string(ole, '0C1A') or msg_string(ole, '0042'),
        'headers': msg_string(ole, '007D'),
        'body': msg_string(ole, '1000'),
    }
    # recipients
    recips = []
    for entry in ole.listdir():
        if entry[0].startswith('__recip_version1.0_'):
            store = entry[0]
            name = msg_string_in(ole, store, '3001'); addr = msg_string_in(ole, store, '39FE') or msg_string_in(ole, store, '3003')
            if (name or addr) and (name, addr) not in recips: recips.append((name, addr))
    hdr['recipients'] = sorted(set(recips))
    # attachments
    saved = []
    stores = sorted(set(e[0] for e in ole.listdir() if e[0].startswith('__attach_version1.0_')))
    for store in stores:
        fname = msg_string_in(ole, store, '3707') or msg_string_in(ole, store, '3704') or 'attachment.bin'
        data = read_stream(ole, f'{store}/__substg1.0_37010102')
        if data:
            safe = re.sub(r'[^\w.\- ]', '_', fname)
            p = os.path.join(OUT, safe)
            with open(p, 'wb') as f: f.write(data)
            saved.append((safe, len(data)))
    hdr['attachments'] = saved
    ole.close()
    return hdr

def msg_string_in(ole, store, prop):
    for suf, dec in (('001F', 'utf-16-le'), ('001E', 'cp1252')):
        d = read_stream(ole, f'{store}/__substg1.0_{prop}{suf}')
        if d is not None: return d.decode(dec, errors='replace')
    return None

def parse_eml(path):
    with open(path, 'rb') as f:
        m = email.message_from_binary_file(f, policy=email.policy.default)
    hdr = {'subject': m['subject'], 'from': m['from'], 'to': m['to'], 'cc': m['cc'], 'date': m['date']}
    body = m.get_body(preferencelist=('plain', 'html'))
    hdr['body'] = body.get_content() if body else ''
    saved = []
    for part in m.iter_attachments():
        fname = part.get_filename() or 'attachment.bin'
        safe = re.sub(r'[^\w.\- ]', '_', fname)
        p = os.path.join(OUT, safe)
        with open(p, 'wb') as f: f.write(part.get_payload(decode=True) or b'')
        saved.append((safe, os.path.getsize(p)))
    hdr['attachments'] = saved
    return hdr

if __name__ == '__main__':
    for path in sys.argv[1:]:
        ext = path.lower().rsplit('.', 1)[-1]
        try:
            hdr = parse_msg(path) if ext == 'msg' else parse_eml(path)
        except Exception as e:
            print(f'!! {os.path.basename(path)}: {e}'); continue
        print('=' * 90)
        print('FILE:   ', os.path.basename(path))
        print('SUBJECT:', (hdr.get('subject') or '').strip()[:150])
        print('FROM:   ', (hdr.get('from') or '').strip()[:100])
        for a, n in hdr.get('attachments', []): print(f'  attachment: {a} ({n:,} bytes)')
        body = (hdr.get('body') or '').replace('\r\n', '\n')
        print('--- body first 40 lines ---')
        print('\n'.join(body.split('\n')[:40]))
